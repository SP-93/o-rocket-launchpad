// Contract Address Storage
// Manages deployed contract addresses using localStorage with security validation
// Falls back to hardcoded addresses from config for all users
// CrashGame address also syncs from backend config

import { secureStorage, validateContractAddresses, isValidAddress } from '@/lib/storageValidation';
import { MAINNET_CONTRACTS, MAINNET_POOLS } from '@/config/admin';
import logger from '@/lib/logger';

export interface DeployedContracts {
  factory: string | null;
  router: string | null;
  nftDescriptorLibrary: string | null;
  nftDescriptor: string | null;
  positionManager: string | null;
  quoter: string | null;
  crashGame: string | null;
  ticketNFT: string | null;
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

// Get hardcoded contracts from config (available to all users)
const getHardcodedContracts = (): DeployedContracts => ({
  factory: MAINNET_CONTRACTS.factory || null,
  router: MAINNET_CONTRACTS.router || null,
  nftDescriptorLibrary: MAINNET_CONTRACTS.nftDescriptorLibrary || null,
  nftDescriptor: MAINNET_CONTRACTS.nftDescriptor || null,
  positionManager: MAINNET_CONTRACTS.positionManager || null,
  quoter: MAINNET_CONTRACTS.quoter || null,
  crashGame: null,
  ticketNFT: null,
});

// Get hardcoded pools from config (available to all users)
const getHardcodedPools = (): DeployedPools => {
  const pools: DeployedPools = {};
  for (const [key, value] of Object.entries(MAINNET_POOLS)) {
    if (value) pools[key] = value;
  }
  return pools;
};

const DEFAULT_CONTRACTS: DeployedContracts = {
  factory: null,
  router: null,
  nftDescriptorLibrary: null,
  nftDescriptor: null,
  positionManager: null,
  quoter: null,
  crashGame: null,
  ticketNFT: null,
};

// Storage validation state
let storageValidationFailed = false;

// Get storage validation status
export const isStorageValid = (): boolean => !storageValidationFailed;

// Merge hardcoded and localStorage contracts (HARDCODED takes priority for security)
// This prevents localStorage tampering from overriding deployed contract addresses
const mergeContracts = (hardcoded: DeployedContracts, stored: DeployedContracts): DeployedContracts => ({
  factory: hardcoded.factory || stored.factory,
  router: hardcoded.router || stored.router,
  nftDescriptorLibrary: hardcoded.nftDescriptorLibrary || stored.nftDescriptorLibrary,
  nftDescriptor: hardcoded.nftDescriptor || stored.nftDescriptor,
  positionManager: hardcoded.positionManager || stored.positionManager,
  quoter: hardcoded.quoter || stored.quoter,
  crashGame: stored.crashGame || hardcoded.crashGame,
  ticketNFT: stored.ticketNFT || hardcoded.ticketNFT,
});

// Get deployed contract addresses with validation
// Priority: localStorage > hardcoded config
export const getDeployedContracts = (): DeployedContracts => {
  const hardcoded = getHardcodedContracts();
  
  const { data, isValid } = secureStorage.getItem<DeployedContracts>(
    STORAGE_KEYS.contracts,
    DEFAULT_CONTRACTS
  );

  if (!isValid) {
    logger.warn('Contract storage validation failed - using hardcoded addresses');
    storageValidationFailed = true;
    return hardcoded;
  }

  // Additional address format validation
  const addressValidation = validateContractAddresses(data as unknown as Record<string, string | null>);
  if (!addressValidation.isValid) {
    logger.warn('Invalid contract addresses detected, using hardcoded:', addressValidation.invalidAddresses);
    storageValidationFailed = true;
    return hardcoded;
  }

  // Merge: hardcoded takes priority, localStorage only fills gaps
  return mergeContracts(hardcoded, data);
};

// Async version that fetches crashGame from backend if not in localStorage
export const getDeployedContractsAsync = async (): Promise<DeployedContracts> => {
  const contracts = getDeployedContracts();
  
  // If crashGame is missing, try to fetch from backend
  if (!contracts.crashGame) {
    try {
      // Dynamic import to avoid circular dependencies
      const { fetchCrashGameAddressFromBackend } = await import('@/lib/contractConfigSync');
      const backendAddress = await fetchCrashGameAddressFromBackend();
      
      if (backendAddress && isValidAddress(backendAddress)) {
        // Save to localStorage for future use
        contracts.crashGame = backendAddress;
        secureStorage.setItem(STORAGE_KEYS.contracts, contracts);
        logger.info('Synced crashGame address from backend:', backendAddress);
      }
    } catch (error) {
      logger.error('Failed to sync crashGame from backend:', error);
    }
  }
  
  return contracts;
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
// Priority: localStorage > hardcoded config
export const getDeployedPools = (): DeployedPools => {
  const hardcoded = getHardcodedPools();
  
  const { data, isValid } = secureStorage.getItem<DeployedPools>(
    STORAGE_KEYS.pools,
    {}
  );

  if (!isValid) {
    logger.warn('Pool storage validation failed - using hardcoded pools');
    return hardcoded;
  }

  // Validate each pool address
  for (const [poolName, address] of Object.entries(data)) {
    if (address && !isValidAddress(address)) {
      logger.warn('Invalid pool address detected:', poolName);
      delete data[poolName];
    }
  }

  // Merge: hardcoded takes priority, localStorage fills gaps
  return { ...data, ...hardcoded };
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

// Remove a deployed pool from storage (hide from UI)
// Note: This does NOT delete the pool from blockchain - pools are permanent
export const removeDeployedPool = (poolName: string): boolean => {
  const pools = getDeployedPools();
  if (!pools[poolName]) {
    logger.warn('Pool not found in storage:', poolName);
    return false;
  }

  delete pools[poolName];
  secureStorage.setItem(STORAGE_KEYS.pools, pools);
  logger.info(`Pool ${poolName} removed from UI storage (still exists on blockchain)`);
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

// Clear only CrashGame contract address (for redeploy)
export const clearCrashGameAddress = (): void => {
  const contracts = getDeployedContracts();
  contracts.crashGame = null;
  secureStorage.setItem(STORAGE_KEYS.contracts, contracts);
  logger.info('CrashGame address cleared from storage');
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
