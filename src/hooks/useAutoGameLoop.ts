import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@/hooks/useWallet';
import { isAdmin } from '@/config/admin';
import { toast } from 'sonner';

interface AutoGameConfig {
  bettingDuration: number;
  countdownDuration: number;
  minFlyingDuration: number;
  maxFlyingDuration: number;
  pauseBetweenRounds: number;
}

interface GameLoopState {
  isRunning: boolean;
  currentPhase: 'idle' | 'betting' | 'countdown' | 'flying' | 'crashed' | 'payout' | 'pausing';
  currentRoundId: string | null;
  roundNumber: number;
  multiplier: number;
  crashPoint: number | null;
  timeRemaining: number;
  error: string | null;
  lastAction: string | null;
  totalRoundsPlayed: number;
}

const DEFAULT_CONFIG: AutoGameConfig = {
  bettingDuration: 15,
  countdownDuration: 3,
  minFlyingDuration: 3,
  maxFlyingDuration: 15,
  pauseBetweenRounds: 3,
};

export function useAutoGameLoop() {
  const { address } = useWallet();
  const [config, setConfig] = useState<AutoGameConfig>(DEFAULT_CONFIG);
  const [state, setState] = useState<GameLoopState>({
    isRunning: false,
    currentPhase: 'idle',
    currentRoundId: null,
    roundNumber: 0,
    multiplier: 1.00,
    crashPoint: null,
    timeRemaining: 0,
    error: null,
    lastAction: null,
    totalRoundsPlayed: 0,
  });

  const loopRef = useRef<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const multiplierRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Call backend with admin wallet header (no session needed)
  const callRoundManager = useCallback(async (action: string, body: Record<string, any> = {}) => {
    setState(prev => ({ ...prev, lastAction: action }));
    
    try {
      if (!address || !isAdmin(address)) {
        throw new Error('Not authorized - admin wallet required');
      }

      console.log(`[AutoGame] ${action} with admin wallet: ${address}`);

      const response = await supabase.functions.invoke('game-round-manager', {
        body: { 
          action, 
          admin_wallet: address, // Direct wallet-based auth
          ...body 
        },
      });

      if (response.error) {
        console.error(`[AutoGame] ${action} error:`, response.error);
        throw new Error(response.error.message || 'Function error');
      }

      if (response.data?.error) {
        console.error(`[AutoGame] ${action} returned error:`, response.data.error);
        throw new Error(response.data.error);
      }

      console.log(`[AutoGame] ${action} success:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`[AutoGame] ${action} failed:`, error);
      setState(prev => ({ ...prev, error: `${action}: ${error.message}` }));
      throw error;
    }
  }, [address]);

  // Countdown timer
  const startCountdown = useCallback((seconds: number, onComplete: () => void) => {
    setState(prev => ({ ...prev, timeRemaining: seconds }));
    
    if (timerRef.current) clearInterval(timerRef.current);
    
    const endTime = Date.now() + seconds * 1000;
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setState(prev => ({ ...prev, timeRemaining: remaining }));
      
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        onComplete();
      }
    }, 100);
  }, []);

  // Multiplier animation during flying
  const startMultiplierAnimation = useCallback((crashPoint: number, onCrash: () => void) => {
    startTimeRef.current = Date.now();
    
    if (multiplierRef.current) clearInterval(multiplierRef.current);
    
    multiplierRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const multiplier = Math.pow(1.0718, elapsed);
      const capped = Math.min(multiplier, 10.00);
      
      setState(prev => ({ ...prev, multiplier: Math.round(capped * 100) / 100 }));
      
      if (capped >= crashPoint) {
        if (multiplierRef.current) clearInterval(multiplierRef.current);
        onCrash();
      }
    }, 50);
  }, []);

  // Main game loop
  const runGameLoop = useCallback(async () => {
    if (!loopRef.current) return;

    try {
      // PHASE 1: Start new round
      console.log('[AutoGame] Starting new round...');
      setState(prev => ({ ...prev, currentPhase: 'betting', error: null, multiplier: 1.00 }));
      
      const roundResult = await callRoundManager('start_round');
      if (!roundResult?.success) {
        throw new Error(roundResult?.error || 'Failed to start round');
      }

      const roundId = roundResult.round.id;
      const roundNumber = roundResult.round.round_number;
      
      setState(prev => ({ 
        ...prev, 
        currentRoundId: roundId, 
        roundNumber,
        crashPoint: null,
      }));

      console.log(`[AutoGame] Round ${roundNumber} started`);

      // Wait for betting duration
      await new Promise<void>(resolve => {
        if (!loopRef.current) { resolve(); return; }
        startCountdown(config.bettingDuration, resolve);
      });

      if (!loopRef.current) return;

      // PHASE 2: Countdown
      console.log('[AutoGame] Countdown phase...');
      setState(prev => ({ ...prev, currentPhase: 'countdown' }));
      
      await callRoundManager('start_countdown', { round_id: roundId });

      await new Promise<void>(resolve => {
        if (!loopRef.current) { resolve(); return; }
        startCountdown(config.countdownDuration, resolve);
      });

      if (!loopRef.current) return;

      // PHASE 3: Flying
      console.log('[AutoGame] Flying phase...');
      setState(prev => ({ ...prev, currentPhase: 'flying', multiplier: 1.00 }));
      
      await callRoundManager('start_flying', { round_id: roundId });

      const flyDuration = config.minFlyingDuration + 
        Math.random() * (config.maxFlyingDuration - config.minFlyingDuration);
      const approximateCrashPoint = Math.pow(1.0718, flyDuration);
      
      await new Promise<void>(resolve => {
        if (!loopRef.current) { resolve(); return; }
        startMultiplierAnimation(approximateCrashPoint, resolve);
      });

      if (!loopRef.current) return;

      // PHASE 4: Crash
      console.log('[AutoGame] Crashing...');
      setState(prev => ({ ...prev, currentPhase: 'crashed' }));
      
      const crashResult = await callRoundManager('crash', { round_id: roundId });
      
      if (crashResult?.crash_point) {
        setState(prev => ({ 
          ...prev, 
          crashPoint: crashResult.crash_point,
          multiplier: crashResult.crash_point,
        }));
      }

      await new Promise(resolve => setTimeout(resolve, 1500));

      if (!loopRef.current) return;

      // PHASE 5: Payouts
      console.log('[AutoGame] Processing payouts...');
      setState(prev => ({ ...prev, currentPhase: 'payout' }));
      
      await callRoundManager('process_payouts', { round_id: roundId });

      setState(prev => ({ 
        ...prev, 
        totalRoundsPlayed: prev.totalRoundsPlayed + 1 
      }));

      // PHASE 6: Pause
      console.log('[AutoGame] Pausing...');
      setState(prev => ({ ...prev, currentPhase: 'pausing' }));
      
      await new Promise<void>(resolve => {
        if (!loopRef.current) { resolve(); return; }
        startCountdown(config.pauseBetweenRounds, resolve);
      });

      if (loopRef.current) {
        runGameLoop();
      }

    } catch (error: any) {
      console.error('[AutoGame] Error:', error);
      setState(prev => ({ 
        ...prev, 
        error: error.message || 'Game loop error',
        currentPhase: 'idle',
      }));
      
      if (loopRef.current) {
        toast.error(`Game error: ${error.message}. Retrying in 5s...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        if (loopRef.current) {
          runGameLoop();
        }
      }
    }
  }, [config, callRoundManager, startCountdown, startMultiplierAnimation]);

  const startAutoPlay = useCallback(() => {
    if (!address || !isAdmin(address)) {
      toast.error('Admin wallet required to start game');
      return;
    }
    
    if (loopRef.current) return;
    
    console.log('[AutoGame] Starting with wallet:', address);
    loopRef.current = true;
    setState(prev => ({ 
      ...prev, 
      isRunning: true, 
      error: null,
      lastAction: null,
      totalRoundsPlayed: 0,
    }));
    
    toast.success('Auto-gameplay started!');
    runGameLoop();
  }, [address, runGameLoop]);

  const stopAutoPlay = useCallback(() => {
    console.log('[AutoGame] Stopping...');
    loopRef.current = false;
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (multiplierRef.current) {
      clearInterval(multiplierRef.current);
      multiplierRef.current = null;
    }
    
    setState(prev => ({ 
      ...prev, 
      isRunning: false, 
      currentPhase: 'idle',
      timeRemaining: 0,
    }));
    
    toast.info('Auto-gameplay stopped');
  }, []);

  const updateConfig = useCallback((updates: Partial<AutoGameConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  useEffect(() => {
    return () => {
      loopRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (multiplierRef.current) clearInterval(multiplierRef.current);
    };
  }, []);

  return {
    state,
    config,
    startAutoPlay,
    stopAutoPlay,
    updateConfig,
  };
}
