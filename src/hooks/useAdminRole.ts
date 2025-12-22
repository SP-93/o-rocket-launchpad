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
 * Checks both:
 * 1. user_roles table (Supabase auth user has admin role)
 * 2. is_wallet_admin function (connected wallet belongs to admin user)
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
      // Reset state when wallet changes
      setState({ isAdmin: false, isLoading: true, error: null });

      if (!isConnected || !address) {
        setState({ isAdmin: false, isLoading: false, error: null });
        return;
      }

      try {
        // First check: Is the connected wallet linked to an admin user?
        const { data: isWalletAdmin, error: walletError } = await supabase.rpc('is_wallet_admin', {
          _wallet_address: address
        });

        if (walletError) {
          logger.error('useAdminRole: Error checking wallet admin:', walletError);
          // Continue to check Supabase auth
        }

        if (isWalletAdmin === true) {
          logger.debug('useAdminRole: Wallet is admin via is_wallet_admin:', address);
          setState({ isAdmin: true, isLoading: false, error: null });
          return;
        }

        // Second check: Is the current Supabase user an admin?
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          logger.debug('useAdminRole: No authenticated user, wallet not admin');
          setState({ isAdmin: false, isLoading: false, error: null });
          return;
        }

        // Query the user_roles table using the is_admin function
        const { data: isUserAdmin, error: userError } = await supabase.rpc('is_admin', {
          _user_id: user.id
        });

        if (userError) {
          logger.error('useAdminRole: Error checking user admin role:', userError);
          setState({ isAdmin: false, isLoading: false, error: userError.message });
          return;
        }

        const isAdmin = isUserAdmin === true;
        logger.debug('useAdminRole: Admin check result:', { 
          userId: user.id, 
          walletAddress: address,
          isWalletAdmin,
          isUserAdmin: isAdmin 
        });
        
        setState({ isAdmin, isLoading: false, error: null });
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
