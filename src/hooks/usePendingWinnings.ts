import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PendingWin {
  id: string;
  round_id: string;
  bet_amount: number;
  cashed_out_at: number;
  winnings: number;
  created_at: string;
  status: 'won' | 'claiming' | 'claimed';
}

export const usePendingWinnings = (walletAddress: string | undefined) => {
  const [pendingWinnings, setPendingWinnings] = useState<PendingWin[]>([]);
  const [claimingWinnings, setClaimingWinnings] = useState<PendingWin[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPendingWinnings = useCallback(async () => {
    if (!walletAddress) {
      setPendingWinnings([]);
      setClaimingWinnings([]);
      setTotalPending(0);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch bets with 'won' or 'claiming' status
      const { data, error } = await supabase
        .from('game_bets')
        .select('id, round_id, bet_amount, cashed_out_at, winnings, created_at, status')
        .ilike('wallet_address', walletAddress)
        .in('status', ['won', 'claiming'])
        .gt('winnings', 0)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[usePendingWinnings] Error:', error);
        return;
      }

      const allWins = (data || []) as PendingWin[];
      const claimable = allWins.filter(w => w.status === 'won');
      const inProgress = allWins.filter(w => w.status === 'claiming');
      
      setPendingWinnings(claimable);
      setClaimingWinnings(inProgress);
      setTotalPending(claimable.reduce((sum, w) => sum + (w.winnings || 0), 0));
    } catch (err) {
      console.error('[usePendingWinnings] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchPendingWinnings();
  }, [fetchPendingWinnings]);

  // Realtime subscription for bet updates
  useEffect(() => {
    if (!walletAddress) return;

    const channel = supabase
      .channel('pending-winnings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_bets',
        },
        () => {
          fetchPendingWinnings();
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
