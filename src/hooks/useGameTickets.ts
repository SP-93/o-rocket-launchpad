import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { generateCorrelationId, logGameAction } from '@/lib/gameLogger';

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

export interface GroupedTicket {
  value: number;
  count: number;
  tickets: GameTicket[];
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

    const correlationId = generateCorrelationId();
    setIsLoading(true);
    setError(null);

    logGameAction(correlationId, 'FETCH_TICKETS_START', { wallet: walletAddress.slice(0, 10) });

    try {
      // Use edge function to bypass RLS issues
      const response = await supabase.functions.invoke('game-get-tickets', {
        body: { wallet_address: walletAddress, correlation_id: correlationId },
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
      
      logGameAction(correlationId, 'FETCH_TICKETS_SUCCESS', { 
        total: allTickets.length, 
        available: available.length 
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tickets';
      logGameAction(correlationId, 'FETCH_TICKETS_ERROR', undefined, message);
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
          logGameAction(correlationId, 'FETCH_TICKETS_FALLBACK_SUCCESS', { 
            total: allTickets.length, 
            available: available.length 
          });
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

  // Realtime subscription for ticket updates
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  useEffect(() => {
    if (!walletAddress) return;

    // Subscribe to ticket changes for this wallet
    const channel = supabase
      .channel(`tickets-${walletAddress.toLowerCase()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_tickets',
          filter: `wallet_address=eq.${walletAddress.toLowerCase()}`,
        },
        (payload) => {
          const correlationId = generateCorrelationId();
          logGameAction(correlationId, 'TICKET_REALTIME_UPDATE', { 
            ticketId: (payload.new as any).id?.slice(0, 8),
            is_used: (payload.new as any).is_used 
          });
          const updated = payload.new as GameTicket;
          
          // If ticket was marked as used, immediately remove from available
          if (updated.is_used) {
            setAvailableTickets(prev => prev.filter(t => t.id !== updated.id));
            setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_tickets',
          filter: `wallet_address=eq.${walletAddress.toLowerCase()}`,
        },
        (payload) => {
          const correlationId = generateCorrelationId();
          const newTicket = payload.new as GameTicket;
          logGameAction(correlationId, 'TICKET_REALTIME_INSERT', { 
            ticketId: newTicket.id?.slice(0, 8),
            value: newTicket.ticket_value 
          });
          
          // Add new ticket to lists
          setTickets(prev => [newTicket, ...prev]);
          
          const now = new Date();
          if (!newTicket.is_used && new Date(newTicket.expires_at) > now) {
            setAvailableTickets(prev => [newTicket, ...prev]);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [walletAddress]);

  const buyTicket = useCallback(async (
    ticketValue: number,
    paymentCurrency: 'WOVER' | 'USDT',
    paymentAmount: number,
    txHash?: string
  ) => {
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    const correlationId = generateCorrelationId();
    logGameAction(correlationId, 'BUY_TICKET_START', { 
      value: ticketValue, 
      currency: paymentCurrency, 
      amount: paymentAmount,
      txHash: txHash?.slice(0, 16) 
    });

    const response = await supabase.functions.invoke('game-buy-ticket', {
      body: {
        wallet_address: walletAddress,
        ticket_value: ticketValue,
        payment_currency: paymentCurrency,
        payment_amount: paymentAmount,
        tx_hash: txHash,
        correlation_id: correlationId,
      },
    });

    if (response.error) {
      logGameAction(correlationId, 'BUY_TICKET_ERROR', undefined, response.error.message);
      throw new Error(response.error.message || 'Failed to buy ticket');
    }

    if (response.data?.error) {
      logGameAction(correlationId, 'BUY_TICKET_ERROR', undefined, response.data.error);
      throw new Error(response.data.error);
    }

    logGameAction(correlationId, 'BUY_TICKET_SUCCESS', { 
      ticketId: response.data?.ticket?.id?.slice(0, 8),
      requestId: response.data?.request_id 
    });

    // Refresh tickets
    await fetchTickets();
    return response.data;
  }, [walletAddress, fetchTickets]);

  // Group available tickets by value
  const groupedTickets = useMemo<GroupedTicket[]>(() => {
    if (availableTickets.length === 0) return [];
    
    const groups = new Map<number, GameTicket[]>();
    
    for (const ticket of availableTickets) {
      const existing = groups.get(ticket.ticket_value) || [];
      existing.push(ticket);
      groups.set(ticket.ticket_value, existing);
    }
    
    return Array.from(groups.entries())
      .map(([value, tickets]) => ({
        value,
        count: tickets.length,
        tickets,
      }))
      .sort((a, b) => a.value - b.value);
  }, [availableTickets]);

  // Optimistic update: mark ticket as used locally
  const markTicketUsed = useCallback((ticketId: string) => {
    const correlationId = generateCorrelationId();
    logGameAction(correlationId, 'TICKET_OPTIMISTIC_USED', { ticketId: ticketId.slice(0, 8) });
    setAvailableTickets(prev => prev.filter(t => t.id !== ticketId));
    setTickets(prev => prev.map(t => 
      t.id === ticketId ? { ...t, is_used: true } : t
    ));
  }, []);

  return {
    tickets,
    availableTickets,
    groupedTickets,
    isLoading,
    error,
    buyTicket,
    markTicketUsed,
    refetch: fetchTickets,
  };
}
