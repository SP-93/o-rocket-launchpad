import { useState, useCallback } from 'react';
import { ethers, ContractFactory } from 'ethers';
import { useWallet } from './useWallet';
import logger from '@/lib/logger';
import { ContractId, DEPLOYMENT_ORDER } from '@/contracts/bytecode';
import {
  DeploymentStatus,
  getDeployedContracts,
  saveDeployedContract,
  addDeploymentToHistory,
  isContractDeployed,
} from '@/contracts/storage';
import { TOKEN_ADDRESSES } from '@/config/admin';
import {
  FACTORY_ABI,
  ROUTER_ABI,
  POSITION_MANAGER_ABI,
  QUOTER_ABI,
  NFT_DESCRIPTOR_ABI,
  getBytecode,
  CONTRACT_CONFIGS,
  stringToBytes32,
} from '@/contracts/artifacts';

// WOVER address on OverProtocol
const WOVER_ADDRESS = TOKEN_ADDRESSES.WOVER;

export interface DeploymentState {
  [key: string]: DeploymentStatus;
}

// Get ethers provider from window.ethereum
const getEthersProvider = (): ethers.providers.Web3Provider | null => {
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    return null;
  }
  return new ethers.providers.Web3Provider((window as any).ethereum);
};

export const useContractDeployment = () => {
  const { address, isConnected, walletType } = useWallet();
  const [deploymentState, setDeploymentState] = useState<DeploymentState>({});
  const [isDeploying, setIsDeploying] = useState(false);

  // Check if dependencies are met
  const checkDependencies = useCallback((contractId: ContractId): { met: boolean; missing: string[] } => {
    const config = CONTRACT_CONFIGS[contractId];
    if (!config) return { met: false, missing: [] };

    const missing = config.dependencies.filter(dep => !isContractDeployed(dep));
    
    return {
      met: missing.length === 0,
      missing,
    };
  }, []);

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

  // Get constructor arguments for a contract
  const getConstructorArgs = useCallback((contractId: ContractId): any[] => {
    const deployedContracts = getDeployedContracts();
    
    switch (contractId) {
      case 'factory':
        return [];
      case 'nftDescriptor':
        // NonfungibleTokenPositionDescriptor(address _WETH9, bytes32 _nativeCurrencyLabelBytes)
        return [WOVER_ADDRESS, stringToBytes32('OVER')];
      case 'router':
        // SwapRouter(address _factory, address _WETH9)
        return [deployedContracts.factory!, WOVER_ADDRESS];
      case 'positionManager':
        // NonfungiblePositionManager(address _factory, address _WETH9, address _tokenDescriptor_)
        return [deployedContracts.factory!, WOVER_ADDRESS, deployedContracts.nftDescriptor!];
      case 'quoter':
        // QuoterV2(address _factory, address _WETH9)
        return [deployedContracts.factory!, WOVER_ADDRESS];
      default:
        return [];
    }
  }, []);

  // Get ABI for a contract
  const getABI = useCallback((contractId: ContractId): readonly object[] => {
    switch (contractId) {
      case 'factory': return FACTORY_ABI;
      case 'router': return ROUTER_ABI;
      case 'positionManager': return POSITION_MANAGER_ABI;
      case 'quoter': return QUOTER_ABI;
      case 'nftDescriptor': return NFT_DESCRIPTOR_ABI;
      default: throw new Error(`Unknown contract: ${contractId}`);
    }
  }, []);

  // Deploy a contract
  const deployContract = useCallback(async (contractId: ContractId): Promise<string> => {
    if (!isConnected || !address) {
      throw new Error('Wallet not connected');
    }

    const provider = getEthersProvider();
    if (!provider) {
      throw new Error('No Ethereum provider found');
    }

    // Check dependencies
    const deps = checkDependencies(contractId);
    if (!deps.met) {
      throw new Error(`Missing dependencies: ${deps.missing.join(', ')}`);
    }

    setIsDeploying(true);
    updateStatus(contractId, { status: 'deploying', timestamp: Date.now() });

    try {
      logger.log(`Deploying ${contractId}...`);
      
      // Get signer
      const signer = provider.getSigner();
      
      // Get bytecode and ABI
      const bytecode = await getBytecode(contractId);
      const abi = getABI(contractId);
      const constructorArgs = getConstructorArgs(contractId);
      
      logger.log(`Constructor args for ${contractId}:`, constructorArgs);
      
      // Create contract factory
      const factory = new ContractFactory(abi as any[], bytecode, signer);
      
      // Estimate gas with fallback
      let gasLimit: number;
      try {
        const deployTx = factory.getDeployTransaction(...constructorArgs);
        const estimated = await provider.estimateGas(deployTx);
        gasLimit = Math.ceil(estimated.toNumber() * 1.2); // 20% buffer
        logger.log(`Estimated gas for ${contractId}: ${gasLimit}`);
      } catch (e) {
        // Use fallback gas limit
        gasLimit = CONTRACT_CONFIGS[contractId].estimatedGas;
        logger.log(`Using fallback gas for ${contractId}: ${gasLimit}`);
      }
      
      // Deploy
      const contract = await factory.deploy(...constructorArgs, { gasLimit });
      
      logger.log(`${contractId} deployment tx: ${contract.deployTransaction.hash}`);
      updateStatus(contractId, { 
        status: 'deploying', 
        txHash: contract.deployTransaction.hash,
        timestamp: Date.now() 
      });
      
      // Wait for deployment
      await contract.deployed();
      
      const contractAddress = contract.address;
      logger.log(`${contractId} deployed at: ${contractAddress}`);
      
      // Save to storage
      saveDeployedContract(contractId, contractAddress);
      
      // Update status
      const finalStatus: DeploymentStatus = {
        contractId,
        status: 'deployed',
        address: contractAddress,
        txHash: contract.deployTransaction.hash,
        timestamp: Date.now(),
      };
      updateStatus(contractId, finalStatus);
      addDeploymentToHistory(finalStatus);

      return contractAddress;
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
  }, [isConnected, address, checkDependencies, updateStatus, getABI, getConstructorArgs]);

  // Save manually entered contract address (fallback method)
  const saveContractAddress = useCallback(async (contractId: ContractId, contractAddress: string): Promise<boolean> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      throw new Error('Invalid contract address format');
    }

    // Check dependencies
    const deps = checkDependencies(contractId);
    if (!deps.met) {
      throw new Error(`Missing dependencies: ${deps.missing.join(', ')}`);
    }

    setIsDeploying(true);
    updateStatus(contractId, { status: 'deploying', timestamp: Date.now() });

    try {
      // Verify it's a contract (optional - check if code exists)
      const provider = getEthersProvider();
      if (provider) {
        const code = await provider.getCode(contractAddress);
        if (code === '0x' || code === '0x0') {
          throw new Error('Address is not a contract (no code found)');
        }
      }

      // Save to storage
      saveDeployedContract(contractId, contractAddress);
      
      // Update status
      const finalStatus: DeploymentStatus = {
        contractId,
        status: 'deployed',
        address: contractAddress,
        timestamp: Date.now(),
      };
      updateStatus(contractId, finalStatus);
      addDeploymentToHistory(finalStatus);

      logger.log(`${contractId} address saved: ${contractAddress}`);
      return true;
    } catch (error: any) {
      logger.error(`Error saving ${contractId}:`, error);
      
      const errorStatus: DeploymentStatus = {
        contractId,
        status: 'failed',
        error: error.message || 'Failed to save address',
        timestamp: Date.now(),
      };
      updateStatus(contractId, errorStatus);
      addDeploymentToHistory(errorStatus);

      throw error;
    } finally {
      setIsDeploying(false);
    }
  }, [address, checkDependencies, updateStatus]);

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
    saveContractAddress,
    deploymentState,
    isDeploying,
    getStatus,
    checkDependencies,
    loadSavedState,
    getDeployedContracts,
  };
};
