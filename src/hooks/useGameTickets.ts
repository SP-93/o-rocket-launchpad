import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GameTicket {
  id: string;
  wallet_address: string;
  ticket_value: number;
  payment_currency: 'WOVER' | 'USDT';
  payment_amount: number;
  tx_hash: string | null;
  expires_at: string;
  is_used: boolean;
  used_in_round: string | null;
  created_at: string;
}

export function useGameTickets(walletAddress: string | undefined) {
  const [tickets, setTickets] = useState<GameTicket[]>([]);
  const [availableTickets, setAvailableTickets] = useState<GameTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    if (!walletAddress) {
      setTickets([]);
      setAvailableTickets([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use edge function to bypass RLS issues
      const response = await supabase.functions.invoke('game-get-tickets', {
        body: { wallet_address: walletAddress },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to fetch tickets');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      const allTickets = (response.data?.tickets || []) as GameTicket[];
      const available = (response.data?.availableTickets || []) as GameTicket[];
      
      setTickets(allTickets);
      setAvailableTickets(available);
    } catch (err) {
      console.error('Error fetching tickets:', err);
      setError('Failed to fetch tickets');
      
      // Fallback to direct query (may fail due to RLS)
      try {
        const { data, error: fetchError } = await supabase
          .from('game_tickets')
          .select('*')
          .eq('wallet_address', walletAddress.toLowerCase())
          .order('created_at', { ascending: false });

        if (!fetchError && data) {
          const allTickets = data as GameTicket[];
          setTickets(allTickets);
          
          const now = new Date();
          const available = allTickets.filter(
            t => !t.is_used && new Date(t.expires_at) > now
          );
          setAvailableTickets(available);
          setError(null);
        }
      } catch {
        // Ignore fallback error
      }
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const buyTicket = useCallback(async (
    ticketValue: number,
    paymentCurrency: 'WOVER' | 'USDT',
    paymentAmount: number,
    txHash?: string
  ) => {
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    const response = await supabase.functions.invoke('game-buy-ticket', {
      body: {
        wallet_address: walletAddress,
        ticket_value: ticketValue,
        payment_currency: paymentCurrency,
        payment_amount: paymentAmount,
        tx_hash: txHash,
      },
    });

    if (response.error) {
      throw new Error(response.error.message || 'Failed to buy ticket');
    }

    if (response.data?.error) {
      throw new Error(response.data.error);
    }

    // Refresh tickets
    await fetchTickets();
    return response.data;
  }, [walletAddress, fetchTickets]);

  return {
    tickets,
    availableTickets,
    isLoading,
    error,
    buyTicket,
    refetch: fetchTickets,
  };
}
