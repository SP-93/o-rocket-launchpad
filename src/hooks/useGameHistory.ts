import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GameHistoryStats {
  total_bets: number;
  total_wins: number;
  total_losses: number;
  total_wagered: number;
  total_winnings: number;
  total_claimed: number;
  best_multiplier: number;
  total_tickets_purchased: number;
  total_tickets_used: number;
  total_tickets_expired: number;
}

export interface HistoryBet {
  id: string;
  round_number: number;
  bet_amount: number;
  status: string;
  auto_cashout_at: number | null;
  cashed_out_at: number | null;
  winnings: number | null;
  crash_point: number | null;
  claimed_at: string | null;
  claim_tx_hash: string | null;
  created_at: string;
  profit: number;
}

export interface HistoryTicket {
  id: string;
  serial_number: number | null;
  ticket_value: number;
  payment_amount: number;
  payment_currency: string;
  tx_hash: string | null;
  status: 'active' | 'used' | 'expired';
  expires_at: string;
  used_in_round: string | null;
  created_at: string;
}

export interface GameHistory {
  stats: GameHistoryStats;
  bets: HistoryBet[];
  tickets: HistoryTicket[];
  audit_log: any[];
}

export function useGameHistory(walletAddress: string | undefined) {
  const [history, setHistory] = useState<GameHistory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (limit = 50, offset = 0) => {
    if (!walletAddress) {
      setHistory(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('game-get-history', {
        body: { wallet_address: walletAddress, limit, offset }
      });

      if (fnError) throw fnError;
      
      if (data?.success) {
        setHistory({
          stats: data.stats,
          bets: data.bets,
          tickets: data.tickets,
          audit_log: data.audit_log
        });
      } else {
        throw new Error(data?.error || 'Failed to fetch history');
      }
    } catch (err: any) {
      console.error('[useGameHistory] Error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  return {
    history,
    isLoading,
    error,
    fetchHistory
  };
}
