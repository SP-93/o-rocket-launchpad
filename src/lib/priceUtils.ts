import { ethers } from 'ethers';

// Price utilities for Uniswap V3 pool creation

/**
 * Convert a human-readable price to sqrtPriceX96 format
 * sqrtPriceX96 = sqrt(price) * 2^96
 * 
 * @param price - The price of token1 in terms of token0 (e.g., 0.0081 USDT per WOVER)
 * @param token0Decimals - Decimals of token0 (default 18)
 * @param token1Decimals - Decimals of token1 (default 18)
 * @returns sqrtPriceX96 as BigInt string
 */
export const priceToSqrtPriceX96 = (
  price: number,
  token0Decimals: number = 18,
  token1Decimals: number = 18
): string => {
  if (price <= 0) throw new Error('Price must be greater than 0');
  
  // Adjust price for decimal differences
  const decimalAdjustment = 10 ** (token1Decimals - token0Decimals);
  const adjustedPrice = price * decimalAdjustment;
  
  // Calculate sqrt(price) * 2^96
  const sqrtPrice = Math.sqrt(adjustedPrice);
  const Q96 = BigInt(2) ** BigInt(96);
  
  // Convert to BigInt with high precision
  const sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * Number(Q96)));
  
  return sqrtPriceX96.toString();
};

/**
 * Convert sqrtPriceX96 back to human-readable price
 * 
 * @param sqrtPriceX96 - The sqrtPriceX96 value
 * @param token0Decimals - Decimals of token0 (default 18)
 * @param token1Decimals - Decimals of token1 (default 18)
 * @returns Human-readable price
 */
export const sqrtPriceX96ToPrice = (
  sqrtPriceX96: string | bigint,
  token0Decimals: number = 18,
  token1Decimals: number = 18
): number => {
  const sqrtPriceX96BigInt = typeof sqrtPriceX96 === 'string' ? BigInt(sqrtPriceX96) : sqrtPriceX96;
  const Q96 = BigInt(2) ** BigInt(96);
  
  // Calculate (sqrtPriceX96 / 2^96)^2
  const sqrtPrice = Number(sqrtPriceX96BigInt) / Number(Q96);
  const price = sqrtPrice * sqrtPrice;
  
  // Adjust for decimal differences
  const decimalAdjustment = 10 ** (token1Decimals - token0Decimals);
  return price / decimalAdjustment;
};

/**
 * Calculate price from tick
 * price = 1.0001^tick
 */
export const tickToPrice = (tick: number): number => {
  return Math.pow(1.0001, tick);
};

/**
 * Calculate tick from price
 * tick = log(price) / log(1.0001)
 */
export const priceToTick = (price: number): number => {
  return Math.floor(Math.log(price) / Math.log(1.0001));
};

/**
 * Get the nearest usable tick based on tick spacing
 */
export const getNearestUsableTick = (tick: number, tickSpacing: number): number => {
  return Math.round(tick / tickSpacing) * tickSpacing;
};

/**
 * Token decimal configurations
 */
export const TOKEN_DECIMALS: Record<string, number> = {
  WOVER: 18,
  USDT: 6,
  USDC: 6,
};

/**
 * Get decimals for a token symbol
 */
export const getTokenDecimals = (symbol: string): number => {
  return TOKEN_DECIMALS[symbol.toUpperCase()] ?? 18;
};

/**
 * Calculate initial liquidity amount based on price range
 * This is a simplified calculation for UI display
 */
export const calculateLiquidityFromAmounts = (
  amount0: number,
  amount1: number,
  priceLower: number,
  priceUpper: number,
  currentPrice: number
): bigint => {
  const sqrtPriceLower = Math.sqrt(priceLower);
  const sqrtPriceUpper = Math.sqrt(priceUpper);
  const sqrtPriceCurrent = Math.sqrt(currentPrice);
  
  // Simplified liquidity calculation
  if (currentPrice <= priceLower) {
    // Only token0
    return BigInt(Math.floor(amount0 * sqrtPriceLower * sqrtPriceUpper / (sqrtPriceUpper - sqrtPriceLower)));
  } else if (currentPrice >= priceUpper) {
    // Only token1
    return BigInt(Math.floor(amount1 / (sqrtPriceUpper - sqrtPriceLower)));
  } else {
    // Both tokens
    const liquidity0 = amount0 * sqrtPriceCurrent * sqrtPriceUpper / (sqrtPriceUpper - sqrtPriceCurrent);
    const liquidity1 = amount1 / (sqrtPriceCurrent - sqrtPriceLower);
    return BigInt(Math.floor(Math.min(liquidity0, liquidity1)));
  }
};

/**
 * Format price for display with appropriate precision
 */
export const formatPrice = (price: number, significantDigits: number = 6): string => {
  if (price === 0) return '0';
  if (price >= 1) {
    return price.toFixed(Math.min(significantDigits, 2));
  }
  // For small prices, show more decimals
  const decimals = Math.max(0, -Math.floor(Math.log10(price)) + significantDigits - 1);
  return price.toFixed(decimals);
};

/**
 * Validate price input
 */
export const validatePrice = (price: string | number): { valid: boolean; error?: string } => {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  if (isNaN(numPrice)) {
    return { valid: false, error: 'Invalid number' };
  }
  if (numPrice <= 0) {
    return { valid: false, error: 'Price must be greater than 0' };
  }
  if (numPrice > 1e18) {
    return { valid: false, error: 'Price too large' };
  }
  if (numPrice < 1e-18) {
    return { valid: false, error: 'Price too small' };
  }
  
  return { valid: true };
};
