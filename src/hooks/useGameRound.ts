import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GameRound {
  id: string;
  round_number: number;
  status: 'betting' | 'countdown' | 'flying' | 'crashed' | 'payout';
  crash_point: number | null;
  server_seed_hash: string | null;
  server_seed: string | null;
  started_at: string | null;
  crashed_at: string | null;
  total_bets: number;
  total_wagered: number;
  total_payouts: number;
  created_at: string;
}

export interface GameBet {
  id: string;
  round_id: string;
  wallet_address: string;
  ticket_id: string;
  bet_amount: number;
  auto_cashout_at: number | null;
  cashed_out_at: number | null;
  winnings: number;
  status: 'active' | 'won' | 'lost';
  created_at: string;
}

export function useGameRound() {
  const [currentRound, setCurrentRound] = useState<GameRound | null>(null);
  const [roundHistory, setRoundHistory] = useState<GameRound[]>([]);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.00);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current or most recent round
  const fetchCurrentRound = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('game_rounds')
        .select('*')
        .in('status', ['betting', 'countdown', 'flying'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setCurrentRound(data as GameRound);
      }
    } catch (error) {
      console.error('Error fetching current round:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch round history (last 10 crashed rounds)
  const fetchRoundHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('status', 'crashed')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRoundHistory((data || []) as GameRound[]);
    } catch (error) {
      console.error('Error fetching round history:', error);
    }
  }, []);

  // Subscribe to round updates
  useEffect(() => {
    fetchCurrentRound();
    fetchRoundHistory();

    const channel = supabase
      .channel('game-rounds')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rounds',
        },
        (payload) => {
          console.log('Round update:', payload);
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const round = payload.new as GameRound;
            setCurrentRound(round);
            
            if (round.status === 'crashed') {
              fetchRoundHistory();
              setCurrentMultiplier(1.00);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCurrentRound, fetchRoundHistory]);

  // Simulate multiplier increase during flying phase
  useEffect(() => {
    if (currentRound?.status !== 'flying') {
      return;
    }

    const startTime = currentRound.started_at 
      ? new Date(currentRound.started_at).getTime() 
      : Date.now();

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      // Exponential growth: starts slow, accelerates
      const multiplier = Math.pow(1.0718, elapsed); // ~2x in 10 seconds
      const capped = Math.min(multiplier, 10.00);
      setCurrentMultiplier(Math.round(capped * 100) / 100);
    }, 50);

    return () => clearInterval(interval);
  }, [currentRound?.status, currentRound?.started_at]);

  return {
    currentRound,
    roundHistory,
    currentMultiplier,
    isLoading,
    refetch: fetchCurrentRound,
  };
}

export function useGameBets(roundId: string | undefined, walletAddress: string | undefined) {
  const [bets, setBets] = useState<GameBet[]>([]);
  const [myBet, setMyBet] = useState<GameBet | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch bets for current round
  const fetchBets = useCallback(async () => {
    if (!roundId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('game_bets')
        .select('*')
        .eq('round_id', roundId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBets((data || []) as GameBet[]);

      // Find user's bet
      if (walletAddress) {
        const userBet = data?.find(
          b => b.wallet_address.toLowerCase() === walletAddress.toLowerCase()
        );
        setMyBet(userBet as GameBet || null);
      }
    } catch (error) {
      console.error('Error fetching bets:', error);
    } finally {
      setIsLoading(false);
    }
  }, [roundId, walletAddress]);

  useEffect(() => {
    fetchBets();

    if (!roundId) return;

    const channel = supabase
      .channel(`game-bets-${roundId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_bets',
          filter: `round_id=eq.${roundId}`,
        },
        (payload) => {
          console.log('Bet update:', payload);
          fetchBets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roundId, fetchBets]);

  return {
    bets,
    myBet,
    isLoading,
    refetch: fetchBets,
  };
}
