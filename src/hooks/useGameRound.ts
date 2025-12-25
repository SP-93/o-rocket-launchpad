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
  status: 'active' | 'won' | 'lost' | 'claiming' | 'claimed';
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
  const lastRoundIdRef = useRef<string | null>(null);

  // Fetch round history using RPC function
  const fetchRoundHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_game_rounds_public', { limit_count: 15 });

      if (error) throw error;
      
      // Filter only crashed/payout rounds for history
      const historyRounds = (data || [])
        .filter((r: any) => ['crashed', 'payout'].includes(r.status))
        .slice(0, 10) as GameRound[];
      
      setRoundHistory(historyRounds);
    } catch (error) {
      console.error('Error fetching round history:', error);
    }
  }, []);

  // Fetch current or most recent round using RPC function
  const fetchCurrentRound = useCallback(async () => {
    try {
      const { data: rounds, error } = await supabase
        .rpc('get_game_rounds_public', { limit_count: 5 });

      if (error) throw error;
      
      if (rounds && rounds.length > 0) {
        // Find active round first
        const activeRound = rounds.find((r: any) => 
          ['betting', 'countdown', 'flying'].includes(r.status)
        );
        
        const round = (activeRound || rounds[0]) as GameRound;
        setCurrentRound(round);
        
        // CRITICAL: When a new round starts (round ID changed and status is betting), refresh history
        if (round.id !== lastRoundIdRef.current && round.status === 'betting') {
          console.log('[useGameRound] New round detected, refreshing history');
          fetchRoundHistory();
        }
        lastRoundIdRef.current = round.id;
        
        // Start multiplier animation immediately when flying
        if (round.status === 'flying' && lastStatusRef.current !== 'flying') {
          startMultiplierAnimation(round.started_at);
        }
        
        // Reset multiplier when not flying
        if (round.status !== 'flying') {
          stopMultiplierAnimation();
          if (round.status === 'betting' || round.status === 'countdown') {
            setCurrentMultiplier(1.00);
          } else if (round.crash_point) {
            setCurrentMultiplier(round.crash_point);
          }
        }
        
        lastStatusRef.current = round.status;
      }
    } catch (error) {
      console.error('Error fetching current round:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchRoundHistory]);

  // Start multiplier animation
  const startMultiplierAnimation = useCallback((startedAt: string | null) => {
    stopMultiplierAnimation();
    
    const startTime = startedAt ? new Date(startedAt).getTime() : Date.now();
    
    // Use 100ms interval for better performance (was 50ms)
    multiplierIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      // Exponential growth formula
      const multiplier = Math.pow(1.0718, elapsed);
      const capped = Math.min(multiplier, 10.00);
      setCurrentMultiplier(Math.round(capped * 100) / 100);
    }, 100);
  }, []);

  // Stop multiplier animation
  const stopMultiplierAnimation = useCallback(() => {
    if (multiplierIntervalRef.current) {
      clearInterval(multiplierIntervalRef.current);
      multiplierIntervalRef.current = null;
    }
  }, []);

  // fetchRoundHistory is now defined above fetchCurrentRound

  // Initial fetch and polling
  useEffect(() => {
    fetchCurrentRound();
    fetchRoundHistory();

    // Fast polling for better sync
    const pollInterval = setInterval(() => {
      fetchCurrentRound();
    }, POLL_INTERVAL);
    
    // Reference to stop animation for realtime handler
    const handleStopAnimation = stopMultiplierAnimation;

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
          
          if (payload.eventType === 'UPDATE') {
            const newStatus = (payload.new as any).status;
            const newCrashPoint = (payload.new as any).crash_point;
            
            // INSTANT sync when crashed - don't wait for fetch
            if (newStatus === 'crashed' || newStatus === 'payout') {
              // Stop multiplier animation immediately
              stopMultiplierAnimation();
              
              // Set crash point directly from realtime payload
              if (newCrashPoint) {
                setCurrentMultiplier(newCrashPoint);
              }
              
              // Refresh history
              fetchRoundHistory();
            }
          }
          
          // Fetch updated round data
          fetchCurrentRound();
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      handleStopAnimation();
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

  // Fetch bets for current round using public RPC function
  const fetchBets = useCallback(async () => {
    if (!roundId) return;

    setIsLoading(true);
    try {
      // Use public RPC function that bypasses RLS for viewing bets
      const { data, error } = await supabase
        .rpc('get_round_bets_public', { round_uuid: roundId });

      if (error) throw error;
      setBets((data || []) as GameBet[]);

      // Find user's bet
      if (walletAddress) {
        const userBet = data?.find(
          (b: any) => b.wallet_address.toLowerCase() === walletAddress.toLowerCase()
        );
        setMyBet(userBet as GameBet || null);
      }
    } catch (error) {
      console.error('Error fetching bets:', error);
    } finally {
      setIsLoading(false);
    }
  }, [roundId, walletAddress]);

  // IMPORTANT: Reset myBet immediately when roundId changes to prevent stale UI
  useEffect(() => {
    setMyBet(null);
  }, [roundId]);

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
