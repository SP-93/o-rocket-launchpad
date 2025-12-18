// Uniswap V3 Liquidity Math - Calculate token amounts from position liquidity

/**
 * Calculate sqrt price from tick
 * sqrtPrice = sqrt(1.0001^tick)
 */
export const tickToSqrtPrice = (tick: number): number => {
  return Math.sqrt(Math.pow(1.0001, tick));
};

/**
 * Calculate token amounts from liquidity position
 * Based on Uniswap V3 whitepaper formulas
 * 
 * @param liquidity - Position liquidity (L)
 * @param currentTick - Current pool tick
 * @param tickLower - Position lower tick
 * @param tickUpper - Position upper tick
 * @param decimals0 - Token0 decimals
 * @param decimals1 - Token1 decimals
 * @returns { amount0, amount1 } - Token amounts in human-readable format
 */
export const calculatePositionAmounts = (
  liquidity: string,
  currentTick: number,
  tickLower: number,
  tickUpper: number,
  decimals0: number = 18,
  decimals1: number = 18
): { amount0: number; amount1: number } => {
  const L = parseFloat(liquidity);
  
  if (L === 0 || isNaN(L)) {
    return { amount0: 0, amount1: 0 };
  }

  const sqrtPriceCurrent = tickToSqrtPrice(currentTick);
  const sqrtPriceLower = tickToSqrtPrice(tickLower);
  const sqrtPriceUpper = tickToSqrtPrice(tickUpper);

  let amount0Raw = 0;
  let amount1Raw = 0;

  if (currentTick < tickLower) {
    // Price below range - all in token0
    amount0Raw = L * (1 / sqrtPriceLower - 1 / sqrtPriceUpper);
    amount1Raw = 0;
  } else if (currentTick >= tickUpper) {
    // Price above range - all in token1
    amount0Raw = 0;
    amount1Raw = L * (sqrtPriceUpper - sqrtPriceLower);
  } else {
    // Price in range - mix of both tokens
    amount0Raw = L * (1 / sqrtPriceCurrent - 1 / sqrtPriceUpper);
    amount1Raw = L * (sqrtPriceCurrent - sqrtPriceLower);
  }

  // Adjust for decimals
  // In Uniswap V3, liquidity is stored with implicit decimal adjustment
  // amount0 needs to be divided by 10^decimals0, amount1 by 10^decimals1
  const amount0 = amount0Raw / Math.pow(10, decimals0);
  const amount1 = amount1Raw / Math.pow(10, decimals1);

  return { amount0, amount1 };
};

/**
 * Calculate total position value in USD
 * 
 * @param position - Position data including amounts and unclaimed tokens
 * @param overPriceUSD - Current OVER price in USD
 * @returns Total USD value (active liquidity + unclaimed tokens)
 */
export const calculatePositionUSDValue = (
  amount0: number,
  amount1: number,
  tokensOwed0: number,
  tokensOwed1: number,
  token0Symbol: string,
  token1Symbol: string,
  overPriceUSD: number
): { totalValue: number; liquidityValue: number; unclaimedValue: number } => {
  const getTokenPrice = (symbol: string): number => {
    if (symbol === 'USDT' || symbol === 'USDC') return 1;
    if (symbol === 'WOVER' || symbol === 'OVER') return overPriceUSD;
    return 0;
  };

  const price0 = getTokenPrice(token0Symbol);
  const price1 = getTokenPrice(token1Symbol);

  const liquidityValue = (amount0 * price0) + (amount1 * price1);
  const unclaimedValue = (tokensOwed0 * price0) + (tokensOwed1 * price1);
  const totalValue = liquidityValue + unclaimedValue;

  return { totalValue, liquidityValue, unclaimedValue };
};
