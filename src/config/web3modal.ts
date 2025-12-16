import { createConfig, http } from 'wagmi';
import { reconnect } from '@wagmi/core';
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors';
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

// Create wagmi config with EXPLICIT connectors
export const wagmiConfig = createConfig({
  chains,
  connectors: [
    injected({ shimDisconnect: false }), // Disabled to prevent auto-reconnect after disconnect
    walletConnect({ 
      projectId, 
      metadata,
      showQrModal: false,
    }),
    coinbaseWallet({ 
      appName: metadata.name,
    }),
  ],
  transports: {
    [overProtocol.id]: http('https://rpc.overprotocol.com'),
  },
});

// CRITICAL: Auto-reconnect wallet on page load ONLY if user didn't explicitly disconnect
if (typeof window !== 'undefined') {
  const wasDisconnected = localStorage.getItem('orocket_user_disconnected');
  if (wasDisconnected !== 'true') {
    reconnect(wagmiConfig);
  }
}

// Export chains for use elsewhere
export { chains };
