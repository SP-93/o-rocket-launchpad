import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { getMetaMaskDeepLink, getOverWalletDeepLink } from './useMobileDetect';

interface WalletState {
  address: string | null;
  balance: string;
  chainId: number | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  walletType: 'metamask' | 'overwallet' | 'walletconnect' | null;
}

interface WalletContextType extends WalletState {
  connect: (walletType: 'metamask' | 'overwallet') => Promise<void>;
  connectWalletConnect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
  isConnecting: boolean;
  error: string | null;
  isMobile: boolean;
  openInWalletBrowser: (walletType: 'metamask' | 'overwallet') => void;
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

const WalletContext = createContext<WalletContextType | null>(null);

// Helper to normalize chainId (can come as hex string, decimal string, or number)
const normalizeChainId = (chainId: string | number | undefined | null): number => {
  if (chainId === undefined || chainId === null) return 0;
  
  if (typeof chainId === 'number') return chainId;
  
  if (typeof chainId === 'string') {
    // Handle hex format (0x...)
    if (chainId.startsWith('0x') || chainId.startsWith('0X')) {
      return parseInt(chainId, 16);
    }
    // Handle decimal string
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
    walletType: null,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const mobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    setIsMobile(mobile);
  }, []);

  // Open dApp in wallet's in-app browser
  const openInWalletBrowser = useCallback((walletType: 'metamask' | 'overwallet') => {
    if (walletType === 'metamask') {
      window.location.href = getMetaMaskDeepLink();
    } else {
      window.location.href = getOverWalletDeepLink();
    }
  }, []);

  const getProvider = (walletType: 'metamask' | 'overwallet') => {
    if (typeof window === 'undefined') return null;
    
    const ethereum = (window as any).ethereum;
    if (!ethereum) return null;

    if (walletType === 'overwallet') {
      // Check for OverWallet specific provider
      if (ethereum.isOverWallet) return ethereum;
      if (ethereum.providers) {
        return ethereum.providers.find((p: any) => p.isOverWallet);
      }
    }
    
    // MetaMask or default
    if (ethereum.isMetaMask) return ethereum;
    if (ethereum.providers) {
      return ethereum.providers.find((p: any) => p.isMetaMask);
    }
    
    return ethereum;
  };

