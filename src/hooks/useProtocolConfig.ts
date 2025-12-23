import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  MAINNET_CONTRACTS, 
  TOKEN_ADDRESSES, 
  MAINNET_POOLS, 
  NETWORK_CONFIG, 
  PROTOCOL_FEE_CONFIG,
  ADMIN_WALLETS,
  TREASURY_WALLET 
} from '@/config/admin';

// Types for protocol configuration
export interface ProtocolContracts {
  factory: string;
  router: string;
  nftDescriptorLibrary: string;
  nftDescriptor: string;
  positionManager: string;
  quoter: string;
}

export interface TokenAddresses {
  WOVER: string;
  USDT: string;
  USDC: string;
}

export interface NetworkConfig {
  chainId: number;
  chainIdHex: string;
  chainName: string;
  rpcUrls: string[];
  blockExplorerUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface FeeConfig {
  lpShare: number;
  protocolShare: number;
  feeProtocol: number;
  defaultFeeProtocol: number;
}

export interface AdminWallets {
  primary: string;
  secondary: string;
  treasury: string;
}

export interface ProtocolConfig {
  contracts: ProtocolContracts;
  tokens: TokenAddresses;
  pools: Record<string, string>;
  network: NetworkConfig;
  fees: FeeConfig;
  adminWallets: AdminWallets;
}

// Cache configuration
const CACHE_KEY = 'orocket_protocol_config';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CachedConfig {
  config: ProtocolConfig;
  timestamp: number;
}

// Hardcoded fallback configuration
const FALLBACK_CONFIG: ProtocolConfig = {
  contracts: MAINNET_CONTRACTS as ProtocolContracts,
  tokens: TOKEN_ADDRESSES as TokenAddresses,
  pools: MAINNET_POOLS,
  network: NETWORK_CONFIG as NetworkConfig,
  fees: {
    ...PROTOCOL_FEE_CONFIG,
    defaultFeeProtocol: PROTOCOL_FEE_CONFIG.feeProtocol,
  },
  adminWallets: {
    primary: ADMIN_WALLETS[0],
    secondary: ADMIN_WALLETS[1],
    treasury: TREASURY_WALLET,
  },
};

// Get cached config from localStorage
function getCachedConfig(): ProtocolConfig | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const { config, timestamp }: CachedConfig = JSON.parse(cached);
    const isExpired = Date.now() - timestamp > CACHE_DURATION;
    
    if (isExpired) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    return config;
  } catch {
    return null;
  }
}

// Save config to cache
function setCachedConfig(config: ProtocolConfig): void {
  try {
    const cached: CachedConfig = {
      config,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Ignore storage errors
  }
}

// Transform backend response to ProtocolConfig
function transformBackendConfig(backendData: Record<string, any>): ProtocolConfig {
  const config = { ...FALLBACK_CONFIG };
  
  if (backendData.mainnet_contracts?.value) {
    config.contracts = backendData.mainnet_contracts.value;
  }
  
  if (backendData.token_addresses?.value) {
    config.tokens = backendData.token_addresses.value;
  }
  
  if (backendData.mainnet_pools?.value) {
    config.pools = backendData.mainnet_pools.value;
  }
  
  if (backendData.network_config?.value) {
    config.network = backendData.network_config.value;
  }
  
  if (backendData.fee_config?.value) {
    config.fees = backendData.fee_config.value;
  }
  
  if (backendData.admin_wallets?.value) {
    config.adminWallets = backendData.admin_wallets.value;
  }
  
  return config;
}

export function useProtocolConfig() {
  const [config, setConfig] = useState<ProtocolConfig>(FALLBACK_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFromBackend, setIsFromBackend] = useState(false);

  const fetchConfig = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = getCachedConfig();
      if (cached) {
        setConfig(cached);
        setIsFromBackend(true);
        setIsLoading(false);
        return;
      }
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-protocol-config', {
        body: {},
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.success && data?.config) {
        const transformedConfig = transformBackendConfig(data.config);
        setConfig(transformedConfig);
        setCachedConfig(transformedConfig);
        setIsFromBackend(true);
        
        if (data.warnings?.length > 0) {
          console.warn('Protocol config warnings:', data.warnings);
        }
      } else {
        throw new Error(data?.error || 'Failed to fetch configuration');
      }
    } catch (err: any) {
      console.warn('Failed to fetch protocol config from backend, using fallback:', err.message);
      setConfig(FALLBACK_CONFIG);
      setIsFromBackend(false);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Refetch function for manual refresh
  const refetch = useCallback(() => {
    return fetchConfig(true);
  }, [fetchConfig]);

  // Clear cache
  const clearCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    setConfig(FALLBACK_CONFIG);
    setIsFromBackend(false);
  }, []);

  return {
    config,
    isLoading,
    error,
    isFromBackend,
    refetch,
    clearCache,
    // Convenience accessors
    contracts: config.contracts,
    tokens: config.tokens,
    pools: config.pools,
    network: config.network,
    fees: config.fees,
    adminWallets: config.adminWallets,
  };
}

// Hook for updating protocol config (admin only)
export function useProtocolConfigUpdate() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const updateConfig = useCallback(async (
    walletAddress: string,
    configKey: string,
    configValue: any,
    action: 'update' | 'insert' | 'delete' = 'update',
    options?: { description?: string; is_public?: boolean }
  ) => {
    setIsUpdating(true);
    setUpdateError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('update-protocol-config', {
        body: {
          wallet_address: walletAddress,
          config_key: configKey,
          config_value: configValue,
          action,
          ...options,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Update failed');
      }

      // Clear cache after successful update
      localStorage.removeItem(CACHE_KEY);

      return { success: true, data: data.data };
    } catch (err: any) {
      console.error('Protocol config update failed:', err);
      setUpdateError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return {
    updateConfig,
    isUpdating,
    updateError,
  };
}
