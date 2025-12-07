// Admin Configuration
// This file contains admin wallet addresses and helper functions

// Admin wallets - both have equal rights for contract deployment and panel access
export const ADMIN_WALLETS = [
  '0x8b847bd369d2fdac7944e68277d6ba04aaeb38b8', // Primary admin
  '0x8334966329b7f4b459633696a8ca59118253bc89', // Secondary admin (security)
];

// Check if address is an admin
export const isAdmin = (address: string | null): boolean => {
  if (!address) return false;
  return ADMIN_WALLETS.some(
    wallet => wallet.toLowerCase() === address.toLowerCase()
  );
};

// Treasury wallet is the primary admin wallet
export const TREASURY_WALLET = ADMIN_WALLETS[0];

// Legacy export for backwards compatibility
export const ADMIN_WALLET = ADMIN_WALLETS[0];

// Protocol fee configuration
export const PROTOCOL_FEE_CONFIG = {
  lpShare: 75, // 75% goes to liquidity providers
  protocolShare: 25, // 25% goes to protocol treasury
};

// Contract addresses on OverProtocol Mainnet (to be filled after deployment)
export const CONTRACT_ADDRESSES = {
  factory: null as string | null,
  router: null as string | null,
  positionManager: null as string | null,
  quoter: null as string | null,
};

// Token addresses on OverProtocol Mainnet
export const TOKEN_ADDRESSES = {
  WOVER: '0x59c914C8ac6F212bb655737CC80d9Abc79A1e273',
  USDT: '0xA510432E4aa60B4acd476fb850EC84B7EE226b2d',
  USDC: '0x8712796136Ac8e0EEeC123251ef93702f265aa80',
};

// Fee tiers available (in hundredths of a bip, i.e., 1/100 of 0.01%)
export const FEE_TIERS = {
  LOWEST: 500,    // 0.05% - for stable pairs
  STANDARD: 3000, // 0.3% - standard fee tier
  HIGH: 10000,    // 1% - for exotic/volatile pairs
};

// Network configuration - OverProtocol Mainnet (from ChainList)
export const NETWORK_CONFIG = {
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
