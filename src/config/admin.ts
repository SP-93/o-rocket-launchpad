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

// ============================================================
// DEPLOYED CONTRACT ADDRESSES - OverProtocol Mainnet
// These are used by ALL users automatically (no manual import needed)
// Admin should update these after deploying contracts
// ============================================================
export const MAINNET_CONTRACTS = {
  factory: '0x7Ff6342b79926813E674732e88F39837FA8B64ed',
  router: '0xFd83B523C6281343FBCa163F7908bCC5874a245B',
  nftDescriptorLibrary: '0x0688dc5670dFc719cc0dAf0429382b3fb27fE274',
  nftDescriptor: '0x324910c4062f20e7E19e711B61c841F5eD032C14',
  positionManager: '0x7862fEdaa679712bD69402a61aA2063ad9DA3363',
  quoter: '0x4Db49b37aaC5978AB9CC476E887f0c290dE1ee54',
};

// DEPLOYED POOL ADDRESSES - OverProtocol Mainnet
export const MAINNET_POOLS: Record<string, string> = {
  'WOVER/USDT': '0x65d22Adf0DA92c31528dC38f3ff87ed221c01e77',
};

// Legacy export (deprecated - use MAINNET_CONTRACTS)
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
