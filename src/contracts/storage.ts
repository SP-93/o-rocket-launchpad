// Contract Address Storage
// Manages deployed contract addresses using localStorage with security validation

import { secureStorage, validateContractAddresses, isValidAddress } from '@/lib/storageValidation';
import logger from '@/lib/logger';

export interface DeployedContracts {
  factory: string | null;
  router: string | null;
  nftDescriptor: string | null;
  positionManager: string | null;
  quoter: string | null;
}

export interface DeployedPools {
  [key: string]: string | null;
}

export interface DeploymentStatus {
  contractId: string;
  status: 'pending' | 'deploying' | 'deployed' | 'failed';
  txHash?: string;
  address?: string;
  error?: string;
  timestamp?: number;
}

const STORAGE_KEYS = {
  contracts: 'orocket_deployed_contracts',
  pools: 'orocket_deployed_pools',
  deploymentHistory: 'orocket_deployment_history',
};

const DEFAULT_CONTRACTS: DeployedContracts = {
  factory: null,
  router: null,
  nftDescriptor: null,
  positionManager: null,
  quoter: null,
};

// Storage validation state
let storageValidationFailed = false;

// Get storage validation status
export const isStorageValid = (): boolean => !storageValidationFailed;

// Get deployed contract addresses with validation
export const getDeployedContracts = (): DeployedContracts => {
  const { data, isValid } = secureStorage.getItem<DeployedContracts>(
    STORAGE_KEYS.contracts,
    DEFAULT_CONTRACTS
  );

  if (!isValid) {
    logger.warn('Contract storage validation failed - data may have been tampered with');
    storageValidationFailed = true;
    return DEFAULT_CONTRACTS;
  }

  // Additional address format validation
  const addressValidation = validateContractAddresses(data as unknown as Record<string, string | null>);
  if (!addressValidation.isValid) {
    logger.warn('Invalid contract addresses detected:', addressValidation.invalidAddresses);
    storageValidationFailed = true;
    return DEFAULT_CONTRACTS;
  }

  return data;
};

// Save a deployed contract address with validation
export const saveDeployedContract = (
  contractId: keyof DeployedContracts,
  address: string
): boolean => {
  // Validate address format before saving
  if (!isValidAddress(address)) {
    logger.error('Attempted to save invalid contract address:', contractId, address);
    return false;
  }

  const contracts = getDeployedContracts();
  contracts[contractId] = address;
  secureStorage.setItem(STORAGE_KEYS.contracts, contracts);
  storageValidationFailed = false;
  return true;
};

// Get deployed pool addresses with validation
export const getDeployedPools = (): DeployedPools => {
  const { data, isValid } = secureStorage.getItem<DeployedPools>(
    STORAGE_KEYS.pools,
    {}
  );

  if (!isValid) {
    logger.warn('Pool storage validation failed - data may have been tampered with');
    return {};
  }

  // Validate each pool address
  for (const [poolName, address] of Object.entries(data)) {
    if (address && !isValidAddress(address)) {
      logger.warn('Invalid pool address detected:', poolName);
      delete data[poolName];
    }
  }

  return data;
};

// Save a deployed pool address with validation
export const saveDeployedPool = (poolName: string, address: string): boolean => {
  if (!isValidAddress(address)) {
    logger.error('Attempted to save invalid pool address:', poolName, address);
    return false;
  }

  const pools = getDeployedPools();
  pools[poolName] = address;
  secureStorage.setItem(STORAGE_KEYS.pools, pools);
  return true;
};

// Get deployment history
export const getDeploymentHistory = (): DeploymentStatus[] => {
  const { data, isValid } = secureStorage.getItem<DeploymentStatus[]>(
    STORAGE_KEYS.deploymentHistory,
    []
  );

  if (!isValid) {
    logger.warn('Deployment history validation failed');
    return [];
  }

  return data;
};

// Add deployment to history
export const addDeploymentToHistory = (deployment: DeploymentStatus): void => {
  // Validate address if present
  if (deployment.address && !isValidAddress(deployment.address)) {
    logger.error('Attempted to add deployment with invalid address');
    return;
  }

  const history = getDeploymentHistory();
  const existingIndex = history.findIndex(h => h.contractId === deployment.contractId);
  if (existingIndex >= 0) {
    history[existingIndex] = deployment;
  } else {
    history.push(deployment);
  }
  secureStorage.setItem(STORAGE_KEYS.deploymentHistory, history);
};

