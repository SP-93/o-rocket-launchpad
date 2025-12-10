import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './useWallet';
import logger from '@/lib/logger';
import { TOKEN_ADDRESSES } from '@/config/admin';
import { getDeployedContracts } from '@/contracts/storage';
import { priceToSqrtPriceX96, getTokenDecimals } from '@/lib/priceUtils';
import NonfungiblePositionManagerABI from '@/contracts/abis/NonfungiblePositionManager.json';

export interface PoolConfig {
  token0Symbol: string;
  token1Symbol: string;
  token0Address: string;
  token1Address: string;
  fee: number;
  initialPrice: number;
}

export interface PoolCreationStatus {
  poolName: string;
  status: 'idle' | 'creating' | 'created' | 'failed';
  txHash?: string;
  poolAddress?: string;
  error?: string;
}

export const usePoolCreation = () => {
  const { address } = useWallet();
  const [creationStatus, setCreationStatus] = useState<Record<string, PoolCreationStatus>>({});
  const [isCreating, setIsCreating] = useState(false);

  // Sort tokens by address (required by Uniswap V3)
  const sortTokens = (
    token0Address: string,
    token1Address: string,
    token0Symbol: string,
    token1Symbol: string,
    price: number
  ): { token0: string; token1: string; symbol0: string; symbol1: string; sortedPrice: number } => {
    if (token0Address.toLowerCase() < token1Address.toLowerCase()) {
      return {
        token0: token0Address,
        token1: token1Address,
        symbol0: token0Symbol,
        symbol1: token1Symbol,
        sortedPrice: price,
      };
    } else {
      return {
        token0: token1Address,
        token1: token0Address,
        symbol0: token1Symbol,
        symbol1: token0Symbol,
        sortedPrice: 1 / price,
      };
    }
  };

  // Create and initialize a pool
  const createPool = useCallback(async (config: PoolConfig): Promise<string | null> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      throw new Error('MetaMask not found');
    }

    const deployedContracts = getDeployedContracts();
    if (!deployedContracts.positionManager) {
      throw new Error('Position Manager not deployed');
    }

    const poolName = `${config.token0Symbol}/${config.token1Symbol}`;
    setIsCreating(true);
    setCreationStatus(prev => ({
      ...prev,
      [poolName]: { poolName, status: 'creating' },
    }));

    try {
      // Sort tokens
      const sorted = sortTokens(
        config.token0Address,
        config.token1Address,
        config.token0Symbol,
        config.token1Symbol,
        config.initialPrice
      );

      // Calculate sqrtPriceX96
      const token0Decimals = getTokenDecimals(sorted.symbol0);
      const token1Decimals = getTokenDecimals(sorted.symbol1);
      const sqrtPriceX96 = priceToSqrtPriceX96(sorted.sortedPrice, token0Decimals, token1Decimals);

      logger.log('Creating pool:', {
        token0: sorted.token0,
        token1: sorted.token1,
        fee: config.fee,
        sqrtPriceX96: sqrtPriceX96.toString(),
        originalPrice: config.initialPrice,
        sortedPrice: sorted.sortedPrice,
      });

      // Create provider and signer
      const provider = new ethers.providers.Web3Provider(ethereum);
      const signer = provider.getSigner();

      // Connect to Position Manager
      const positionManager = new ethers.Contract(
        deployedContracts.positionManager,
        NonfungiblePositionManagerABI.abi,
        signer
      );

      // Call createAndInitializePoolIfNecessary
      const tx = await positionManager.createAndInitializePoolIfNecessary(
        sorted.token0,
        sorted.token1,
        config.fee,
        sqrtPriceX96,
        { gasLimit: 5000000 }
      );

      setCreationStatus(prev => ({
        ...prev,
        [poolName]: { poolName, status: 'creating', txHash: tx.hash },
      }));

      logger.log('Transaction hash:', tx.hash);
      logger.log('Waiting for confirmation...');

      // Wait for transaction
      const receipt = await tx.wait();
      
      // Get pool address from Factory
      const factoryContract = new ethers.Contract(
        deployedContracts.factory!,
        ['function getPool(address,address,uint24) view returns (address)'],
        provider
      );
      
      const poolAddress = await factoryContract.getPool(sorted.token0, sorted.token1, config.fee);

      logger.log('Pool created at:', poolAddress);

      setCreationStatus(prev => ({
        ...prev,
        [poolName]: {
          poolName,
          status: 'created',
          txHash: tx.hash,
          poolAddress,
        },
      }));

      return poolAddress;
    } catch (error: any) {
      logger.error('Error creating pool:', error);
      
      setCreationStatus(prev => ({
        ...prev,
        [poolName]: {
          poolName,
          status: 'failed',
          error: error.message || 'Pool creation failed',
        },
      }));

      throw error;
    } finally {
      setIsCreating(false);
    }
  }, [address]);

  // Get status for a specific pool
  const getPoolStatus = useCallback((poolName: string): PoolCreationStatus | null => {
    return creationStatus[poolName] || null;
  }, [creationStatus]);

  return {
    createPool,
    creationStatus,
    isCreating,
    getPoolStatus,
  };
};
