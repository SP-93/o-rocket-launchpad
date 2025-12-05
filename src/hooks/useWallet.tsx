import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { getMetaMaskDeepLink, getOverWalletDeepLink } from './useMobileDetect';

interface WalletState {
  address: string | null;
  balance: string;
  chainId: number | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  walletType: 'metamask' | 'overwallet' | null;
}

interface WalletContextType extends WalletState {
  connect: (walletType: 'metamask' | 'overwallet') => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
  isConnecting: boolean;
  error: string | null;
  isMobile: boolean;
  openInWalletBrowser: (walletType: 'metamask' | 'overwallet') => void;
}

const OVER_PROTOCOL_MAINNET = {
  chainId: 541764,
  chainIdHex: '0x84444',
  chainName: 'OverProtocol Mainnet',
  nativeCurrency: {
    name: 'OVER',
    symbol: 'OVER',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.over.network'],
  blockExplorerUrls: ['https://www.overscan.net'],
};

const WalletContext = createContext<WalletContextType | null>(null);

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
      const chainIdNum = parseInt(chainId, 16);
      const isCorrectNetwork = chainIdNum === OVER_PROTOCOL_MAINNET.chainId;

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
    if (!state.walletType) return;

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

    const handleChainChanged = (chainId: string) => {
      const chainIdNum = parseInt(chainId, 16);
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
    const savedWallet = localStorage.getItem('walletConnected') as 'metamask' | 'overwallet' | null;
    if (savedWallet) {
      connect(savedWallet).catch(() => {
        localStorage.removeItem('walletConnected');
      });
    }
  }, []);

  return (
    <WalletContext.Provider value={{
      ...state,
      connect,
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
