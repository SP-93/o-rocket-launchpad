// Centralized RPC Provider with fallback and retry logic
import { ethers } from 'ethers';
import logger from './logger';

// RPC endpoints with priority order
const RPC_ENDPOINTS = [
  'https://rpc.overprotocol.com',
  'https://wallet-dolphin.rpc.over.network', // Fallback
];

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

// Cache for working provider
let cachedProvider: ethers.providers.JsonRpcProvider | null = null;
let lastWorkingEndpoint: string | null = null;

/**
 * Get a working RPC provider with fallback support
 */
export const getProvider = async (): Promise<ethers.providers.JsonRpcProvider> => {
  // Return cached provider if still working
  if (cachedProvider && lastWorkingEndpoint) {
    try {
      await cachedProvider.getBlockNumber();
      return cachedProvider;
    } catch {
      // Cached provider failed, try to get a new one
      cachedProvider = null;
      lastWorkingEndpoint = null;
    }
  }

  // Try each endpoint
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(endpoint);
      await provider.getBlockNumber(); // Test connection
      
      cachedProvider = provider;
      lastWorkingEndpoint = endpoint;
      logger.info(`Connected to RPC: ${endpoint}`);
      return provider;
    } catch (error) {
      logger.warn(`RPC endpoint failed: ${endpoint}`, error);
      continue;
    }
  }

  // If all endpoints fail, throw error
  throw new Error('All RPC endpoints unavailable');
};

/**
 * Execute an RPC call with retry logic and exponential backoff
 */
export const executeWithRetry = async <T>(
  operation: (provider: ethers.providers.JsonRpcProvider) => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> => {
  let lastError: Error | null = null;
  let delay = INITIAL_RETRY_DELAY;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const provider = await getProvider();
      return await operation(provider);
    } catch (error) {
      lastError = error as Error;
      logger.warn(`RPC operation failed (attempt ${attempt + 1}/${retries}):`, error);

      // Clear cached provider on failure
      cachedProvider = null;
      lastWorkingEndpoint = null;

      // Wait before retry with exponential backoff
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }

  throw lastError || new Error('RPC operation failed after retries');
};

/**
 * Get a provider synchronously (for cases where async isn't possible)
 * Uses the last working endpoint or falls back to primary
 */
export const getProviderSync = (): ethers.providers.JsonRpcProvider => {
  const endpoint = lastWorkingEndpoint || RPC_ENDPOINTS[0];
  return new ethers.providers.JsonRpcProvider(endpoint);
};

/**
 * Get the current RPC status
 */
export const getRpcStatus = (): { endpoint: string | null; isConnected: boolean } => {
  return {
    endpoint: lastWorkingEndpoint,
    isConnected: cachedProvider !== null,
  };
};

/**
 * Reset the cached provider (useful for forcing reconnection)
 */
export const resetProvider = (): void => {
  cachedProvider = null;
  lastWorkingEndpoint = null;
};

/**
 * Get a proxied provider that routes through our edge function
 * This bypasses CORS issues when reading from browser
 */
export const getProxiedProvider = (): ethers.providers.JsonRpcProvider => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    logger.warn('Supabase env vars not set, falling back to direct RPC');
    return getProviderSync();
  }

  // Create custom provider that routes through edge function
  const proxyUrl = `${supabaseUrl}/functions/v1/rpc-proxy`;
  
  // Custom fetch connection with auth header
  const connection = {
    url: proxyUrl,
    headers: {
      'apikey': supabaseKey,
      'Content-Type': 'application/json',
    },
  };

  return new ethers.providers.JsonRpcProvider(connection);
};

export default {
  getProvider,
  executeWithRetry,
  getProviderSync,
  getProxiedProvider,
  getRpcStatus,
  resetProvider,
};
