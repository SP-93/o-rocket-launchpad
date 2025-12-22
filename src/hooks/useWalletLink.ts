import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@/hooks/useWallet';
import logger from '@/lib/logger';

interface LinkedWallet {
  id: string;
  wallet_address: string;
  verified_at: string;
  created_at: string;
}

interface WalletLinkState {
  linkedWallets: LinkedWallet[];
  isLoading: boolean;
  isLinking: boolean;
  error: string | null;
}

/**
 * Hook for managing wallet-to-user linking
 * Allows users to connect multiple wallets to their Supabase account
 */
export const useWalletLink = () => {
  const { address, isConnected, getProvider } = useWallet();
  const [state, setState] = useState<WalletLinkState>({
    linkedWallets: [],
    isLoading: true,
    isLinking: false,
    error: null,
  });

  // Fetch user's linked wallets
  const fetchLinkedWallets = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState(prev => ({ ...prev, linkedWallets: [], isLoading: false }));
        return;
      }

      const { data, error } = await supabase
        .from('user_wallets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Failed to fetch linked wallets:', error);
        setState(prev => ({ ...prev, isLoading: false, error: error.message }));
        return;
      }

      setState(prev => ({
        ...prev,
        linkedWallets: data || [],
        isLoading: false,
        error: null,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Exception fetching wallets:', err);
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
    }
  }, []);

  // Check if current wallet is already linked
  const isCurrentWalletLinked = useCallback(() => {
    if (!address) return false;
    return state.linkedWallets.some(
      w => w.wallet_address.toLowerCase() === address.toLowerCase()
    );
  }, [address, state.linkedWallets]);

  // Generate nonce for signing
  const generateNonce = () => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  // Link the currently connected wallet
  const linkCurrentWallet = useCallback(async (): Promise<boolean> => {
    if (!isConnected || !address) {
      setState(prev => ({ ...prev, error: 'Wallet not connected' }));
      return false;
    }

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setState(prev => ({ ...prev, error: 'Please log in first' }));
      return false;
    }

    // Check if wallet is already linked
    if (isCurrentWalletLinked()) {
      setState(prev => ({ ...prev, error: 'Wallet already linked' }));
      return false;
    }

    setState(prev => ({ ...prev, isLinking: true, error: null }));

    try {
      const walletClient = await getProvider();
      if (!walletClient) {
        throw new Error('Could not get wallet provider');
      }

      // Generate message with nonce and timestamp
      const nonce = generateNonce();
      const timestamp = Date.now();
      const message = `RocketSwap Wallet Verification\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

      logger.debug('Requesting signature for message:', message);

      // Request signature from wallet using wagmi WalletClient
      const signature = await walletClient.signMessage({
        account: walletClient.account!,
        message,
      });
      logger.debug('Got signature:', signature.substring(0, 20) + '...');

      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session');
      }

      // Call edge function to verify signature and link wallet
      const { data, error } = await supabase.functions.invoke('verify-wallet', {
        body: {
          signature,
          message,
          walletAddress: address,
        },
      });

      if (error) {
        logger.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to verify wallet');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Verification failed');
      }

      logger.info('Wallet linked successfully:', address);

      // Refresh the linked wallets list
      await fetchLinkedWallets();

      setState(prev => ({ ...prev, isLinking: false, error: null }));
      return true;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to link wallet';
      logger.error('Link wallet error:', err);
      setState(prev => ({ ...prev, isLinking: false, error: errorMessage }));
      return false;
    }
  }, [address, isConnected, getProvider, isCurrentWalletLinked, fetchLinkedWallets]);

  // Unlink a wallet
  const unlinkWallet = useCallback(async (walletAddress: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState(prev => ({ ...prev, error: 'Not authenticated' }));
        return false;
      }

      const { error } = await supabase
        .from('user_wallets')
        .delete()
        .eq('user_id', user.id)
        .eq('wallet_address', walletAddress.toLowerCase());

      if (error) {
        logger.error('Failed to unlink wallet:', error);
        setState(prev => ({ ...prev, error: error.message }));
        return false;
      }

      logger.info('Wallet unlinked:', walletAddress);
      await fetchLinkedWallets();
      return true;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unlink wallet';
      logger.error('Unlink wallet error:', err);
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [fetchLinkedWallets]);

  // Fetch wallets on mount and when auth state changes
  useEffect(() => {
    fetchLinkedWallets();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchLinkedWallets();
    });

    return () => subscription.unsubscribe();
  }, [fetchLinkedWallets]);

  return {
    ...state,
    isCurrentWalletLinked: isCurrentWalletLinked(),
    linkCurrentWallet,
    unlinkWallet,
    refreshWallets: fetchLinkedWallets,
  };
};
