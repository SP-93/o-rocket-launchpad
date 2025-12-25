import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EngineStatus {
  isEnabled: boolean;
  lastAction: string | null;
  lastTick: Date | null;
  error: string | null;
}

// Tick interval - how often clients help drive the game
const TICK_INTERVAL = 2000; // 2 seconds - reduced load

export function useGameEngine() {
  const [status, setStatus] = useState<EngineStatus>({
    isEnabled: false,
    lastAction: null,
    lastTick: null,
    error: null,
  });
  
  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isTickingRef = useRef(false);

  // Call tick endpoint
  const tick = useCallback(async () => {
    if (isTickingRef.current) return; // Prevent overlapping ticks
    
    isTickingRef.current = true;
    try {
      const response = await supabase.functions.invoke('game-round-manager', {
        body: { action: 'tick' },
      });

      if (response.error) {
        console.error('[GameEngine] Tick error:', response.error);
        setStatus(prev => ({ ...prev, error: response.error.message }));
      } else if (response.data) {
        setStatus(prev => ({
          ...prev,
          lastAction: response.data.action,
          lastTick: new Date(),
          error: null,
          isEnabled: response.data.action !== 'idle' && response.data.action !== 'paused',
        }));
      }
    } catch (err: any) {
      console.error('[GameEngine] Tick failed:', err);
      setStatus(prev => ({ ...prev, error: err.message }));
    } finally {
      isTickingRef.current = false;
    }
  }, []);

  // Fetch initial engine status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await supabase.functions.invoke('game-round-manager', {
        body: { action: 'get_status' },
      });

      if (response.data) {
        setStatus(prev => ({
          ...prev,
          isEnabled: response.data.engine_enabled ?? false,
        }));
      }
    } catch (err) {
      console.error('[GameEngine] Status fetch failed:', err);
    }
  }, []);

  // Start ticking when mounted
  useEffect(() => {
    fetchStatus();
    
    // Start tick loop
    tick(); // Initial tick
    tickIntervalRef.current = setInterval(tick, TICK_INTERVAL);

    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
      }
    };
  }, [tick, fetchStatus]);

  return { status, tick };
}
