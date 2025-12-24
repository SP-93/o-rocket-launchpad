import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { GameTicket } from './useGameTickets';

// Callback to refresh tickets after bet
type RefreshCallback = () => void;
let ticketRefreshCallback: RefreshCallback | null = null;

export function setTicketRefreshCallback(callback: RefreshCallback | null) {
  ticketRefreshCallback = callback;
}

export function useGameBetting(walletAddress: string | undefined) {
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [isCashingOut, setIsCashingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeBet = useCallback(async (
    ticket: GameTicket,
    autoCashoutAt: number | null
  ) => {
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    setIsPlacingBet(true);
    setError(null);

    try {
      const response = await supabase.functions.invoke('game-place-bet', {
        body: {
          wallet_address: walletAddress,
          ticket_id: ticket.id,
          auto_cashout_at: autoCashoutAt,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to place bet');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      // Trigger ticket refresh immediately after successful bet
      if (ticketRefreshCallback) {
        ticketRefreshCallback();
      }

      return response.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to place bet';
      setError(message);
      throw err;
    } finally {
      setIsPlacingBet(false);
    }
  }, [walletAddress]);

  const cashOut = useCallback(async (
    betId: string,
    currentMultiplier: number
  ) => {
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    setIsCashingOut(true);
    setError(null);

    try {
      const response = await supabase.functions.invoke('game-cashout', {
        body: {
          wallet_address: walletAddress,
          bet_id: betId,
          current_multiplier: currentMultiplier,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to cash out');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cash out';
      setError(message);
      throw err;
    } finally {
      setIsCashingOut(false);
    }
  }, [walletAddress]);

  return {
    placeBet,
    cashOut,
    isPlacingBet,
    isCashingOut,
    error,
  };
}