// Clear all deployed data (for testing/reset)
export const clearAllDeployedData = (): void => {
  secureStorage.removeItem(STORAGE_KEYS.contracts);
  secureStorage.removeItem(STORAGE_KEYS.pools);
  secureStorage.removeItem(STORAGE_KEYS.deploymentHistory);
  storageValidationFailed = false;
};

// Check if a contract is deployed
export const isContractDeployed = (contractId: keyof DeployedContracts): boolean => {
  const contracts = getDeployedContracts();
  const address = contracts[contractId];
  return address !== null && isValidAddress(address);
};

// Check if all required contracts are deployed
export const areAllContractsDeployed = (): boolean => {
  const contracts = getDeployedContracts();
  return (
    isValidAddress(contracts.factory) &&
    isValidAddress(contracts.router) &&
    isValidAddress(contracts.positionManager) &&
    isValidAddress(contracts.quoter)
  );
};

// Update contract addresses manually (admin only)
export const updateContractAddress = (
  contractId: keyof DeployedContracts,
  address: string | null
): boolean => {
  if (address !== null && !isValidAddress(address)) {
    logger.error('Attempted to update with invalid address:', contractId, address);
    return false;
  }

  const contracts = getDeployedContracts();
  contracts[contractId] = address;
  secureStorage.setItem(STORAGE_KEYS.contracts, contracts);
  return true;
};

// Export all data (for backup)
export const exportDeploymentData = (): string => {
  return JSON.stringify({
    contracts: getDeployedContracts(),
    pools: getDeployedPools(),
    history: getDeploymentHistory(),
    exportedAt: new Date().toISOString(),
  }, null, 2);
};

// Import deployment data (for restore) - with validation
export const importDeploymentData = (jsonData: string): { success: boolean; error?: string } => {
  try {
    const data = JSON.parse(jsonData);
    
    // Validate contracts
    if (data.contracts) {
      const validation = validateContractAddresses(data.contracts);
      if (!validation.isValid) {
        return { 
          success: false, 
          error: `Invalid addresses: ${validation.invalidAddresses.join(', ')}` 
        };
      }
      secureStorage.setItem(STORAGE_KEYS.contracts, data.contracts);
    }
    
    // Validate pools
    if (data.pools) {
      for (const [poolName, address] of Object.entries(data.pools)) {
        if (address && !isValidAddress(address as string)) {
          return { success: false, error: `Invalid pool address: ${poolName}` };
        }
      }
      secureStorage.setItem(STORAGE_KEYS.pools, data.pools);
    }
    
    if (data.history) {
      // Validate history entries
      for (const entry of data.history) {
        if (entry.address && !isValidAddress(entry.address)) {
          return { success: false, error: `Invalid address in history: ${entry.contractId}` };
        }
      }
      secureStorage.setItem(STORAGE_KEYS.deploymentHistory, data.history);
    }
    
    storageValidationFailed = false;
    return { success: true };
  } catch (e) {
    logger.error('Error importing deployment data:', e);
    return { success: false, error: 'Invalid JSON format' };
  }
};

// Verify storage integrity (call on app load)
export const verifyStorageIntegrity = (): { 
  isValid: boolean; 
  issues: string[] 
} => {
  const issues: string[] = [];

  // Check contracts
  const { isValid: contractsValid } = secureStorage.getItem<DeployedContracts>(
    STORAGE_KEYS.contracts,
    DEFAULT_CONTRACTS
  );
  if (!contractsValid) {
    issues.push('Contract storage checksum mismatch');
  }

  // Check pools
  const { isValid: poolsValid } = secureStorage.getItem<DeployedPools>(
    STORAGE_KEYS.pools,
    {}
  );
  if (!poolsValid) {
    issues.push('Pool storage checksum mismatch');
  }

  // Check history
  const { isValid: historyValid } = secureStorage.getItem<DeploymentStatus[]>(
    STORAGE_KEYS.deploymentHistory,
    []
  );
  if (!historyValid) {
    issues.push('Deployment history checksum mismatch');
  }

  storageValidationFailed = issues.length > 0;
  
  return {
    isValid: issues.length === 0,
    issues,
  };
};
