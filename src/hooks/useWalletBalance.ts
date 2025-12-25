import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTokenTransfer } from './useTokenTransfer';

interface UseWalletBalanceOptions {
  currency: 'WOVER' | 'USDT';
  refreshInterval?: number; // in milliseconds
}

export const useWalletBalance = (
  walletAddress: string | undefined,
  options: UseWalletBalanceOptions
) => {
  const { currency, refreshInterval = 3000 } = options;
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { getTokenBalance } = useTokenTransfer();

  const refreshBalance = useCallback(async () => {
    if (!walletAddress) {
      setBalance(null);
      return;
    }

    setIsLoading(true);
    try {
      const newBalance = await getTokenBalance(currency, walletAddress);
      setBalance(newBalance);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, currency, getTokenBalance]);

  // Initial fetch and periodic refresh
  useEffect(() => {
    if (!walletAddress) {
      setBalance(null);
      return;
    }

    // Initial fetch
    refreshBalance();

    // Periodic refresh
    const interval = setInterval(refreshBalance, refreshInterval);

    return () => clearInterval(interval);
  }, [walletAddress, refreshInterval, refreshBalance]);

  // Real-time updates from game_tickets table
  useEffect(() => {
    if (!walletAddress) return;

    const channel = supabase
      .channel(`balance-${walletAddress.toLowerCase()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_tickets',
          filter: `wallet_address=ilike.${walletAddress}`
        },
        () => {
          // Refresh balance when tickets change
          refreshBalance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [walletAddress, refreshBalance]);

  // Listen for custom balance refresh events
  useEffect(() => {
    const handleBalanceRefresh = () => {
      refreshBalance();
    };

    window.addEventListener('wallet-balance-refresh', handleBalanceRefresh);

    return () => {
      window.removeEventListener('wallet-balance-refresh', handleBalanceRefresh);
    };
  }, [refreshBalance]);

  return {
    balance,
    isLoading,
    refreshBalance
  };
};

// Utility function to trigger balance refresh from anywhere
export const triggerBalanceRefresh = () => {
  window.dispatchEvent(new CustomEvent('wallet-balance-refresh'));
};