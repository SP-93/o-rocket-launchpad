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
  FACTORY_ABI,
  ROUTER_ABI,
  POSITION_MANAGER_ABI,
  QUOTER_ABI,
  NFT_DESCRIPTOR_ABI,
  FALLBACK_GAS_LIMITS,
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

export interface DeploymentState {
  [key: string]: DeploymentStatus;
}

export const useContractDeployment = () => {
  const { address } = useWallet();
  const [deploymentState, setDeploymentState] = useState<DeploymentState>({});
  const [isDeploying, setIsDeploying] = useState(false);

  // Get contract config by ID - using ABIs directly from bytecode imports
  const getContractConfig = (contractId: ContractId) => {
    const configs: Record<ContractId, { abi: any; bytecode: string; name: string }> = {
      factory: {
        abi: FACTORY_ABI,
        bytecode: FACTORY_BYTECODE,
        name: 'UniswapV3Factory',
      },
      router: {
        abi: ROUTER_ABI,
        bytecode: ROUTER_BYTECODE,
        name: 'SwapRouter',
      },
      nftDescriptor: {
        abi: NFT_DESCRIPTOR_ABI,
        bytecode: NFT_DESCRIPTOR_BYTECODE,
        name: 'NFTDescriptor',
      },
      positionManager: {
        abi: POSITION_MANAGER_ABI,
        bytecode: POSITION_MANAGER_BYTECODE,
        name: 'NonfungiblePositionManager',
      },
      quoter: {
        abi: QUOTER_ABI,
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

  // Deploy a contract with improved error handling
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

      // Validate bytecode
      if (!config.bytecode || config.bytecode.length < 100) {
        throw new Error(`Invalid bytecode for ${config.name}. Bytecode is missing or too short.`);
      }

      // Validate ABI
      if (!config.abi || !Array.isArray(config.abi)) {
        throw new Error(`Invalid ABI for ${config.name}. ABI must be an array.`);
      }

      logger.log(`Bytecode length for ${config.name}: ${config.bytecode.length} characters`);
      logger.log(`ABI entries for ${config.name}: ${config.abi.length}`);

      // Create provider and signer
      const provider = new ethers.providers.Web3Provider(ethereum);
      const signer = provider.getSigner();

      // Create contract factory
      const factory = new ethers.ContractFactory(
        config.abi,
        config.bytecode,
        signer
      );

      // Estimate gas with fallback
      let gasLimit: ethers.BigNumber;
      const deployTx = factory.getDeployTransaction(...constructorArgs);
      
      try {
        const estimatedGas = await provider.estimateGas(deployTx);
        gasLimit = estimatedGas.mul(130).div(100); // Add 30% buffer
        logger.log(`Estimated gas: ${estimatedGas.toString()}`);
      } catch (gasError: any) {
        // Use fallback gas limit
        gasLimit = ethers.BigNumber.from(FALLBACK_GAS_LIMITS[contractId]);
        logger.warn(`Gas estimation failed, using fallback: ${gasLimit.toString()}`);
        logger.warn(`Gas estimation error: ${gasError.message}`);
      }

      const gasPrice = await provider.getGasPrice();
      
      logger.log(`Deploying ${config.name}...`);
      logger.log(`Gas limit: ${gasLimit.toString()}`);
      logger.log(`Gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);
      logger.debug(`Constructor args:`, constructorArgs);

      // Deploy contract
      const contract = await factory.deploy(...constructorArgs, {
        gasLimit,
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
      
      // Parse error for better user feedback
      let errorMessage = error.message || 'Deployment failed';
      
      if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
        errorMessage = 'Gas estimation failed. This may indicate an issue with the contract bytecode or constructor arguments.';
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        errorMessage = 'Insufficient OVER balance for gas fees.';
      } else if (error.code === 4001) {
        errorMessage = 'Transaction rejected by user.';
      } else if (error.message?.includes('execution reverted')) {
        errorMessage = `Contract execution reverted: ${error.reason || 'Unknown reason'}`;
      }

      const errorStatus: DeploymentStatus = {
        contractId,
        status: 'failed',
        error: errorMessage,
        timestamp: Date.now(),
      };
      updateStatus(contractId, errorStatus);
      addDeploymentToHistory(errorStatus);

      throw new Error(errorMessage);
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
