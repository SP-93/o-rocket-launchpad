import { useCallback, useEffect, useRef } from 'react';
import { useAccount, useBalance, useDisconnect, useSwitchChain } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { getWalletClient } from '@wagmi/core';
import { wagmiConfig, overProtocol } from '@/config/web3modal';
import logger from '@/lib/logger';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export const useWallet = () => {
  const { address, isConnected, chainId } = useAccount();
  const { data: balanceData } = useBalance({ address });
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { open } = useWeb3Modal();
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isCorrectNetwork = chainId === overProtocol.id;
  const balance = balanceData?.formatted || '0';

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (isConnected) {
      inactivityTimerRef.current = setTimeout(() => {
        logger.log('Auto-disconnect due to inactivity');
        wagmiDisconnect();
      }, INACTIVITY_TIMEOUT);
    }
  }, [isConnected, wagmiDisconnect]);

  // Setup inactivity listeners
  useEffect(() => {
    if (!isConnected) return;

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    const handleActivity = () => resetInactivityTimer();
    
    events.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));
    resetInactivityTimer();

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [isConnected, resetInactivityTimer]);

  // Connect - opens Web3Modal
  const connect = useCallback(async () => {
    try {
      // Clear disconnect flag when user connects
      localStorage.removeItem('orocket_user_disconnected');
      await open();
    } catch (err: any) {
      logger.error('Connection error:', err);
      throw err;
    }
  }, [open]);

  // Disconnect
  const disconnect = useCallback(() => {
    // Set flag to prevent auto-reconnect
    localStorage.setItem('orocket_user_disconnected', 'true');
    wagmiDisconnect();
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    logger.log('Wallet disconnected - auto-reconnect disabled');
  }, [wagmiDisconnect]);

  // Switch network
  const switchNetwork = useCallback(async () => {
    try {
      switchChain({ chainId: overProtocol.id });
    } catch (err: any) {
      logger.error('Switch network error:', err);
      throw err;
    }
  }, [switchChain]);

  // Get provider for external use (ethers compatibility)
  const getProvider = useCallback(async () => {
    try {
      const client = await getWalletClient(wagmiConfig);
      return client;
    } catch {
      return null;
    }
  }, []);

  return {
    address: address || null,
    balance: parseFloat(balance).toFixed(4),
    chainId: chainId || null,
    isConnected,
    isCorrectNetwork,
    connect,
    disconnect,
    switchNetwork,
    getProvider,
    isConnecting: false, // Web3Modal handles this internally
    error: null, // Web3Modal handles errors internally
  };
};

// Legacy WalletProvider wrapper for compatibility (no-op, Web3Provider handles everything)
export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};
