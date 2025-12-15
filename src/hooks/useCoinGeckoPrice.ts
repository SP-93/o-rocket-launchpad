import { useState, useEffect, useCallback } from 'react';

interface CoinGeckoPrice {
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

interface CoinGeckoResponse {
  overprotocol: {
    usd: number;
    usd_24h_change: number;
    usd_market_cap: number;
    usd_24h_vol: number;
  };
}

const CACHE_DURATION = 60 * 1000; // 60 seconds cache
const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price';

let cachedData: CoinGeckoPrice | null = null;
let cacheTimestamp: number = 0;

export const useCoinGeckoPrice = () => {
  const [priceData, setPriceData] = useState<CoinGeckoPrice>({
    price: 0,
    change24h: 0,
    marketCap: 0,
    volume24h: 0,
    high24h: 0,
    low24h: 0,
    loading: true,
    error: null,
    lastUpdated: null,
  });

  const fetchPrice = useCallback(async (force = false) => {
    // Return cached data if valid
    if (!force && cachedData && Date.now() - cacheTimestamp < CACHE_DURATION) {
      setPriceData(cachedData);
      return cachedData;
    }

    setPriceData(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(
        `${COINGECKO_API}?ids=overprotocol&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: CoinGeckoResponse = await response.json();

      if (!data.overprotocol) {
        throw new Error('OVER token data not found');
      }

      const overData = data.overprotocol;
      const now = Date.now();

      // Calculate estimated high/low based on 24h change
      const currentPrice = overData.usd;
      const changePercent = overData.usd_24h_change / 100;
      const estimatedHigh = currentPrice * (1 + Math.abs(changePercent) * 0.3);
      const estimatedLow = currentPrice * (1 - Math.abs(changePercent) * 0.3);

      const newData: CoinGeckoPrice = {
        price: currentPrice,
        change24h: overData.usd_24h_change,
        marketCap: overData.usd_market_cap,
        volume24h: overData.usd_24h_vol,
        high24h: Math.max(currentPrice, estimatedHigh),
        low24h: Math.min(currentPrice, estimatedLow),
        loading: false,
        error: null,
        lastUpdated: now,
      };

      // Update cache
      cachedData = newData;
      cacheTimestamp = now;

      setPriceData(newData);
      return newData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch price';
      setPriceData(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      return null;
    }
  }, []);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    fetchPrice();
    const interval = setInterval(() => fetchPrice(), CACHE_DURATION);
    return () => clearInterval(interval);
  }, [fetchPrice]);

  return {
    ...priceData,
    refetch: () => fetchPrice(true),
  };
};

export default useCoinGeckoPrice;
