import { useState, useCallback } from 'react';
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

export interface DeploymentState {
  [key: string]: DeploymentStatus;
}

export const useContractDeployment = () => {
  const { address } = useWallet();
  const [deploymentState, setDeploymentState] = useState<DeploymentState>({});
  const [isDeploying, setIsDeploying] = useState(false);

  // Check if dependencies are met
  const checkDependencies = (contractId: ContractId): { met: boolean; missing: string[] } => {
    const contract = DEPLOYMENT_ORDER.find(c => c.id === contractId);
    if (!contract) return { met: false, missing: [] };

    const missing = (contract.dependencies as ContractId[]).filter(dep => !isContractDeployed(dep));
    
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

  // Save manually entered contract address
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
    saveContractAddress,
    deploymentState,
    isDeploying,
    getStatus,
    checkDependencies,
    loadSavedState,
    getDeployedContracts,
  };
};
