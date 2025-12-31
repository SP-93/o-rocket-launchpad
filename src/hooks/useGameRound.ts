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

// Lag compensation: display multiplier slightly behind server to ensure
// auto-cashouts trigger before the displayed multiplier reaches the target
const LAG_COMPENSATION_MS = 350;

export function useGameRound() {
  const [currentRound, setCurrentRound] = useState<GameRound | null>(null);
  const [roundHistory, setRoundHistory] = useState<GameRound[]>([]);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.00);
  const [isLoading, setIsLoading] = useState(true);
  const [serverClockOffset, setServerClockOffset] = useState<number>(0); // ms difference: server - client
  const multiplierIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<string | null>(null);
  const lastRoundIdRef = useRef<string | null>(null);

  // Stop multiplier animation - define first since others depend on it
  const stopMultiplierAnimation = useCallback(() => {
    if (multiplierIntervalRef.current) {
      clearInterval(multiplierIntervalRef.current);
      multiplierIntervalRef.current = null;
    }
  }, []);

  // Start multiplier animation with lag compensation + server clock offset
  // Lag compensation ensures frontend display is slightly behind server to prevent
  // showing higher multipliers than what auto-cashouts actually get
  const startMultiplierAnimation = useCallback((startedAt: string | null, clockOffset: number = 0) => {
    stopMultiplierAnimation();
    
    const startTime = startedAt ? new Date(startedAt).getTime() : Date.now();
    
    multiplierIntervalRef.current = setInterval(() => {
      // Apply server clock offset for synchronized timing across devices
      const adjustedNow = Date.now() + clockOffset;
      const elapsed = Math.max(0, (adjustedNow - startTime - LAG_COMPENSATION_MS) / 1000);
      const multiplier = Math.pow(1.0718, elapsed);
      const capped = Math.min(multiplier, 10.00);
      setCurrentMultiplier(Math.round(capped * 100) / 100);
    }, 100);
  }, [stopMultiplierAnimation]);

  // Fetch round history using RPC function
  const fetchRoundHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_game_rounds_public', { limit_count: 15 });

      if (error) throw error;
      
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
        const activeRound = rounds.find((r: any) => 
          ['betting', 'countdown', 'flying'].includes(r.status)
        );
        
        const round = (activeRound || rounds[0]) as GameRound;
        setCurrentRound(round);
        
        // Refresh history when new round starts
        if (round.id !== lastRoundIdRef.current && round.status === 'betting') {
          console.log('[useGameRound] New round detected, refreshing history');
          fetchRoundHistory();
        }
        lastRoundIdRef.current = round.id;
        
        // INSTANT SYNC: When flying, immediately calculate multiplier from started_at
        // Apply same lag compensation as animation for consistency + server clock offset
        if (round.status === 'flying') {
          if (lastStatusRef.current !== 'flying') {
            // First time entering flying - instant sync then start animation
            if (round.started_at) {
              const adjustedNow = Date.now() + serverClockOffset;
              const elapsed = Math.max(0, (adjustedNow - new Date(round.started_at).getTime() - LAG_COMPENSATION_MS) / 1000);
              const instantMultiplier = Math.min(Math.pow(1.0718, elapsed), 10.00);
              setCurrentMultiplier(Math.round(instantMultiplier * 100) / 100);
              console.log('[useGameRound] Instant sync multiplier (offset:', serverClockOffset, 'ms):', instantMultiplier.toFixed(2));
            }
            startMultiplierAnimation(round.started_at, serverClockOffset);
          }
        } else {
          // Reset multiplier when not flying
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
  }, [fetchRoundHistory, startMultiplierAnimation, stopMultiplierAnimation, serverClockOffset]);

  // Sync server clock offset on mount
  useEffect(() => {
    const syncServerClock = async () => {
      try {
        const beforeRequest = Date.now();
        const { data, error } = await supabase.functions.invoke('game-get-dashboard-state', {
          body: { wallet_address: null }
        });
        const afterRequest = Date.now();
        
        if (!error && data?.server_time_ms) {
          // Calculate offset accounting for round-trip latency
          const latency = (afterRequest - beforeRequest) / 2;
          const serverTimeAtResponse = data.server_time_ms;
          const estimatedServerNow = serverTimeAtResponse + latency;
          const offset = estimatedServerNow - afterRequest;
          
          // Only apply if offset is significant (> 100ms)
          if (Math.abs(offset) > 100) {
            console.log('[useGameRound] Server clock offset:', offset, 'ms (latency:', latency, 'ms)');
            setServerClockOffset(offset);
          }
        }
      } catch (e) {
        console.warn('[useGameRound] Failed to sync server clock:', e);
      }
    };
    
    syncServerClock();
    // Re-sync every 5 minutes
    const syncInterval = setInterval(syncServerClock, 5 * 60 * 1000);
    return () => clearInterval(syncInterval);
  }, []);

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
    serverClockOffset,
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