  const updateBalance = useCallback(async (address: string, provider: any) => {
    try {
      const balance = await provider.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      });
      const balanceInEther = parseInt(balance, 16) / 1e18;
      setState(prev => ({ ...prev, balance: balanceInEther.toFixed(4) }));
    } catch (err) {
      console.error('Failed to get balance:', err);
    }
  }, []);

  const connect = useCallback(async (walletType: 'metamask' | 'overwallet') => {
    setIsConnecting(true);
    setError(null);

    try {
      const provider = getProvider(walletType);
      
      if (!provider) {
        const walletName = walletType === 'metamask' ? 'MetaMask' : 'OverWallet';
        throw new Error(`${walletName} not detected. Please install it first.`);
      }

      const accounts = await provider.request({
        method: 'eth_requestAccounts',
      });

      const chainId = await provider.request({
        method: 'eth_chainId',
      });

      const address = accounts[0];
      const chainIdNum = normalizeChainId(chainId);
      const isCorrectNetwork = chainIdNum === OVER_PROTOCOL_MAINNET.chainId;

      console.log('Connected:', { address, chainId, chainIdNum, expected: OVER_PROTOCOL_MAINNET.chainId, isCorrectNetwork });

      setState({
        address,
        balance: '0',
        chainId: chainIdNum,
        isConnected: true,
        isCorrectNetwork,
        walletType,
      });

      await updateBalance(address, provider);

      // Store connection info
      localStorage.setItem('walletConnected', walletType);
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [updateBalance]);

  // WalletConnect connection
  const connectWalletConnect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
      
      const provider = await EthereumProvider.init({
        projectId: 'b9e64431675dcf8a4d41d6a3b00c73c4', // WalletConnect Cloud Project ID
        chains: [OVER_PROTOCOL_MAINNET.chainId],
        optionalChains: [1, 137], // Ethereum, Polygon as fallbacks
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
        throw new Error('No accounts returned from WalletConnect');
      }

      const address = accounts[0];
      const chainIdNum = normalizeChainId(chainId);
      const isCorrectNetwork = chainIdNum === OVER_PROTOCOL_MAINNET.chainId;

      console.log('WalletConnect connected:', { address, chainId, chainIdNum, isCorrectNetwork });

      // Get balance
      const balance = await provider.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      }) as string;
      const balanceInEther = parseInt(balance, 16) / 1e18;

      setState({
        address,
        balance: balanceInEther.toFixed(4),
        chainId: chainIdNum,
        isConnected: true,
        isCorrectNetwork,
        walletType: 'walletconnect',
      });

      localStorage.setItem('walletConnected', 'walletconnect');

      // Listen for disconnect
      provider.on('disconnect', () => {
        setState({
          address: null,
          balance: '0',
          chainId: null,
          isConnected: false,
          isCorrectNetwork: false,
          walletType: null,
        });
        localStorage.removeItem('walletConnected');
      });

    } catch (err: any) {
      console.error('WalletConnect error:', err);
      setError(err.message || 'Failed to connect with WalletConnect');
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      address: null,
      balance: '0',
      chainId: null,
      isConnected: false,
      isCorrectNetwork: false,
      walletType: null,
    });
    localStorage.removeItem('walletConnected');
    setError(null);
  }, []);

  const switchNetwork = useCallback(async () => {
    if (!state.walletType) return;

    // For WalletConnect, we need different handling
    if (state.walletType === 'walletconnect') {
      setError('Please switch network in your wallet app');
      return;
    }

    const provider = getProvider(state.walletType);
    if (!provider) return;

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: OVER_PROTOCOL_MAINNET.chainIdHex }],
      });
    } catch (switchError: any) {
      // Chain not added, try to add it
      if (switchError.code === 4902) {
        try {
          await provider.request({
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
      }
    }
  }, [state.walletType]);

  // Listen for account and chain changes
  useEffect(() => {
    if (!state.walletType || state.walletType === 'walletconnect') return;

    const provider = getProvider(state.walletType);
    if (!provider) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        setState(prev => ({ ...prev, address: accounts[0] }));
        updateBalance(accounts[0], provider);
      }
    };

    const handleChainChanged = (chainId: string | number) => {
      const chainIdNum = normalizeChainId(chainId);
      console.log('Chain changed:', { raw: chainId, normalized: chainIdNum, expected: OVER_PROTOCOL_MAINNET.chainId });
      setState(prev => ({
        ...prev,
        chainId: chainIdNum,
        isCorrectNetwork: chainIdNum === OVER_PROTOCOL_MAINNET.chainId,
      }));
    };

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);

    return () => {
      provider.removeListener('accountsChanged', handleAccountsChanged);
      provider.removeListener('chainChanged', handleChainChanged);
    };
  }, [state.walletType, disconnect, updateBalance]);

  // Auto-reconnect on mount
  useEffect(() => {
    const savedWallet = localStorage.getItem('walletConnected') as 'metamask' | 'overwallet' | 'walletconnect' | null;
    if (savedWallet) {
      if (savedWallet === 'walletconnect') {
        // Don't auto-reconnect WalletConnect - requires user interaction
        localStorage.removeItem('walletConnected');
      } else {
        connect(savedWallet).catch(() => {
          localStorage.removeItem('walletConnected');
        });
      }
    }
  }, []);

  return (
    <WalletContext.Provider value={{
      ...state,
      connect,
      connectWalletConnect,
      disconnect,
      switchNetwork,
      isConnecting,
      error,
      isMobile,
      openInWalletBrowser,
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
