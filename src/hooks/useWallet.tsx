import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react';
import logger from '@/lib/logger';

interface WalletState {
  address: string | null;
  balance: string;
  chainId: number | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
}

interface WalletContextType extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
  getProvider: () => any | null;
  isConnecting: boolean;
  error: string | null;
}

const OVER_PROTOCOL_MAINNET = {
  chainId: 54176,
  chainIdHex: '0xd3a0',
  chainName: 'OverProtocol Mainnet',
  nativeCurrency: {
    name: 'OVER',
    symbol: 'OVER',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.overprotocol.com'],
  blockExplorerUrls: ['https://scan.over.network'],
};

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

const WalletContext = createContext<WalletContextType | null>(null);

// Helper to normalize chainId
const normalizeChainId = (chainId: string | number | undefined | null): number => {
  if (chainId === undefined || chainId === null) return 0;
  if (typeof chainId === 'number') return chainId;
  if (typeof chainId === 'string') {
    if (chainId.startsWith('0x') || chainId.startsWith('0X')) {
      return parseInt(chainId, 16);
    }
    return parseInt(chainId, 10);
  }
  return 0;
};

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<WalletState>({
    address: null,
    balance: '0',
    chainId: null,
    isConnected: false,
    isCorrectNetwork: false,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const providerRef = useRef<any>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (state.isConnected) {
      inactivityTimerRef.current = setTimeout(() => {
        logger.log('Auto-disconnect due to inactivity');
        disconnectWallet();
      }, INACTIVITY_TIMEOUT);
    }
  }, [state.isConnected]);

  // Disconnect function
  const disconnectWallet = useCallback(async () => {
    // Disconnect WalletConnect provider
    if (providerRef.current) {
      try {
        await providerRef.current.disconnect();
      } catch (e) {
        logger.log('Provider disconnect error:', e);
      }
      providerRef.current = null;
    }

    // Clear all WalletConnect session data
    const wcKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('wc@') || key.startsWith('walletconnect') || key === 'walletConnected'
    );
    wcKeys.forEach(key => localStorage.removeItem(key));

    // Clear inactivity timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    // Reset state
    setState({
      address: null,
      balance: '0',
      chainId: null,
      isConnected: false,
      isCorrectNetwork: false,
    });
    setError(null);
    
    logger.log('Wallet disconnected');
  }, []);

  // Setup inactivity listeners
  useEffect(() => {
    if (!state.isConnected) return;

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
  }, [state.isConnected, resetInactivityTimer]);

  // Initialize provider and setup listeners
  const initProvider = useCallback(async (provider: any, address: string) => {
    providerRef.current = provider;

    // Get balance
    try {
      const balance = await provider.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      }) as string;
      const balanceInEther = parseInt(balance, 16) / 1e18;
      setState(prev => ({ ...prev, balance: balanceInEther.toFixed(4) }));
    } catch (err) {
      logger.error('Failed to get balance:', err);
    }

    // Listen for events
    provider.on('disconnect', () => {
      disconnectWallet();
    });

    provider.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        setState(prev => ({ ...prev, address: accounts[0] }));
      }
    });

    provider.on('chainChanged', (chainId: string | number) => {
      const chainIdNum = normalizeChainId(chainId);
      setState(prev => ({
        ...prev,
        chainId: chainIdNum,
        isCorrectNetwork: chainIdNum === OVER_PROTOCOL_MAINNET.chainId,
      }));
    });

    // Save connection
    localStorage.setItem('walletConnected', 'true');
  }, [disconnectWallet]);

  // Connect with WalletConnect
  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
      
      const provider = await EthereumProvider.init({
        projectId: '9755572ea82a112d30546e15634811ca',
        chains: [OVER_PROTOCOL_MAINNET.chainId],
        optionalChains: [1, 137],
        showQrModal: true,
        metadata: {
          name: "O'Rocket DEX",
          description: "Professional DeFi Platform on OverProtocol",
          url: window.location.origin,
          icons: [`${window.location.origin}/favicon.ico`],
        },
        rpcMap: {
          [OVER_PROTOCOL_MAINNET.chainId]: OVER_PROTOCOL_MAINNET.rpcUrls[0],
        },
      });

      await provider.connect();

      const accounts = provider.accounts;
      const chainId = provider.chainId;

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned');
      }

      const address = accounts[0];
      const chainIdNum = normalizeChainId(chainId);
      const isCorrectNetwork = chainIdNum === OVER_PROTOCOL_MAINNET.chainId;

      logger.log('Connected:', { address, chainIdNum, isCorrectNetwork });

      setState({
        address,
        balance: '0',
        chainId: chainIdNum,
        isConnected: true,
        isCorrectNetwork,
      });

      await initProvider(provider, address);

    } catch (err: any) {
      logger.error('Connection error:', err);
      setError(err.message || 'Failed to connect');
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [initProvider]);

  // Auto-reconnect existing session on mount
  useEffect(() => {
    const savedWallet = localStorage.getItem('walletConnected');
    if (!savedWallet) return;

    const reconnect = async () => {
      try {
        const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
        
        const provider = await EthereumProvider.init({
          projectId: '9755572ea82a112d30546e15634811ca',
          chains: [OVER_PROTOCOL_MAINNET.chainId],
          optionalChains: [1, 137],
          showQrModal: false, // Don't show QR on reconnect
          metadata: {
            name: "O'Rocket DEX",
            description: "Professional DeFi Platform on OverProtocol",
            url: window.location.origin,
            icons: [`${window.location.origin}/favicon.ico`],
          },
          rpcMap: {
            [OVER_PROTOCOL_MAINNET.chainId]: OVER_PROTOCOL_MAINNET.rpcUrls[0],
          },
        });

        // Check if there's an existing session
        if (provider.session) {
          const accounts = provider.accounts;
          const chainId = provider.chainId;

          if (accounts && accounts.length > 0) {
            const address = accounts[0];
            const chainIdNum = normalizeChainId(chainId);
            const isCorrectNetwork = chainIdNum === OVER_PROTOCOL_MAINNET.chainId;

            logger.log('Reconnected existing session:', { address, chainIdNum });

            setState({
              address,
              balance: '0',
              chainId: chainIdNum,
              isConnected: true,
              isCorrectNetwork,
            });

            await initProvider(provider, address);
            return;
          }
        }

        // No valid session found
        localStorage.removeItem('walletConnected');
      } catch (err) {
        logger.log('Auto-reconnect failed:', err);
        localStorage.removeItem('walletConnected');
      }
    };

    reconnect();
  }, [initProvider]);

  // Switch network
  const switchNetwork = useCallback(async () => {
    if (!providerRef.current) {
      setError('Please switch network in your wallet app');
      return;
    }

    try {
      await providerRef.current.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: OVER_PROTOCOL_MAINNET.chainIdHex }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await providerRef.current.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: OVER_PROTOCOL_MAINNET.chainIdHex,
              chainName: OVER_PROTOCOL_MAINNET.chainName,
              nativeCurrency: OVER_PROTOCOL_MAINNET.nativeCurrency,
              rpcUrls: OVER_PROTOCOL_MAINNET.rpcUrls,
              blockExplorerUrls: OVER_PROTOCOL_MAINNET.blockExplorerUrls,
            }],
          });
        } catch (addError) {
          setError('Failed to add OverProtocol network');
        }
      } else {
        setError('Please switch network in your wallet app');
      }
    }
  }, []);

  // Get provider for external use
  const getProvider = useCallback(() => {
    return providerRef.current;
  }, []);

  return (
    <WalletContext.Provider value={{
      ...state,
      connect,
      disconnect: disconnectWallet,
      switchNetwork,
      getProvider,
      isConnecting,
      error,
    }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
