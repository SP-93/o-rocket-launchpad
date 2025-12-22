import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@/hooks/useWallet';
import logger from '@/lib/logger';

interface AdminRoleState {
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Secure admin role check using database
 * Uses is_wallet_admin function which checks:
 * 1. Hardcoded admin wallets (factory + primary)
 * 2. Wallets linked to admin users in database
 */
export const useAdminRole = (): AdminRoleState => {
  const { address, isConnected } = useWallet();
  const [state, setState] = useState<AdminRoleState>({
    isAdmin: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const checkAdminRole = async () => {
      setState({ isAdmin: false, isLoading: true, error: null });

      if (!isConnected || !address) {
        setState({ isAdmin: false, isLoading: false, error: null });
        return;
      }

      try {
        const { data: isWalletAdmin, error: walletError } = await supabase.rpc('is_wallet_admin', {
          _wallet_address: address
        });

        if (walletError) {
          logger.error('useAdminRole: Error checking wallet admin:', walletError);
          setState({ isAdmin: false, isLoading: false, error: walletError.message });
          return;
        }

        logger.debug('useAdminRole: Admin check result:', { 
          walletAddress: address,
          isAdmin: isWalletAdmin === true
        });
        
        setState({ isAdmin: isWalletAdmin === true, isLoading: false, error: null });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error('useAdminRole: Exception:', err);
        setState({ isAdmin: false, isLoading: false, error: errorMessage });
      }
    };

    checkAdminRole();
  }, [address, isConnected]);

  return state;
};

/**
 * Legacy compatibility check - uses hardcoded wallets as fallback
 * WARNING: This should only be used during migration period
 * TODO: Remove after all admins are migrated to database roles
 */
export const useLegacyAdminCheck = (): boolean => {
  const { address } = useWallet();
  const LEGACY_ADMIN_WALLETS = [
    '0x8b847bd369d2fdac7944e68277d6ba04aaeb38b8',
    '0x8334966329b7f4b459633696a8ca59118253bc89',
  ];

  if (!address) return false;
  return LEGACY_ADMIN_WALLETS.some(
    wallet => wallet.toLowerCase() === address.toLowerCase()
  );
};
