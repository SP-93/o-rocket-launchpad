// Contract artifacts index
// Exports ABIs and bytecode loaders for all Uniswap V3 contracts

export { FACTORY_ABI, getFactoryBytecode } from './factory';
export { ROUTER_ABI, getRouterBytecode } from './router';
export { POSITION_MANAGER_ABI, getPositionManagerBytecode } from './positionManager';
export { QUOTER_ABI, getQuoterBytecode } from './quoter';
export { NFT_DESCRIPTOR_ABI, getNftDescriptorBytecode, stringToBytes32 } from './nftDescriptor';

import type { ContractId } from '../bytecode';

// Contract configuration with dependencies
export interface ContractConfig {
  id: ContractId;
  name: string;
  description: string;
  dependencies: ContractId[];
  estimatedGas: number;
}

export const CONTRACT_CONFIGS: Record<ContractId, ContractConfig> = {
  factory: {
    id: 'factory',
    name: 'UniswapV3Factory',
    description: 'Creates and manages liquidity pools',
    dependencies: [],
    estimatedGas: 5_000_000,
  },
  nftDescriptor: {
    id: 'nftDescriptor',
    name: 'NonfungibleTokenPositionDescriptor',
    description: 'Generates NFT metadata for positions',
    dependencies: [],
    estimatedGas: 3_500_000,
  },
  router: {
    id: 'router',
    name: 'SwapRouter',
    description: 'Handles token swaps',
    dependencies: ['factory'],
    estimatedGas: 4_500_000,
  },
  positionManager: {
    id: 'positionManager',
    name: 'NonfungiblePositionManager',
    description: 'Manages LP NFT positions',
    dependencies: ['factory', 'nftDescriptor'],
    estimatedGas: 6_500_000,
  },
  quoter: {
    id: 'quoter',
    name: 'QuoterV2',
    description: 'Provides swap quotes without executing',
    dependencies: ['factory'],
    estimatedGas: 3_500_000,
  },
};

// Get bytecode loader for a contract
export async function getBytecode(contractId: ContractId): Promise<string> {
  switch (contractId) {
    case 'factory':
      return (await import('./factory')).getFactoryBytecode();
    case 'router':
      return (await import('./router')).getRouterBytecode();
    case 'positionManager':
      return (await import('./positionManager')).getPositionManagerBytecode();
    case 'quoter':
      return (await import('./quoter')).getQuoterBytecode();
    case 'nftDescriptor':
      return (await import('./nftDescriptor')).getNftDescriptorBytecode();
    default:
      throw new Error(`Unknown contract: ${contractId}`);
  }
}

// Get ABI for a contract
export function getABI(contractId: ContractId): readonly object[] {
  switch (contractId) {
    case 'factory':
      return require('./factory').FACTORY_ABI;
    case 'router':
      return require('./router').ROUTER_ABI;
    case 'positionManager':
      return require('./positionManager').POSITION_MANAGER_ABI;
    case 'quoter':
      return require('./quoter').QUOTER_ABI;
    case 'nftDescriptor':
      return require('./nftDescriptor').NFT_DESCRIPTOR_ABI;
    default:
      throw new Error(`Unknown contract: ${contractId}`);
  }
}
