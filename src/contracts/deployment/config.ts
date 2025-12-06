// Deployment Configuration for Uniswap V3 on OverProtocol
// All parameters needed for contract deployment

import { TOKEN_ADDRESSES, FEE_TIERS, NETWORK_CONFIG } from '@/config/admin';

// Deployment order and dependencies
export const DEPLOYMENT_STEPS = [
  {
    id: 'factory',
    name: 'UniswapV3Factory',
    description: 'Core factory contract for creating pools',
    dependencies: [],
    constructorArgs: [],
    estimatedGas: '5000000',
    estimatedGasOVER: '0.005', // ~0.005 OVER at 1 gwei
  },
  {
    id: 'router',
    name: 'SwapRouter',
    description: 'Router contract for executing swaps',
    dependencies: ['factory'],
    constructorArgs: ['factory', 'WETH9'],
    estimatedGas: '4500000',
    estimatedGasOVER: '0.0045',
  },
  {
    id: 'nftDescriptor',
    name: 'NFTDescriptor',
    description: 'Library for generating NFT token URIs',
    dependencies: [],
    constructorArgs: [],
    estimatedGas: '3000000',
    estimatedGasOVER: '0.003',
  },
  {
    id: 'positionManager',
    name: 'NonfungiblePositionManager',
    description: 'Manages liquidity positions as NFTs',
    dependencies: ['factory', 'nftDescriptor'],
    constructorArgs: ['factory', 'WETH9', 'nftDescriptor'],
    estimatedGas: '6000000',
    estimatedGasOVER: '0.006',
  },
  {
    id: 'quoter',
    name: 'QuoterV2',
    description: 'Contract for getting swap quotes',
    dependencies: ['factory'],
    constructorArgs: ['factory', 'WETH9'],
    estimatedGas: '3500000',
    estimatedGasOVER: '0.0035',
  },
];

// WETH address on OverProtocol (WOVER)
export const WETH9_ADDRESS = TOKEN_ADDRESSES.WOVER;

// Pool configurations to create after deployment
export const INITIAL_POOLS = [
  {
    name: 'USDT/USDC',
    token0: TOKEN_ADDRESSES.USDT,
    token1: TOKEN_ADDRESSES.USDC,
    fee: FEE_TIERS.STANDARD, // 0.3%
    initialPrice: '1.0', // 1:1 for stablecoins
    description: 'Stable pair for USDT/USDC trading',
  },
  {
    name: 'WOVER/USDC',
    token0: TOKEN_ADDRESSES.WOVER,
    token1: TOKEN_ADDRESSES.USDC,
    fee: FEE_TIERS.STANDARD, // 0.3%
    initialPrice: '0.5', // Example: 1 WOVER = 0.5 USDC
    description: 'Main trading pair for WOVER',
  },
  {
    name: 'WOVER/USDT',
    token0: TOKEN_ADDRESSES.WOVER,
    token1: TOKEN_ADDRESSES.USDT,
    fee: FEE_TIERS.STANDARD, // 0.3%
    initialPrice: '0.5', // Example: 1 WOVER = 0.5 USDT
    description: 'Alternative WOVER trading pair',
  },
];

// Fee tier configurations with tick spacing
export const FEE_TIER_CONFIG: Record<number, { fee: number; tickSpacing: number; label: string; description: string }> = {
  [FEE_TIERS.LOWEST]: {
    fee: FEE_TIERS.LOWEST,
    tickSpacing: 10,
    label: '0.05%',
    description: 'Best for stable pairs',
  },
  [FEE_TIERS.STANDARD]: {
    fee: FEE_TIERS.STANDARD,
    tickSpacing: 60,
    label: '0.3%',
    description: 'Standard fee tier',
  },
  [FEE_TIERS.HIGH]: {
    fee: FEE_TIERS.HIGH,
    tickSpacing: 200,
    label: '1%',
    description: 'For exotic/volatile pairs',
  },
};

// Helper function to calculate sqrtPriceX96 from price
export const priceToSqrtPriceX96 = (price: number): bigint => {
  const sqrtPrice = Math.sqrt(price);
  const Q96 = BigInt(2) ** BigInt(96);
  return BigInt(Math.floor(sqrtPrice * Number(Q96)));
};

// Network configuration for deployment
export const DEPLOYMENT_NETWORK = {
  ...NETWORK_CONFIG,
  confirmations: 2, // Wait for 2 confirmations
  gasMultiplier: 1.2, // Add 20% buffer to gas estimates
};

// Contract verification settings
export const VERIFICATION_CONFIG = {
  explorerApiUrl: 'https://api.overscan.net/api',
  // Add API key when available
  apiKey: '',
};
