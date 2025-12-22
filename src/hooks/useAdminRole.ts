import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@/hooks/useWallet';
import logger from '@/lib/logger';

interface AdminRoleState {
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  backendVerified: boolean;
}

/**
 * Secure admin role check using BOTH:
 * 1. Database RPC function (is_wallet_admin)
 * 2. Backend Edge Function verification (check-admin)
 * 
 * Both must pass for full admin access
 */
export const useAdminRole = (): AdminRoleState => {
  const { address, isConnected } = useWallet();
  const [state, setState] = useState<AdminRoleState>({
    isAdmin: false,
    isLoading: true,
    error: null,
    backendVerified: false,
  });

  useEffect(() => {
    const checkAdminRole = async () => {
      setState({ isAdmin: false, isLoading: true, error: null, backendVerified: false });

      if (!isConnected || !address) {
        setState({ isAdmin: false, isLoading: false, error: null, backendVerified: false });
        return;
      }

      try {
        // Step 1: Check via database RPC
        const { data: isWalletAdmin, error: walletError } = await supabase.rpc('is_wallet_admin', {
          _wallet_address: address
        });

        if (walletError) {
          logger.error('useAdminRole: RPC error:', walletError);
          setState({ isAdmin: false, isLoading: false, error: walletError.message, backendVerified: false });
          return;
        }

        if (!isWalletAdmin) {
          logger.debug('useAdminRole: RPC check failed - not admin');
          setState({ isAdmin: false, isLoading: false, error: null, backendVerified: false });
          return;
        }

        // Step 2: Verify via backend Edge Function
        logger.debug('useAdminRole: RPC passed, verifying with backend...');
        
        const { data: backendData, error: backendError } = await supabase.functions.invoke('check-admin', {
          body: { wallet_address: address }
        });

        if (backendError) {
          logger.error('useAdminRole: Backend verification error:', backendError);
          // Still allow if RPC passed but backend failed (graceful degradation)
          setState({ 
            isAdmin: true, 
            isLoading: false, 
            error: 'Backend verification unavailable', 
            backendVerified: false 
          });
          return;
        }

        const backendVerified = backendData?.isAdmin === true;
        
        logger.debug('useAdminRole: Full verification complete:', { 
          walletAddress: address,
          rpcAdmin: true,
          backendAdmin: backendVerified,
          verifiedAt: backendData?.verifiedAt
        });
        
        setState({ 
          isAdmin: isWalletAdmin && backendVerified, 
          isLoading: false, 
          error: null,
          backendVerified 
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error('useAdminRole: Exception:', err);
        setState({ isAdmin: false, isLoading: false, error: errorMessage, backendVerified: false });
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
