import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useGameTickets, type GameTicket, type GroupedTicket } from '@/hooks/useGameTickets';
import { useWallet } from '@/hooks/useWallet';

interface GameTicketsContextValue {
  tickets: GameTicket[];
  availableTickets: GameTicket[];
  groupedTickets: GroupedTicket[];
  isLoading: boolean;
  error: string | null;
  buyTicket: (ticketValue: number, paymentCurrency: 'WOVER' | 'USDT', paymentAmount: number, txHash?: string) => Promise<any>;
  markTicketUsed: (ticketId: string) => void;
  refetch: () => Promise<void>;
}

const GameTicketsContext = createContext<GameTicketsContextValue | null>(null);

export function GameTicketsProvider({ children }: { children: ReactNode }) {
  const { address } = useWallet();
  
  const {
    tickets,
    availableTickets,
    groupedTickets,
    isLoading,
    error,
    buyTicket,
    markTicketUsed,
    refetch,
  } = useGameTickets(address);

  const value = useMemo<GameTicketsContextValue>(() => ({
    tickets,
    availableTickets,
    groupedTickets,
    isLoading,
    error,
    buyTicket,
    markTicketUsed,
    refetch,
  }), [tickets, availableTickets, groupedTickets, isLoading, error, buyTicket, markTicketUsed, refetch]);

  return (
    <GameTicketsContext.Provider value={value}>
      {children}
    </GameTicketsContext.Provider>
  );
}

export function useGameTicketsContext() {
  const context = useContext(GameTicketsContext);
  if (!context) {
    throw new Error('useGameTicketsContext must be used within a GameTicketsProvider');
  }
  return context;
}
