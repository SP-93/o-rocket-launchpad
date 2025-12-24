import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PendingWin {
  id: string;
  round_id: string;
  bet_amount: number;
  cashed_out_at: number;
  winnings: number;
  created_at: string;
}

export const usePendingWinnings = (walletAddress: string | undefined) => {
  const [pendingWinnings, setPendingWinnings] = useState<PendingWin[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPendingWinnings = useCallback(async () => {
    if (!walletAddress) {
      setPendingWinnings([]);
      setTotalPending(0);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('game_bets')
        .select('id, round_id, bet_amount, cashed_out_at, winnings, created_at')
        .ilike('wallet_address', walletAddress)
        .eq('status', 'won')
        .gt('winnings', 0)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[usePendingWinnings] Error:', error);
        return;
      }

      const wins = (data || []) as PendingWin[];
      setPendingWinnings(wins);
      setTotalPending(wins.reduce((sum, w) => sum + (w.winnings || 0), 0));
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
    totalPending,
    isLoading,
    refetch: fetchPendingWinnings,
  };
};

export default usePendingWinnings;
