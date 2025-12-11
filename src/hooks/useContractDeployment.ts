import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './useWallet';
import logger from '@/lib/logger';
import { TOKEN_ADDRESSES } from '@/config/admin';
import {
  FACTORY_BYTECODE,
  ROUTER_BYTECODE,
  POSITION_MANAGER_BYTECODE,
  QUOTER_BYTECODE,
  NFT_DESCRIPTOR_BYTECODE,
  ContractId,
} from '@/contracts/bytecode';
import {
  DeployedContracts,
  DeploymentStatus,
  getDeployedContracts,
  saveDeployedContract,
  addDeploymentToHistory,
  isContractDeployed,
} from '@/contracts/storage';
import UniswapV3FactoryABI from '@/contracts/abis/UniswapV3Factory.json';
import SwapRouterABI from '@/contracts/abis/SwapRouter.json';
import NonfungiblePositionManagerABI from '@/contracts/abis/NonfungiblePositionManager.json';
import QuoterV2ABI from '@/contracts/abis/QuoterV2.json';

// NFTDescriptor has minimal ABI - just for deployment
const NFTDescriptorABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  }
];

export interface DeploymentState {
  [key: string]: DeploymentStatus;
}

export const useContractDeployment = () => {
  const { address } = useWallet();
  const [deploymentState, setDeploymentState] = useState<DeploymentState>({});
  const [isDeploying, setIsDeploying] = useState(false);

  // Get contract config by ID
  const getContractConfig = (contractId: ContractId) => {
    const configs: Record<ContractId, { abi: any; bytecode: string; name: string }> = {
      factory: {
        abi: UniswapV3FactoryABI,
        bytecode: FACTORY_BYTECODE,
        name: 'UniswapV3Factory',
      },
      router: {
        abi: SwapRouterABI,
        bytecode: ROUTER_BYTECODE,
        name: 'SwapRouter',
      },
      nftDescriptor: {
        abi: NFTDescriptorABI,
        bytecode: NFT_DESCRIPTOR_BYTECODE,
        name: 'NFTDescriptor',
      },
      positionManager: {
        abi: NonfungiblePositionManagerABI,
        bytecode: POSITION_MANAGER_BYTECODE,
        name: 'NonfungiblePositionManager',
      },
      quoter: {
        abi: QuoterV2ABI,
        bytecode: QUOTER_BYTECODE,
        name: 'QuoterV2',
      },
    };
    return configs[contractId];
  };

  // Get constructor arguments for a contract
  const getConstructorArgs = (contractId: ContractId): any[] => {
    const deployedContracts = getDeployedContracts();
    
    switch (contractId) {
      case 'factory':
        return [];
      case 'router':
        if (!deployedContracts.factory) throw new Error('Factory must be deployed first');
        return [deployedContracts.factory, TOKEN_ADDRESSES.WOVER];
      case 'nftDescriptor':
        return [];
      case 'positionManager':
        if (!deployedContracts.factory) throw new Error('Factory must be deployed first');
        if (!deployedContracts.nftDescriptor) throw new Error('NFTDescriptor must be deployed first');
        return [deployedContracts.factory, TOKEN_ADDRESSES.WOVER, deployedContracts.nftDescriptor];
      case 'quoter':
        if (!deployedContracts.factory) throw new Error('Factory must be deployed first');
        return [deployedContracts.factory, TOKEN_ADDRESSES.WOVER];
      default:
        return [];
    }
  };

  // Check if dependencies are met
  const checkDependencies = (contractId: ContractId): { met: boolean; missing: string[] } => {
    const dependencies: Record<ContractId, ContractId[]> = {
      factory: [],
      router: ['factory'],
      nftDescriptor: [],
      positionManager: ['factory', 'nftDescriptor'],
      quoter: ['factory'],
    };

    const required = dependencies[contractId] || [];
    const missing = required.filter(dep => !isContractDeployed(dep));
    
    return {
      met: missing.length === 0,
      missing,
    };
  };

  // Update deployment status
  const updateStatus = useCallback((contractId: string, status: Partial<DeploymentStatus>) => {
    setDeploymentState(prev => ({
      ...prev,
      [contractId]: {
        ...prev[contractId],
        contractId,
        ...status,
      } as DeploymentStatus,
    }));
  }, []);

  // Deploy a contract
  const deployContract = useCallback(async (contractId: ContractId): Promise<string | null> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      throw new Error('MetaMask not found');
    }

    // Check dependencies
    const deps = checkDependencies(contractId);
    if (!deps.met) {
      throw new Error(`Missing dependencies: ${deps.missing.join(', ')}`);
    }

    // Check if already deployed
    if (isContractDeployed(contractId)) {
      const contracts = getDeployedContracts();
      return contracts[contractId];
    }

    setIsDeploying(true);
    updateStatus(contractId, { status: 'deploying', timestamp: Date.now() });

    try {
      const config = getContractConfig(contractId);
      const constructorArgs = getConstructorArgs(contractId);

      // Create provider and signer
      const provider = new ethers.providers.Web3Provider(ethereum);
      const signer = provider.getSigner();

      // Create contract factory
      const factory = new ethers.ContractFactory(
        config.abi,
        config.bytecode,
        signer
      );

      // Estimate gas
      const deployTx = factory.getDeployTransaction(...constructorArgs);
      const estimatedGas = await provider.estimateGas(deployTx);
      const gasPrice = await provider.getGasPrice();
      
      logger.log(`Deploying ${config.name}...`);
      logger.log(`Estimated gas: ${estimatedGas.toString()}`);
      logger.log(`Gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);
      logger.debug(`Constructor args:`, constructorArgs);

      // Deploy contract
      const contract = await factory.deploy(...constructorArgs, {
        gasLimit: estimatedGas.mul(120).div(100), // Add 20% buffer
      });

      updateStatus(contractId, { 
        status: 'deploying', 
        txHash: contract.deployTransaction.hash 
      });

      logger.log(`Transaction hash: ${contract.deployTransaction.hash}`);
      logger.log('Waiting for confirmation...');

      // Wait for deployment
      await contract.deployed();

      const deployedAddress = contract.address;
      logger.log(`${config.name} deployed at: ${deployedAddress}`);

      // Save to storage
      saveDeployedContract(contractId, deployedAddress);
      
      // Update status
      const finalStatus: DeploymentStatus = {
        contractId,
        status: 'deployed',
        txHash: contract.deployTransaction.hash,
        address: deployedAddress,
        timestamp: Date.now(),
      };
      updateStatus(contractId, finalStatus);
      addDeploymentToHistory(finalStatus);

      return deployedAddress;
    } catch (error: any) {
      logger.error(`Error deploying ${contractId}:`, error);
      
      const errorStatus: DeploymentStatus = {
        contractId,
        status: 'failed',
        error: error.message || 'Deployment failed',
        timestamp: Date.now(),
      };
      updateStatus(contractId, errorStatus);
      addDeploymentToHistory(errorStatus);

      throw error;
    } finally {
      setIsDeploying(false);
    }
  }, [address, updateStatus]);

  // Get current deployment status for a contract
  const getStatus = useCallback((contractId: ContractId): DeploymentStatus | null => {
    return deploymentState[contractId] || null;
  }, [deploymentState]);

  // Load saved deployment state
  const loadSavedState = useCallback(() => {
    const contracts = getDeployedContracts();
    const newState: DeploymentState = {};

    (Object.keys(contracts) as ContractId[]).forEach(contractId => {
      if (contracts[contractId]) {
        newState[contractId] = {
          contractId,
          status: 'deployed',
          address: contracts[contractId]!,
        };
      }
    });

    setDeploymentState(newState);
  }, []);

  return {
    deployContract,
    deploymentState,
    isDeploying,
    getStatus,
    checkDependencies,
    loadSavedState,
    getDeployedContracts,
  };
};
