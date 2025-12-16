import { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createWeb3Modal } from '@web3modal/wagmi/react';
import { wagmiConfig, projectId, overProtocol } from '@/config/web3modal';

// Create QueryClient
const queryClient = new QueryClient();

// Initialize Web3Modal IMMEDIATELY (not in useEffect)
// This ensures the modal is ready before any component tries to use it
createWeb3Modal({
  wagmiConfig,
  projectId,
  defaultChain: overProtocol,
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#0EA5E9',
    '--w3m-border-radius-master': '12px',
  },
  enableAnalytics: false,
  featuredWalletIds: [
    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
  ],
  includeWalletIds: undefined,
  allWallets: 'SHOW',
});

interface Web3ProviderProps {
  children: ReactNode;
}

export const Web3Provider = ({ children }: Web3ProviderProps) => {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
};
