// Contract Address Storage
// Manages deployed contract addresses using localStorage

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

// Get deployed contract addresses
export const getDeployedContracts = (): DeployedContracts => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.contracts);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading deployed contracts:', e);
  }
  return {
    factory: null,
    router: null,
    nftDescriptor: null,
    positionManager: null,
    quoter: null,
  };
};

// Save a deployed contract address
export const saveDeployedContract = (
  contractId: keyof DeployedContracts,
  address: string
): void => {
  const contracts = getDeployedContracts();
  contracts[contractId] = address;
  localStorage.setItem(STORAGE_KEYS.contracts, JSON.stringify(contracts));
};

// Get deployed pool addresses
export const getDeployedPools = (): DeployedPools => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.pools);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading deployed pools:', e);
  }
  return {};
};

// Save a deployed pool address
export const saveDeployedPool = (poolName: string, address: string): void => {
  const pools = getDeployedPools();
  pools[poolName] = address;
  localStorage.setItem(STORAGE_KEYS.pools, JSON.stringify(pools));
};

// Get deployment history
export const getDeploymentHistory = (): DeploymentStatus[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.deploymentHistory);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading deployment history:', e);
  }
  return [];
};

// Add deployment to history
export const addDeploymentToHistory = (deployment: DeploymentStatus): void => {
  const history = getDeploymentHistory();
  // Update existing or add new
  const existingIndex = history.findIndex(h => h.contractId === deployment.contractId);
  if (existingIndex >= 0) {
    history[existingIndex] = deployment;
  } else {
    history.push(deployment);
  }
  localStorage.setItem(STORAGE_KEYS.deploymentHistory, JSON.stringify(history));
};

// Clear all deployed data (for testing/reset)
export const clearAllDeployedData = (): void => {
  localStorage.removeItem(STORAGE_KEYS.contracts);
  localStorage.removeItem(STORAGE_KEYS.pools);
  localStorage.removeItem(STORAGE_KEYS.deploymentHistory);
};

// Check if a contract is deployed
export const isContractDeployed = (contractId: keyof DeployedContracts): boolean => {
  const contracts = getDeployedContracts();
  return contracts[contractId] !== null;
};

// Check if all required contracts are deployed
export const areAllContractsDeployed = (): boolean => {
  const contracts = getDeployedContracts();
  return (
    contracts.factory !== null &&
    contracts.router !== null &&
    contracts.positionManager !== null &&
    contracts.quoter !== null
  );
};

// Update contract addresses manually (admin only)
export const updateContractAddress = (
  contractId: keyof DeployedContracts,
  address: string | null
): void => {
  const contracts = getDeployedContracts();
  contracts[contractId] = address;
  localStorage.setItem(STORAGE_KEYS.contracts, JSON.stringify(contracts));
};

// Export all data (for backup)
export const exportDeploymentData = (): string => {
  return JSON.stringify({
    contracts: getDeployedContracts(),
    pools: getDeployedPools(),
    history: getDeploymentHistory(),
  }, null, 2);
};

// Import deployment data (for restore)
export const importDeploymentData = (jsonData: string): boolean => {
  try {
    const data = JSON.parse(jsonData);
    if (data.contracts) {
      localStorage.setItem(STORAGE_KEYS.contracts, JSON.stringify(data.contracts));
    }
    if (data.pools) {
      localStorage.setItem(STORAGE_KEYS.pools, JSON.stringify(data.pools));
    }
    if (data.history) {
      localStorage.setItem(STORAGE_KEYS.deploymentHistory, JSON.stringify(data.history));
    }
    return true;
  } catch (e) {
    console.error('Error importing deployment data:', e);
    return false;
  }
};
