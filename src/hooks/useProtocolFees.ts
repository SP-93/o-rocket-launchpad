import { useState, useCallback } from 'react';
import { ethers, BigNumber } from 'ethers';
import { useWalletClient } from 'wagmi';
import { MAINNET_POOLS, TOKEN_ADDRESSES, TREASURY_WALLET, FEE_PROTOCOL_OPTIONS } from '@/config/admin';
import UniswapV3PoolABI from '@/contracts/abis/UniswapV3Pool.json';
import { logger } from '@/lib/logger';
import { overProtocol } from '@/config/web3modal';

// Max uint128 for collecting all fees
const MAX_UINT128 = BigNumber.from(2).pow(128).sub(1);

export interface PoolFeeStatus {
  poolAddress: string;
  poolName: string;
  feeProtocol0: number;
  feeProtocol1: number;
  isActive: boolean;
  currentPercentage: number;
  token0Address: string;
  token1Address: string;
}

export interface AccumulatedFees {
  token0Amount: string;
  token1Amount: string;
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
}

// Helper to get token symbol from address
const getTokenSymbol = (address: string): string => {
  const addressLower = address.toLowerCase();
  if (addressLower === TOKEN_ADDRESSES.WOVER.toLowerCase()) return 'WOVER';
  if (addressLower === TOKEN_ADDRESSES.USDT.toLowerCase()) return 'USDT';
  if (addressLower === TOKEN_ADDRESSES.USDC.toLowerCase()) return 'USDC';
  return address.slice(0, 6) + '...';
};

// Helper to get token decimals
const getTokenDecimals = (address: string): number => {
  const addressLower = address.toLowerCase();
  if (addressLower === TOKEN_ADDRESSES.USDT.toLowerCase()) return 6;
  if (addressLower === TOKEN_ADDRESSES.USDC.toLowerCase()) return 6;
  return 18; // Default for WOVER and most tokens
};

// Helper to get ethers signer from wallet client
const getEthersSigner = async (walletClient: any): Promise<ethers.Signer | null> => {
  if (!walletClient) return null;
  
  const { account, chain, transport } = walletClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new ethers.providers.Web3Provider(transport, network);
  return provider.getSigner(account.address);
};

// Helper to get read-only provider
const getReadProvider = (): ethers.providers.JsonRpcProvider => {
  return new ethers.providers.JsonRpcProvider(overProtocol.rpcUrls.default.http[0]);
};

