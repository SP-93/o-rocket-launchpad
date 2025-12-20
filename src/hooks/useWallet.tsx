import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount, useBalance, useDisconnect, useSwitchChain } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { getWalletClient } from '@wagmi/core';
import { wagmiConfig, overProtocol } from '@/config/web3modal';
import logger from '@/lib/logger';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const NETWORK_CHECK_DELAY = 3000; // 3 seconds delay for mobile wallet chainId detection

export const useWallet = () => {
  const { address, isConnected, chainId } = useAccount();
  const { data: balanceData, refetch: refetchBalance } = useBalance({ 
    address,
    chainId: overProtocol.id, // Explicitly use Over Protocol chainId
  });
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { open } = useWeb3Modal();
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isNetworkCheckComplete, setIsNetworkCheckComplete] = useState(false);
  const [manualBalance, setManualBalance] = useState<string | null>(null);

  const rawIsCorrectNetwork = chainId === overProtocol.id;
  
  // Delay network check for mobile wallets that report wrong chainId initially
  useEffect(() => {
    if (isConnected) {
      setIsNetworkCheckComplete(false);
      const timer = setTimeout(() => {
        setIsNetworkCheckComplete(true);
      }, NETWORK_CHECK_DELAY);
      return () => clearTimeout(timer);
    } else {
      setIsNetworkCheckComplete(false);
    }
  }, [isConnected, chainId]);

  // Only show network warning after delay completes
  const isCorrectNetwork = !isNetworkCheckComplete || rawIsCorrectNetwork;

  // Refetch balance after connection stabilizes
  useEffect(() => {
    if (isConnected && address && refetchBalance) {
      const timer = setTimeout(() => {
        refetchBalance();
        logger.info('[Wallet] Refetching balance after connection stabilized');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isConnected, address, chainId, refetchBalance]);

  // Fallback: fetch balance manually if wagmi doesn't work
  useEffect(() => {
    const fetchManualBalance = async () => {
      if (isConnected && address && (!balanceData || balanceData.value === 0n)) {
        try {
          const { ethers } = await import('ethers');
          const provider = new ethers.providers.JsonRpcProvider(
            overProtocol.rpcUrls.default.http[0]
          );
          const rawBalance = await provider.getBalance(address);
          const formatted = ethers.utils.formatEther(rawBalance);
          setManualBalance(formatted);
          logger.info('[Wallet] Manual balance fetch succeeded:', formatted);
        } catch (err) {
          logger.error('[Wallet] Manual balance fetch failed:', err);
        }
      }
    };
    
    // Delay for mobile wallets
    const timer = setTimeout(fetchManualBalance, 2000);
    return () => clearTimeout(timer);
  }, [isConnected, address, balanceData]);

  // Debug logging
  useEffect(() => {
    if (isConnected) {
      logger.info('[Wallet] Connection state:', { 
        address, 
        chainId, 
        expectedChainId: overProtocol.id,
        balanceData: balanceData?.formatted,
        manualBalance,
      });
    }
  }, [isConnected, address, chainId, balanceData, manualBalance]);

  // Use balanceData if available, otherwise use manual fallback
  const finalBalance = balanceData?.formatted || manualBalance || '0';

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

  // Switch network - improved for mobile wallets
  const switchNetwork = useCallback(async () => {
    try {
      // Try wagmi switchChain first
      await switchChain({ chainId: overProtocol.id });
    } catch (err: any) {
      logger.error('Switch network error:', err);
      
      // If switchChain fails, try adding the network via wallet_addEthereumChain
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        try {
          await (window as any).ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${overProtocol.id.toString(16)}`,
              chainName: overProtocol.name,
              nativeCurrency: overProtocol.nativeCurrency,
              rpcUrls: [overProtocol.rpcUrls.default.http[0]],
              blockExplorerUrls: [overProtocol.blockExplorers.default.url],
            }],
          });
          return;
        } catch (addError: any) {
          logger.error('Add network error:', addError);
        }
      }
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
    balance: parseFloat(finalBalance).toFixed(4),
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
