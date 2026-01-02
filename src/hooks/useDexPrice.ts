// Hook za dobijanje WOVER cene sa DEX-a (iz liquidity pool-a)
import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { MAINNET_POOLS, TOKEN_ADDRESSES } from '@/config/admin';
import logger from '@/lib/logger';

// Pool ABI za čitanje cene
const POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
];

// ERC20 ABI za decimale
const ERC20_ABI = [
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
];

// Cache za DEX cenu (60 sekundi)
const CACHE_DURATION_MS = 60 * 1000;
let cachedPrice: { price: number; timestamp: number; metadata: DexPriceMetadata } | null = null;

export interface DexPriceMetadata {
  poolAddress: string;
  token0Address: string;
  token1Address: string;
  token0Decimals: number;
  token1Decimals: number;
  token0Symbol: string;
  token1Symbol: string;
  isWoverToken0: boolean;
  sqrtPriceX96: string;
  rawPrice: number;
  lastUpdated: Date;
}

export interface DexPriceResult {
  dexPrice: number | null;
  isLoading: boolean;
  error: string | null;
  refetch: (force?: boolean) => Promise<number | null>;
  lastUpdated: Date | null;
  metadata: DexPriceMetadata | null;
}

export const useDexPrice = (): DexPriceResult => {
  const [dexPrice, setDexPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [metadata, setMetadata] = useState<DexPriceMetadata | null>(null);
  const fetchingRef = useRef(false);

  const fetchDexPrice = useCallback(async (forceRefresh: boolean = false): Promise<number | null> => {
    // Prevent concurrent fetches
    if (fetchingRef.current) {
      logger.debug('DEX price fetch already in progress, skipping');
      return dexPrice;
    }

    // Check cache (unless force refresh)
    if (!forceRefresh && cachedPrice && Date.now() - cachedPrice.timestamp < CACHE_DURATION_MS) {
      logger.debug('Using cached DEX price:', cachedPrice.price);
      setDexPrice(cachedPrice.price);
      setLastUpdated(new Date(cachedPrice.timestamp));
      setMetadata(cachedPrice.metadata);
      return cachedPrice.price;
    }

    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Get WOVER/USDT pool address from config
      const poolAddress = MAINNET_POOLS['WOVER/USDT'];

      if (!poolAddress) {
        logger.warn('WOVER/USDT pool not found in MAINNET_POOLS');
        setError('DEX pool not configured');
        setIsLoading(false);
        fetchingRef.current = false;
        return null;
      }

      const provider = new ethers.providers.JsonRpcProvider('https://rpc.overprotocol.com');
      const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);

      // Read token addresses from pool
      const [token0Address, token1Address, slot0] = await Promise.all([
        poolContract.token0(),
        poolContract.token1(),
        poolContract.slot0(),
      ]);

      const sqrtPriceX96 = slot0[0];

      // Read decimals from both tokens
      const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, provider);
      const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, provider);

      const [token0Decimals, token1Decimals, token0Symbol, token1Symbol] = await Promise.all([
        token0Contract.decimals(),
        token1Contract.decimals(),
        token0Contract.symbol().catch(() => 'UNKNOWN'),
        token1Contract.symbol().catch(() => 'UNKNOWN'),
      ]);

      // Determine which token is WOVER
      const isWoverToken0 = token0Address.toLowerCase() === TOKEN_ADDRESSES.WOVER.toLowerCase();
      const isWoverToken1 = token1Address.toLowerCase() === TOKEN_ADDRESSES.WOVER.toLowerCase();
      
      if (!isWoverToken0 && !isWoverToken1) {
        logger.error('WOVER token not found in pool!', { token0Address, token1Address, expectedWover: TOKEN_ADDRESSES.WOVER });
        setError('WOVER token not found in pool');
        setIsLoading(false);
        fetchingRef.current = false;
        return null;
      }

      // Calculate price from sqrtPriceX96 using BigInt for precision
      // Formula: price = (sqrtPriceX96 / 2^96)^2
      // This gives price of token1 in terms of token0
      
      // Use BigInt to avoid floating point precision loss on large numbers
      const sqrtPriceX96Str = sqrtPriceX96.toString();
      const sqrtBig = BigInt(sqrtPriceX96Str);
      const Q96 = BigInt(2) ** BigInt(96);
      const Q192 = Q96 * Q96;
      
      // ratioX192 = sqrtPriceX96^2
      const ratioX192 = sqrtBig * sqrtBig;
      
      // Scale to get decimal precision (use 10^18 for high precision)
      const SCALE = BigInt(10) ** BigInt(18);
      const scaledRatio = (ratioX192 * SCALE) / Q192;
      const rawPrice = Number(scaledRatio) / 1e18;

      // Adjust for decimals: price needs to account for different token decimals
      // rawPrice = token1/token0 (in their smallest units)
      // We need to convert to "USD per WOVER"
      
      let woverPriceInUsdt: number;
      const decimalDiff = token0Decimals - token1Decimals;
      
      if (isWoverToken0) {
        // token0 = WOVER, token1 = USDT
        // rawPrice = USDT/WOVER (in smallest units)
        // Adjust: multiply by 10^(wover_decimals - usdt_decimals)
        const decimalAdjustment = Math.pow(10, decimalDiff);
        woverPriceInUsdt = rawPrice * decimalAdjustment;
      } else {
        // token0 = USDT, token1 = WOVER
        // rawPrice = WOVER/USDT (in smallest units), we need 1/rawPrice
        // Adjust: multiply by 10^(usdt_decimals - wover_decimals)
        const decimalAdjustment = Math.pow(10, decimalDiff);
        woverPriceInUsdt = rawPrice > 0 ? (1 / rawPrice) * decimalAdjustment : 0;
      }

      // Validate the price is reasonable (between $0.0000001 and $1000)
      if (woverPriceInUsdt < 0.0000001 || woverPriceInUsdt > 1000) {
        logger.warn('DEX price seems unrealistic:', woverPriceInUsdt, {
          sqrtPriceX96: sqrtPriceX96Str,
          sqrtBig: sqrtBig.toString(),
          ratioX192: ratioX192.toString(),
          scaledRatio: scaledRatio.toString(),
          rawPrice,
          token0Decimals,
          token1Decimals,
          decimalDiff,
          isWoverToken0,
        });
      }

      // Round to 8 decimals
      const roundedPrice = Math.round(woverPriceInUsdt * 100000000) / 100000000;

      const now = new Date();
      const priceMetadata: DexPriceMetadata = {
        poolAddress,
        token0Address,
        token1Address,
        token0Decimals,
        token1Decimals,
        token0Symbol,
        token1Symbol,
        isWoverToken0,
        sqrtPriceX96: sqrtPriceX96.toString(),
        rawPrice,
        lastUpdated: now,
      };

      logger.info(`DEX Price: 1 WOVER = ${roundedPrice} USDT`, priceMetadata);

      // Save to cache
      cachedPrice = { price: roundedPrice, timestamp: Date.now(), metadata: priceMetadata };
      
      setDexPrice(roundedPrice);
      setLastUpdated(now);
      setMetadata(priceMetadata);
      
      return roundedPrice;
    } catch (err: any) {
      logger.error('Failed to fetch DEX price:', err);
      setError(err.message || 'Failed to fetch DEX price');
      return null;
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [dexPrice]);

  useEffect(() => {
    fetchDexPrice();
    
    // Refresh every 60 seconds
    const interval = setInterval(() => fetchDexPrice(), CACHE_DURATION_MS);
    return () => clearInterval(interval);
  }, [fetchDexPrice]);

  return {
    dexPrice,
    isLoading,
    error,
    refetch: fetchDexPrice,
    lastUpdated,
    metadata,
  };
};

// Helper function to calculate USDT price of ticket
export const calculateUsdtTicketPrice = (woverAmount: number, dexPrice: number): number => {
  return woverAmount * dexPrice;
};

// Clear cache (useful for testing)
export const clearDexPriceCache = () => {
  cachedPrice = null;
};

export default useDexPrice;
