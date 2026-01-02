import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@/hooks/useWallet';
import logger from '@/lib/logger';

interface AdminRoleState {
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  backendVerified: boolean;
  verificationSource: 'rpc' | 'backend' | 'legacy' | null;
}

/**
 * Secure admin role check using:
 * 1. Database RPC function (is_wallet_admin) - PRIMARY
 * 2. Backend Edge Function verification (check-admin) - SECONDARY (for extra security badge)
 * 
 * RPC check is sufficient for admin access. Backend verification is optional extra security.
 */
export const useAdminRole = (): AdminRoleState => {
  const { address, isConnected } = useWallet();
  const [state, setState] = useState<AdminRoleState>({
    isAdmin: false,
    isLoading: true,
    error: null,
    backendVerified: false,
    verificationSource: null,
  });

  useEffect(() => {
    const checkAdminRole = async () => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      if (!isConnected || !address) {
        setState({ isAdmin: false, isLoading: false, error: null, backendVerified: false, verificationSource: null });
        return;
      }

      try {
        // Step 1: Check via database RPC (this is the primary check)
        const { data: isWalletAdmin, error: walletError } = await supabase.rpc('is_wallet_admin', {
          _wallet_address: address
        });

        if (walletError) {
          logger.error('useAdminRole: RPC error:', walletError);
          // Don't fail completely - try legacy check
          const isLegacy = useLegacyAdminCheckSync(address);
          setState({ 
            isAdmin: isLegacy, 
            isLoading: false, 
            error: `RPC unavailable: ${walletError.message}`, 
            backendVerified: false,
            verificationSource: isLegacy ? 'legacy' : null
          });
          return;
        }

        if (!isWalletAdmin) {
          logger.debug('useAdminRole: RPC check - not admin');
          setState({ isAdmin: false, isLoading: false, error: null, backendVerified: false, verificationSource: null });
          return;
        }

        // RPC passed - user IS admin. Backend verification is optional extra.
        logger.debug('useAdminRole: RPC passed, wallet is admin');

        // Step 2: Try backend verification (optional - for extra security badge)
        try {
          const { data: backendData, error: backendError } = await supabase.functions.invoke('check-admin', {
            body: { wallet_address: address }
          });

          if (backendError) {
            logger.warn('useAdminRole: Backend verification unavailable:', backendError);
            // Still allow - RPC passed
            setState({ 
              isAdmin: true, 
              isLoading: false, 
              error: null, 
              backendVerified: false,
              verificationSource: 'rpc'
            });
            return;
          }

          const backendVerified = backendData?.isAdmin === true;
          
          logger.debug('useAdminRole: Full verification complete:', { 
            rpcAdmin: true,
            backendAdmin: backendVerified,
            source: backendData?.source
          });
          
          setState({ 
            isAdmin: true, // RPC passed, so they're admin
            isLoading: false, 
            error: null,
            backendVerified,
            verificationSource: backendVerified ? 'backend' : 'rpc'
          });
        } catch (backendErr) {
          // Backend failed but RPC passed - still admin
          logger.warn('useAdminRole: Backend call failed:', backendErr);
          setState({ 
            isAdmin: true, 
            isLoading: false, 
            error: null, 
            backendVerified: false,
            verificationSource: 'rpc'
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error('useAdminRole: Exception:', err);
        
        // Fallback to legacy check
        const isLegacy = useLegacyAdminCheckSync(address);
        setState({ 
          isAdmin: isLegacy, 
          isLoading: false, 
          error: isLegacy ? null : errorMessage, 
          backendVerified: false,
          verificationSource: isLegacy ? 'legacy' : null
        });
      }
    };

    checkAdminRole();
  }, [address, isConnected]);

  return state;
};

// Sync version of legacy check (used internally)
const useLegacyAdminCheckSync = (address: string | null): boolean => {
  const LEGACY_ADMIN_WALLETS = [
    '0x8b847bd369d2fdac7944e68277d6ba04aaeb38b8',
    '0x8334966329b7f4b459633696a8ca59118253bc89',
  ];

  if (!address) return false;
  return LEGACY_ADMIN_WALLETS.some(
    wallet => wallet.toLowerCase() === address.toLowerCase()
  );
};

/**
 * Legacy compatibility check - uses hardcoded wallets as fallback
 * WARNING: This should only be used during migration period
 */
export const useLegacyAdminCheck = (): boolean => {
  const { address } = useWallet();
  return useLegacyAdminCheckSync(address ?? null);
};
