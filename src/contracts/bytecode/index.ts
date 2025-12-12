// Uniswap V3 Contract Configuration
// 
// IMPORTANT: For deploying Uniswap V3 contracts on a new chain, use the official CLI tool:
// npx @uniswap/deploy-v3 --private-key YOUR_KEY --json-rpc https://rpc.overprotocol.com --weth9-address 0x59c914C8ac6F212bb655737CC80d9Abc79A1e273 --native-currency-label OVER --owner-address ADMIN_WALLET
//
// After deployment, enter the contract addresses in the Admin panel.

export type ContractId = 'factory' | 'router' | 'nftDescriptor' | 'positionManager' | 'quoter';

// Contract deployment order with dependencies
export const DEPLOYMENT_ORDER = [
  {
    id: 'factory' as ContractId,
    name: 'UniswapV3Factory',
    constructorArgs: [],
    dependencies: [],
    description: 'Creates and manages liquidity pools',
  },
  {
    id: 'router' as ContractId,
    name: 'SwapRouter',
    constructorArgs: ['factory', 'WOVER'],
    dependencies: ['factory'],
    description: 'Handles token swaps',
  },
  {
    id: 'nftDescriptor' as ContractId,
    name: 'NFTDescriptor',
    constructorArgs: [],
    dependencies: [],
    description: 'Generates NFT metadata',
  },
  {
    id: 'positionManager' as ContractId,
    name: 'NonfungiblePositionManager',
    constructorArgs: ['factory', 'WOVER', 'nftDescriptor'],
    dependencies: ['factory', 'nftDescriptor'],
    description: 'Manages LP NFT positions',
  },
  {
    id: 'quoter' as ContractId,
    name: 'QuoterV2',
    constructorArgs: ['factory', 'WOVER'],
    dependencies: ['factory'],
    description: 'Provides swap quotes without executing',
  },
];

// Fallback gas limits for each contract type (used when estimation fails)
export const FALLBACK_GAS_LIMITS: Record<ContractId, number> = {
  factory: 5_000_000,
  router: 4_500_000,
  nftDescriptor: 1_500_000,
  positionManager: 6_500_000,
  quoter: 3_500_000,
};

// CLI command for deploying Uniswap V3 contracts
export const getDeployCommand = (privateKey: string, ownerAddress: string) => `
npx @uniswap/deploy-v3 \\
  --private-key ${privateKey} \\
  --json-rpc https://rpc.overprotocol.com \\
  --weth9-address 0x59c914C8ac6F212bb655737CC80d9Abc79A1e273 \\
  --native-currency-label OVER \\
  --owner-address ${ownerAddress} \\
  --confirmations 2
`;
