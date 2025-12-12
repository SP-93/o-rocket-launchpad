// Uniswap V3 Contract Bytecodes - imported from official packages
import UniswapV3FactoryArtifact from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json';
import SwapRouterArtifact from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json';
import NonfungiblePositionManagerArtifact from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json';
import QuoterV2Artifact from '@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json';
import NFTDescriptorArtifact from '@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json';

// Export bytecodes
export const FACTORY_BYTECODE = UniswapV3FactoryArtifact.bytecode;
export const ROUTER_BYTECODE = SwapRouterArtifact.bytecode;
export const POSITION_MANAGER_BYTECODE = NonfungiblePositionManagerArtifact.bytecode;
export const QUOTER_BYTECODE = QuoterV2Artifact.bytecode;
export const NFT_DESCRIPTOR_BYTECODE = NFTDescriptorArtifact.bytecode;

// Export ABIs for convenience
export const FACTORY_ABI = UniswapV3FactoryArtifact.abi;
export const ROUTER_ABI = SwapRouterArtifact.abi;
export const POSITION_MANAGER_ABI = NonfungiblePositionManagerArtifact.abi;
export const QUOTER_ABI = QuoterV2Artifact.abi;
export const NFT_DESCRIPTOR_ABI = NFTDescriptorArtifact.abi;

// Contract deployment order with dependencies
export const DEPLOYMENT_ORDER = [
  {
    id: 'factory',
    name: 'UniswapV3Factory',
    bytecode: FACTORY_BYTECODE,
    abi: FACTORY_ABI,
    constructorArgs: [],
    dependencies: [],
  },
  {
    id: 'router',
    name: 'SwapRouter',
    bytecode: ROUTER_BYTECODE,
    abi: ROUTER_ABI,
    constructorArgs: ['factory', 'WOVER'],
    dependencies: ['factory'],
  },
  {
    id: 'nftDescriptor',
    name: 'NFTDescriptor',
    bytecode: NFT_DESCRIPTOR_BYTECODE,
    abi: NFT_DESCRIPTOR_ABI,
    constructorArgs: [],
    dependencies: [],
  },
  {
    id: 'positionManager',
    name: 'NonfungiblePositionManager',
    bytecode: POSITION_MANAGER_BYTECODE,
    abi: POSITION_MANAGER_ABI,
    constructorArgs: ['factory', 'WOVER', 'nftDescriptor'],
    dependencies: ['factory', 'nftDescriptor'],
  },
  {
    id: 'quoter',
    name: 'QuoterV2',
    bytecode: QUOTER_BYTECODE,
    abi: QUOTER_ABI,
    constructorArgs: ['factory', 'WOVER'],
    dependencies: ['factory'],
  },
];

export type ContractId = 'factory' | 'router' | 'nftDescriptor' | 'positionManager' | 'quoter';

// Fallback gas limits for each contract type (used when estimation fails)
export const FALLBACK_GAS_LIMITS: Record<ContractId, number> = {
  factory: 5_000_000,
  router: 4_500_000,
  nftDescriptor: 1_500_000,
  positionManager: 6_500_000,
  quoter: 3_500_000,
};
