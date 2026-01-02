// Hook za dobijanje WOVER cene sa DEX-a (iz liquidity pool-a)
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { MAINNET_POOLS, TOKEN_ADDRESSES } from '@/config/admin';
import logger from '@/lib/logger';

// Pool ABI za čitanje cene
const POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
];

// Cache za DEX cenu (60 sekundi)
const CACHE_DURATION_MS = 60 * 1000;
let cachedPrice: { price: number; timestamp: number } | null = null;

export interface DexPriceResult {
  dexPrice: number | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdated: Date | null;
}

export const useDexPrice = (): DexPriceResult => {
  const [dexPrice, setDexPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDexPrice = useCallback(async () => {
    // Proveri cache
    if (cachedPrice && Date.now() - cachedPrice.timestamp < CACHE_DURATION_MS) {
      setDexPrice(cachedPrice.price);
      setLastUpdated(new Date(cachedPrice.timestamp));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Dobij WOVER/USDT pool adresu iz config-a
      const poolAddress = MAINNET_POOLS['WOVER/USDT'];

      if (!poolAddress) {
        logger.warn('WOVER/USDT pool not found in MAINNET_POOLS');
        setError('DEX pool not found');
        setIsLoading(false);
        return;
      }

      const provider = new ethers.providers.JsonRpcProvider('https://rpc.overprotocol.com');
      const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);

      // Dobij slot0 za cenu
      const [sqrtPriceX96] = await poolContract.slot0();
      const token0Address = await poolContract.token0();
      
      // Izračunaj cenu iz sqrtPriceX96
      // price = (sqrtPriceX96 / 2^96)^2
      const sqrtPrice = parseFloat(sqrtPriceX96.toString()) / Math.pow(2, 96);
      let price = sqrtPrice * sqrtPrice;

      // Proveri koji token je token0 da bismo dobili WOVER cenu u USDT
      const isWoverToken0 = token0Address.toLowerCase() === TOKEN_ADDRESSES.WOVER.toLowerCase();
      
      // USDT ima 6 decimala, WOVER ima 18 decimala
      // Ako je WOVER token0: price = USDT/WOVER, treba invertovati i adjustovati decimale
      // Ako je USDT token0: price = WOVER/USDT, treba adjustovati decimale
      
      if (isWoverToken0) {
        // price je u USDT po WOVER, ali treba adjustovati za decimale
        // WOVER (18 dec) / USDT (6 dec) = 10^12 faktor
        price = price * Math.pow(10, 18 - 6);
      } else {
        // price je u WOVER po USDT, treba invertovati
        // USDT (6 dec) / WOVER (18 dec) = 10^-12 faktor
        price = (1 / price) * Math.pow(10, 18 - 6);
      }

      // Zaokruži na 8 decimala
      const roundedPrice = Math.round(price * 100000000) / 100000000;

      logger.info(`DEX Price: 1 WOVER = ${roundedPrice} USDT`);

      // Sačuvaj u cache
      cachedPrice = { price: roundedPrice, timestamp: Date.now() };
      
      setDexPrice(roundedPrice);
      setLastUpdated(new Date());
    } catch (err: any) {
      logger.error('Failed to fetch DEX price:', err);
      setError(err.message || 'Failed to fetch DEX price');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDexPrice();
    
    // Refresh svakih 60 sekundi
    const interval = setInterval(fetchDexPrice, CACHE_DURATION_MS);
    return () => clearInterval(interval);
  }, [fetchDexPrice]);

  return {
    dexPrice,
    isLoading,
    error,
    refetch: fetchDexPrice,
    lastUpdated,
  };
};

// Helper funkcija za kalkulaciju USDT cene tiketa
export const calculateUsdtTicketPrice = (woverAmount: number, dexPrice: number): number => {
  return woverAmount * dexPrice;
};

export default useDexPrice;
