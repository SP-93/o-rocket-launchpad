import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { cookieStorage, createStorage } from 'wagmi';
import { defineChain } from 'viem';

// Define OverProtocol as custom chain
export const overProtocol = defineChain({
  id: 54176,
  name: 'OverProtocol Mainnet',
  nativeCurrency: {
    name: 'OVER',
    symbol: 'OVER',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.overprotocol.com'] },
  },
  blockExplorers: {
    default: { name: 'OverScan', url: 'https://scan.over.network' },
  },
});

// WalletConnect Project ID
export const projectId = '9755572ea82a112d30546e15634811ca';

// Metadata
const metadata = {
  name: "O'Rocket DEX",
  description: 'Professional DeFi Platform on OverProtocol',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://orocket.dev',
  icons: ['/favicon.ico'],
};

// Chains
const chains = [overProtocol] as const;

// Create wagmi config
export const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
  ssr: false,
  storage: createStorage({
    storage: cookieStorage,
  }),
});

// Export chains for use elsewhere
export { chains };