export const useProtocolFees = () => {
  const { data: walletClient } = useWalletClient();
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get fee status for a specific pool (read-only, no wallet needed)
  const getPoolFeeStatus = useCallback(async (poolAddress: string, poolName: string): Promise<PoolFeeStatus | null> => {
    try {
      const provider = getReadProvider();
      const poolContract = new ethers.Contract(poolAddress, UniswapV3PoolABI, provider);
      
      // Get slot0 for fee protocol status
      const slot0 = await poolContract.slot0();
      const feeProtocol = slot0.feeProtocol;
      
      // feeProtocol is packed: lower 4 bits for token0, upper 4 bits for token1
      const feeProtocol0 = feeProtocol & 0x0F;
      const feeProtocol1 = (feeProtocol >> 4) & 0x0F;
      
      // Get token addresses
      const token0Address = await poolContract.token0();
      const token1Address = await poolContract.token1();
      
      const isActive = feeProtocol0 > 0 || feeProtocol1 > 0;
      const currentPercentage = feeProtocol0 > 0 ? Math.round(100 / feeProtocol0) : 0;

      logger.info('Pool fee status:', {
        poolAddress,
        feeProtocol0,
        feeProtocol1,
        isActive,
        currentPercentage
      });

      return {
        poolAddress,
        poolName,
        feeProtocol0,
        feeProtocol1,
        isActive,
        currentPercentage,
        token0Address,
        token1Address
      };
    } catch (err) {
      logger.error('Failed to get pool fee status:', err);
      return null;
    }
  }, []);

  // Get accumulated protocol fees for a pool (read-only)
  const getAccumulatedFees = useCallback(async (poolAddress: string): Promise<AccumulatedFees | null> => {
    try {
      const provider = getReadProvider();
      const poolContract = new ethers.Contract(poolAddress, UniswapV3PoolABI, provider);
      
      // Get protocol fees
      const [token0Fees, token1Fees] = await poolContract.protocolFees();
      
      // Get token addresses
      const token0Address = await poolContract.token0();
      const token1Address = await poolContract.token1();
      
      const token0Symbol = getTokenSymbol(token0Address);
      const token1Symbol = getTokenSymbol(token1Address);
      const token0Decimals = getTokenDecimals(token0Address);
      const token1Decimals = getTokenDecimals(token1Address);

      logger.info('Accumulated fees:', {
        token0: ethers.utils.formatUnits(token0Fees, token0Decimals),
        token1: ethers.utils.formatUnits(token1Fees, token1Decimals)
      });

      return {
        token0Amount: ethers.utils.formatUnits(token0Fees, token0Decimals),
        token1Amount: ethers.utils.formatUnits(token1Fees, token1Decimals),
        token0Symbol,
        token1Symbol,
        token0Decimals,
        token1Decimals
      };
    } catch (err) {
      logger.error('Failed to get accumulated fees:', err);
      return null;
    }
  }, []);

  // Activate or change protocol fee for a pool (requires wallet)
  const activateProtocolFee = useCallback(async (
    poolAddress: string, 
    feeProtocolValue: number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> => {
    try {
      if (!walletClient) {
        throw new Error('Wallet not connected');
      }

      setIsActivating(true);
      setError(null);

      const signer = await getEthersSigner(walletClient);
      if (!signer) {
        throw new Error('Failed to get signer');
      }

      const poolContract = new ethers.Contract(poolAddress, UniswapV3PoolABI, signer);
      
      logger.info('Activating protocol fee:', {
        poolAddress,
        feeProtocol: feeProtocolValue,
        protocolShare: feeProtocolValue > 0 ? Math.round(100 / feeProtocolValue) : 0
      });

      // Call setFeeProtocol - same value for both tokens
      const tx = await poolContract.setFeeProtocol(feeProtocolValue, feeProtocolValue);
      
      logger.info('Protocol fee transaction sent:', tx.hash);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      logger.info('Protocol fee activated:', receipt.transactionHash);

      return {
        success: true,
        txHash: receipt.transactionHash
      };
    } catch (err: any) {
      const errorMessage = err.reason || err.message || 'Failed to activate protocol fee';
      logger.error('Failed to activate protocol fee:', err);
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsActivating(false);
    }
  }, [walletClient]);

  // Collect accumulated protocol fees (requires wallet)
  const collectProtocolFees = useCallback(async (
    poolAddress: string,
    recipient: string = TREASURY_WALLET
  ): Promise<{ 
    success: boolean; 
    txHash?: string; 
    amount0?: string;
    amount1?: string;
    error?: string 
  }> => {
    try {
      if (!walletClient) {
        throw new Error('Wallet not connected');
      }

      setIsCollecting(true);
      setError(null);

      const signer = await getEthersSigner(walletClient);
      if (!signer) {
        throw new Error('Failed to get signer');
      }

      const poolContract = new ethers.Contract(poolAddress, UniswapV3PoolABI, signer);
      
      // Get token info for formatting
      const token0Address = await poolContract.token0();
      const token1Address = await poolContract.token1();
      const token0Decimals = getTokenDecimals(token0Address);
      const token1Decimals = getTokenDecimals(token1Address);

      logger.info('Collecting protocol fees:', {
        poolAddress,
        recipient
      });

      // Collect all fees - use MAX_UINT128 to collect everything
      const tx = await poolContract.collectProtocol(
        recipient,
        MAX_UINT128,
        MAX_UINT128
      );
      
      logger.info('Collect fees transaction sent:', tx.hash);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      // Parse events to get collected amounts
      let amount0 = '0';
      let amount1 = '0';
      
      // Look for CollectProtocol event
      const collectEvent = receipt.events?.find((e: any) => e.event === 'CollectProtocol');
      if (collectEvent && collectEvent.args) {
        amount0 = ethers.utils.formatUnits(collectEvent.args.amount0 || 0, token0Decimals);
        amount1 = ethers.utils.formatUnits(collectEvent.args.amount1 || 0, token1Decimals);
      }

      logger.info('Fees collected:', {
        txHash: receipt.transactionHash,
        amount0,
        amount1
      });

      return {
        success: true,
        txHash: receipt.transactionHash,
        amount0,
        amount1
      };
    } catch (err: any) {
      const errorMessage = err.reason || err.message || 'Failed to collect fees';
      logger.error('Failed to collect protocol fees:', err);
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsCollecting(false);
    }
  }, [walletClient]);

  // Get all pools fee status
  const getAllPoolsFeeStatus = useCallback(async (): Promise<PoolFeeStatus[]> => {
    setIsLoading(true);
    const statuses: PoolFeeStatus[] = [];
    
    try {
      for (const [poolName, poolAddress] of Object.entries(MAINNET_POOLS)) {
        const status = await getPoolFeeStatus(poolAddress, poolName);
        if (status) {
          statuses.push(status);
        }
      }
    } catch (err) {
      logger.error('Failed to get all pools fee status:', err);
    } finally {
      setIsLoading(false);
    }
    
    return statuses;
  }, [getPoolFeeStatus]);

  // Get fee option label from feeProtocol value
  const getFeeOptionLabel = (feeProtocolValue: number): string => {
    const option = FEE_PROTOCOL_OPTIONS.find(opt => opt.feeProtocol === feeProtocolValue);
    return option ? option.label : `Custom (${feeProtocolValue > 0 ? Math.round(100 / feeProtocolValue) : 0}%)`;
  };

  return {
    getPoolFeeStatus,
    getAccumulatedFees,
    activateProtocolFee,
    collectProtocolFees,
    getAllPoolsFeeStatus,
    getFeeOptionLabel,
    isLoading,
    isActivating,
    isCollecting,
    error
  };
};
