import { ReactNode, useEffect, useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createWeb3Modal } from '@web3modal/wagmi/react';
import { wagmiConfig, projectId, overProtocol } from '@/config/web3modal';

// Create QueryClient
const queryClient = new QueryClient();

// Initialize Web3Modal
let modalInitialized = false;

const initializeModal = () => {
  if (modalInitialized) return;
  
  createWeb3Modal({
    wagmiConfig,
    projectId,
    defaultChain: overProtocol,
    themeMode: 'dark',
    themeVariables: {
      '--w3m-accent': '#0EA5E9',
      '--w3m-border-radius-master': '12px',
    },
    featuredWalletIds: [
      'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
    ],
    includeWalletIds: undefined, // Show all wallets
    allWallets: 'SHOW', // Show all available wallets
  });
  
  modalInitialized = true;
};

interface Web3ProviderProps {
  children: ReactNode;
}

export const Web3Provider = ({ children }: Web3ProviderProps) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initializeModal();
    setReady(true);
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
};
