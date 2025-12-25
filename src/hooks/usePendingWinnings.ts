import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PendingWin {
  id: string;
  round_id: string;
  bet_amount: number;
  cashed_out_at: number;
  winnings: number;
  created_at: string;
  status: 'won' | 'claiming' | 'claimed';
  claiming_started_at?: string | null;
}

export const usePendingWinnings = (walletAddress: string | undefined) => {
  const [pendingWinnings, setPendingWinnings] = useState<PendingWin[]>([]);
  const [claimingWinnings, setClaimingWinnings] = useState<PendingWin[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const resetTriedRef = useRef(false);

  const fetchPendingWinnings = useCallback(async () => {
    if (!walletAddress) {
      setPendingWinnings([]);
      setClaimingWinnings([]);
      setTotalPending(0);
      return;
    }

    setIsLoading(true);
    try {
      // Use edge function to bypass RLS
      const { data, error } = await supabase.functions.invoke('game-pending-winnings', {
        body: { wallet_address: walletAddress }
      });

      if (error) {
        console.error('[usePendingWinnings] Edge function error:', error);
        return;
      }

      if (!data?.success) {
        console.error('[usePendingWinnings] API error:', data?.error);
        return;
      }

      console.log('[usePendingWinnings] Fetched:', {
        pending: data.pendingWinnings?.length || 0,
        claiming: data.claimingWinnings?.length || 0,
        total: data.totalPending
      });

      setPendingWinnings(data.pendingWinnings || []);
      setClaimingWinnings(data.claimingWinnings || []);
      setTotalPending(data.totalPending || 0);

      // Auto-reset stuck claims (older than 5 min) - try once per session
      const claimingList = data.claimingWinnings || [];
      if (claimingList.length > 0 && !resetTriedRef.current) {
        const now = Date.now();
        const stuckClaims = claimingList.filter((c: PendingWin) => {
          if (!c.claiming_started_at) return false;
          const startedAt = new Date(c.claiming_started_at).getTime();
          return now - startedAt > 5 * 60 * 1000; // 5 minutes
        });

        if (stuckClaims.length > 0) {
          resetTriedRef.current = true;
          console.log('[usePendingWinnings] Found stuck claims, resetting...');
          supabase.functions.invoke('game-reset-stuck-claims', {}).then(() => {
            setTimeout(fetchPendingWinnings, 2000);
          }).catch(err => console.warn('[usePendingWinnings] Reset failed:', err));
        }
      }
    } catch (err) {
      console.error('[usePendingWinnings] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  // Initial fetch and polling
  useEffect(() => {
    fetchPendingWinnings();

    // Poll every 10 seconds for updates (more reliable than realtime for anon users)
    pollIntervalRef.current = setInterval(fetchPendingWinnings, 10000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchPendingWinnings]);

  // Also subscribe to realtime as backup
  useEffect(() => {
    if (!walletAddress) return;

    const channel = supabase
      .channel('pending-winnings-' + walletAddress.slice(-8))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_bets',
        },
        () => {
          // Debounce refetch slightly
          setTimeout(fetchPendingWinnings, 500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [walletAddress, fetchPendingWinnings]);

  return {
    pendingWinnings,
    claimingWinnings,
    totalPending,
    isLoading,
    refetch: fetchPendingWinnings,
  };
};

export default usePendingWinnings;
