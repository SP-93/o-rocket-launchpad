import { useState, useEffect, useCallback, useRef } from 'react';
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

// Faster polling interval for better sync
const POLL_INTERVAL = 2000;

export function useGameRound() {
  const [currentRound, setCurrentRound] = useState<GameRound | null>(null);
  const [roundHistory, setRoundHistory] = useState<GameRound[]>([]);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.00);
  const [isLoading, setIsLoading] = useState(true);
  const multiplierIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<string | null>(null);

  // Fetch current or most recent round
  const fetchCurrentRound = useCallback(async () => {
    try {
      // First try to get an active round
      const { data: activeRound, error: activeError } = await supabase
        .from('game_rounds_secure')
        .select('*')
        .in('status', ['betting', 'countdown', 'flying'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeError) throw activeError;
      
      if (activeRound) {
        const round = activeRound as GameRound;
        setCurrentRound(round);
        
        // Start multiplier animation immediately when flying
        if (round.status === 'flying' && lastStatusRef.current !== 'flying') {
          startMultiplierAnimation(round.started_at);
        }
        
        // Reset multiplier when not flying
        if (round.status !== 'flying') {
          stopMultiplierAnimation();
          if (round.status === 'betting' || round.status === 'countdown') {
            setCurrentMultiplier(1.00);
          }
        }
        
        lastStatusRef.current = round.status;
      } else {
        // No active round, fetch the most recent crashed or payout round
        const { data: lastRound, error: lastError } = await supabase
          .from('game_rounds_secure')
          .select('*')
          .in('status', ['crashed', 'payout'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!lastError && lastRound) {
          setCurrentRound(lastRound as GameRound);
          stopMultiplierAnimation();
          // Set final multiplier to crash point if available
          if (lastRound.crash_point) {
            setCurrentMultiplier(lastRound.crash_point);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching current round:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Start multiplier animation
  const startMultiplierAnimation = useCallback((startedAt: string | null) => {
    stopMultiplierAnimation();
    
    const startTime = startedAt ? new Date(startedAt).getTime() : Date.now();
    
    multiplierIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      // Exponential growth formula
      const multiplier = Math.pow(1.0718, elapsed);
      const capped = Math.min(multiplier, 10.00);
      setCurrentMultiplier(Math.round(capped * 100) / 100);
    }, 50);
  }, []);

  // Stop multiplier animation
  const stopMultiplierAnimation = useCallback(() => {
    if (multiplierIntervalRef.current) {
      clearInterval(multiplierIntervalRef.current);
      multiplierIntervalRef.current = null;
    }
  }, []);

  // Fetch round history (include payout rounds which have crash_point visible)
  const fetchRoundHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('game_rounds_secure')
        .select('*')
        .in('status', ['crashed', 'payout'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRoundHistory((data || []) as GameRound[]);
    } catch (error) {
      console.error('Error fetching round history:', error);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    fetchCurrentRound();
    fetchRoundHistory();

    // Fast polling for better sync
    const pollInterval = setInterval(() => {
      fetchCurrentRound();
    }, POLL_INTERVAL);

    // Realtime subscription for immediate updates
    const channel = supabase
      .channel('game-rounds-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rounds',
        },
        (payload) => {
          console.log('Realtime round update:', payload);
          // Immediately fetch to get the latest data
          fetchCurrentRound();
          
          if (payload.eventType === 'UPDATE') {
            const newStatus = (payload.new as any).status;
            if (newStatus === 'crashed') {
              fetchRoundHistory();
            }
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      stopMultiplierAnimation();
      supabase.removeChannel(channel);
    };
  }, [fetchCurrentRound, fetchRoundHistory, stopMultiplierAnimation]);

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
