import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateCorrelationId, logGameAction } from '@/lib/gameLogger';
import type { GameTicket } from './useGameTickets';

// Callback to mark ticket as used optimistically
type MarkTicketUsedCallback = (ticketId: string) => void;
let markTicketUsedCallback: MarkTicketUsedCallback | null = null;

export function setMarkTicketUsedCallback(callback: MarkTicketUsedCallback | null) {
  markTicketUsedCallback = callback;
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

    const correlationId = generateCorrelationId();
    setIsPlacingBet(true);
    setError(null);

    logGameAction(correlationId, 'PLACE_BET_START', {
      ticketId: ticket.id.slice(0, 8),
      ticketValue: ticket.ticket_value,
      autoCashoutAt,
    });

    try {
      const response = await supabase.functions.invoke('game-place-bet', {
        body: {
          wallet_address: walletAddress,
          ticket_id: ticket.id,
          auto_cashout_at: autoCashoutAt,
          correlation_id: correlationId,
        },
      });

      if (response.error) {
        logGameAction(correlationId, 'PLACE_BET_ERROR', undefined, response.error.message);
        throw new Error(response.error.message || 'Failed to place bet');
      }

      if (response.data?.error) {
        logGameAction(correlationId, 'PLACE_BET_ERROR', undefined, response.data.error);
        throw new Error(response.data.error);
      }

      // Optimistic update: mark ticket as used immediately
      if (markTicketUsedCallback) {
        markTicketUsedCallback(ticket.id);
      }

      logGameAction(correlationId, 'PLACE_BET_SUCCESS', {
        betId: response.data?.bet?.id?.slice(0, 8),
        roundNumber: response.data?.bet?.round_number,
        requestId: response.data?.request_id,
      });

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

    const correlationId = generateCorrelationId();
    setIsCashingOut(true);
    setError(null);

    logGameAction(correlationId, 'CASHOUT_START', {
      betId: betId.slice(0, 8),
      clientMultiplier: currentMultiplier,
    });

    try {
      const response = await supabase.functions.invoke('game-cashout', {
        body: {
          wallet_address: walletAddress,
          bet_id: betId,
          current_multiplier: currentMultiplier,
          correlation_id: correlationId,
        },
      });

      if (response.error) {
        logGameAction(correlationId, 'CASHOUT_ERROR', undefined, response.error.message);
        throw new Error(response.error.message || 'Failed to cash out');
      }

      if (response.data?.error) {
        logGameAction(correlationId, 'CASHOUT_ERROR', { 
          serverMultiplier: response.data?.server_multiplier 
        }, response.data.error);
        throw new Error(response.data.error);
      }

      const cashout = response.data?.cashout;
      logGameAction(correlationId, 'CASHOUT_SUCCESS', {
        betId: cashout?.bet_id?.slice(0, 8),
        cashedOutAt: cashout?.cashed_out_at,
        winnings: cashout?.winnings,
        serverMultiplier: cashout?.server_multiplier,
        validatedMultiplier: cashout?.validated_multiplier,
        requestId: response.data?.request_id,
      });

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
