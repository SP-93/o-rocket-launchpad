import { Button } from "@/components/ui/button";
import { TokenIcon } from "@/components/TokenIcon";
import { Position } from "@/hooks/useLiquidity";
import { CirclePlus, Wallet, Trash2, ExternalLink, Loader2, TrendingUp, TrendingDown, Activity, DollarSign, Coins, Percent } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PositionCardProps {
  position: Position;
  onAddMore: (position: Position) => void;
  onCollect: (position: Position) => void;
  onRemove: (position: Position) => void;
  isCollecting: boolean;
  isRemoving: boolean;
  overPriceUSD?: number;
}

// Convert tick to human-readable price
const tickToPrice = (tick: number, token0Symbol: string, token1Symbol: string): string => {
  const getDecimals = (symbol: string): number => {
    if (symbol === 'USDT' || symbol === 'USDC') return 6;
    return 18;
  };
  
  const decimals0 = getDecimals(token0Symbol);
  const decimals1 = getDecimals(token1Symbol);
  const decimalAdjustment = Math.pow(10, decimals0 - decimals1);
  
  const rawPrice = Math.pow(1.0001, tick);
  const adjustedPrice = rawPrice * decimalAdjustment;
  
  if (adjustedPrice < 0.0001) {
    return adjustedPrice.toExponential(2);
  } else if (adjustedPrice < 1) {
    return adjustedPrice.toFixed(6);
  } else if (adjustedPrice > 1000000) {
    return adjustedPrice.toExponential(2);
  }
  return adjustedPrice.toFixed(4);
};

const getFeeLabel = (fee: number): string => {
  const feeMap: Record<number, string> = {
    500: "0.05%",
    3000: "0.3%",
    10000: "1%",
  };
  return feeMap[fee] || `${fee / 10000}%`;
};

// Check if position is full range (near min/max ticks)
const isFullRange = (tickLower: number, tickUpper: number): boolean => {
  const MIN_TICK = -887220;
  const MAX_TICK = 887220;
  return tickLower <= MIN_TICK + 1000 && tickUpper >= MAX_TICK - 1000;
};

// Check if position has active liquidity
const hasActiveLiquidity = (liquidity: string): boolean => {
  return liquidity !== '0' && liquidity !== '';
};

export const PositionCard = ({
  position,
  onAddMore,
  onCollect,
  onRemove,
  isCollecting,
  isRemoving,
  overPriceUSD = 0,
}: PositionCardProps) => {
  const isActive = hasActiveLiquidity(position.liquidity);
  const fullRange = isFullRange(position.tickLower, position.tickUpper);
  
  const hasUnclaimedFees = 
    parseFloat(position.tokensOwed0) > 0.000001 || 
    parseFloat(position.tokensOwed1) > 0.000001;

  // Calculate total USD value (active liquidity + unclaimed tokens)
  const calculateUSDValue = (): { totalValue: number; liquidityValue: number; unclaimedValue: number } => {
    const getTokenPrice = (symbol: string): number => {
      if (symbol === 'USDT' || symbol === 'USDC') return 1;
      if (symbol === 'WOVER' || symbol === 'OVER') return overPriceUSD;
      return 0;
    };
    
    const price0 = getTokenPrice(position.token0);
    const price1 = getTokenPrice(position.token1);
    
    // Active liquidity value (calculated from position amounts)
    const amount0 = parseFloat(position.token0Amount) || 0;
    const amount1 = parseFloat(position.token1Amount) || 0;
    const liquidityValue = (amount0 * price0) + (amount1 * price1);
    
    // Unclaimed tokens value
    const unclaimed0 = parseFloat(position.tokensOwed0) || 0;
    const unclaimed1 = parseFloat(position.tokensOwed1) || 0;
    const unclaimedValue = (unclaimed0 * price0) + (unclaimed1 * price1);
    
    const totalValue = liquidityValue + unclaimedValue;
    
    return { totalValue, liquidityValue, unclaimedValue };
  };

  // Calculate APR/APY based on earned fees vs deposited value
  const calculateAPR = (): { apr: number; apy: number; daysActive: number } | null => {
    const getTokenPrice = (symbol: string): number => {
      if (symbol === 'USDT' || symbol === 'USDC') return 1;
      if (symbol === 'WOVER' || symbol === 'OVER') return overPriceUSD;
      return 0;
    };
    
    if (overPriceUSD <= 0) return null;
    
    const price0 = getTokenPrice(position.token0);
    const price1 = getTokenPrice(position.token1);
    
    // Calculate liquidity value (principal)
    const amount0 = parseFloat(position.token0Amount) || 0;
    const amount1 = parseFloat(position.token1Amount) || 0;
    const liquidityValue = (amount0 * price0) + (amount1 * price1);
    
    if (liquidityValue <= 0) return null;
    
    // Calculate fees earned (currently unclaimed fees as proxy)
    const fees0 = parseFloat(position.tokensOwed0) || 0;
    const fees1 = parseFloat(position.tokensOwed1) || 0;
    const feesValue = (fees0 * price0) + (fees1 * price1);
    
    // Estimate days active (use createdAt if available, else estimate from fee accumulation)
    // Without on-chain timestamp, we estimate based on typical fee accumulation
    // For now, we'll use a conservative estimate of 7 days if fees exist, otherwise show "new"
    let daysActive = 7; // Default assumption
    
    if (position.createdAt) {
      const now = Date.now() / 1000;
      daysActive = Math.max(1, Math.floor((now - position.createdAt) / 86400));
    } else if (feesValue < 0.001) {
      // Very new position with minimal fees
      daysActive = 1;
    }
    
    // APR = (Fees / Principal) * (365 / Days) * 100
    const apr = (feesValue / liquidityValue) * (365 / daysActive) * 100;
    
    // APY = (1 + APR/365)^365 - 1 (daily compounding)
    const dailyRate = apr / 365 / 100;
    const apy = (Math.pow(1 + dailyRate, 365) - 1) * 100;
    
    return { 
      apr: Math.min(apr, 9999), // Cap at 9999% for display
      apy: Math.min(apy, 9999),
      daysActive 
    };
  };

  const { totalValue: positionUSDValue, liquidityValue, unclaimedValue } = calculateUSDValue();
  const aprData = calculateAPR();

  return (
    <div className="relative group">
      {/* Gradient border effect */}
      <div className="absolute -inset-[1px] bg-gradient-to-r from-primary/50 via-secondary/50 to-accent/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
      
      <div className="relative glass-card rounded-2xl p-5 md:p-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        
        <div className="relative flex flex-col gap-5">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-4">
            {/* Pool Info */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex -space-x-3">
                  <TokenIcon symbol={position.token0} size="lg" />
                  <TokenIcon symbol={position.token1} size="lg" />
                </div>
                {/* Status indicator dot */}
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background ${
                  isActive ? 'bg-success' : 'bg-muted-foreground'
                }`}>
                  {isActive && (
                    <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-75" />
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="text-lg md:text-xl font-bold text-foreground">
                  {position.token0}/{position.token1}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md bg-primary/10 text-primary border border-primary/20">
                    {getFeeLabel(position.fee)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ID #{position.tokenId}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Badge */}
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full ${
              isActive 
                ? 'bg-success/15 text-success border border-success/30'
                : 'bg-muted text-muted-foreground border border-border'
            }`}>
              {isActive ? (
                <>
                  <Activity className="w-3 h-3" />
                  <span>In Range</span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-3 h-3" />
                  <span>Out of Range</span>
                </>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Price Range */}
            <div className="glass-card rounded-xl p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Price Range</span>
              </div>
              {fullRange ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-1 text-sm font-semibold rounded-lg bg-accent/15 text-accent border border-accent/30">
                    ∞ Full Range
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Min</span>
                    <span className="font-mono font-medium text-foreground">
                      {tickToPrice(position.tickLower, position.token0, position.token1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Max</span>
                    <span className="font-mono font-medium text-foreground">
                      {tickToPrice(position.tickUpper, position.token0, position.token1)}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {position.token1} per {position.token0}
                  </p>
                </div>
              )}
            </div>

            {/* Unclaimed Fees */}
            <div className="glass-card rounded-xl p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Unclaimed Tokens</span>
              </div>
              {hasUnclaimedFees ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-success">
                    {parseFloat(position.tokensOwed0).toFixed(6)} {position.token0}
                  </p>
                  <p className="text-sm font-semibold text-success">
                    {parseFloat(position.tokensOwed1).toFixed(6)} {position.token1}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No tokens to collect</p>
              )}
            </div>

            {/* Position USD Value */}
            <div className="glass-card rounded-xl p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Position Value</span>
              </div>
              {overPriceUSD > 0 ? (
                <div className="space-y-1">
                  <p className="text-lg font-bold text-primary">
                    ${positionUSDValue.toFixed(2)}
                  </p>
                  {liquidityValue > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Liquidity: ${liquidityValue.toFixed(2)}
                    </p>
                  )}
                  {unclaimedValue > 0 && (
                    <p className="text-xs text-success">
                      +${unclaimedValue.toFixed(2)} unclaimed
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">--</p>
              )}
            </div>

            {/* APR/APY */}
            <div className="glass-card rounded-xl p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Percent className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">APR / APY</span>
              </div>
              {aprData ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="space-y-1 cursor-help">
                        <div className="flex items-baseline gap-2">
                          <p className="text-lg font-bold text-primary">
                            {aprData.apr < 0.01 ? '<0.01' : aprData.apr.toFixed(2)}%
                          </p>
                          <span className="text-xs text-muted-foreground">APR</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <p className="text-sm font-semibold text-success">
                            {aprData.apy < 0.01 ? '<0.01' : aprData.apy.toFixed(2)}%
                          </p>
                          <span className="text-xs text-muted-foreground">APY</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          ~{aprData.daysActive} {aprData.daysActive === 1 ? 'day' : 'days'} active
                        </p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="space-y-1 text-xs">
                        <p><strong>APR:</strong> Annual Percentage Rate (simple)</p>
                        <p><strong>APY:</strong> Annual Percentage Yield (compounded daily)</p>
                        <p className="text-muted-foreground pt-1">
                          Based on ${unclaimedValue.toFixed(4)} fees earned on ${liquidityValue.toFixed(2)} principal over ~{aprData.daysActive} days.
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <p className="text-sm text-muted-foreground">--</p>
              )}
            </div>

            {/* Your Holdings - Token Breakdown */}
            <div className="glass-card rounded-xl p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Your Holdings</span>
              </div>
              {isActive || parseFloat(position.token0Amount) > 0 || parseFloat(position.token1Amount) > 0 ? (
                <div className="space-y-1.5">
                  {/* Token 0 Amount */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <TokenIcon symbol={position.token0} size="sm" />
                      <span className="text-sm font-semibold text-foreground">
                        {parseFloat(position.token0Amount).toLocaleString(undefined, { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 6 
                        })}
                      </span>
                    </div>
                    {overPriceUSD > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ${(parseFloat(position.token0Amount) * (position.token0 === 'WOVER' ? overPriceUSD : 1)).toFixed(2)}
                      </span>
                    )}
                  </div>
                  {/* Token 1 Amount */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <TokenIcon symbol={position.token1} size="sm" />
                      <span className="text-sm font-semibold text-foreground">
                        {parseFloat(position.token1Amount).toLocaleString(undefined, { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 6 
                        })}
                      </span>
                    </div>
                    {overPriceUSD > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ${(parseFloat(position.token1Amount) * (position.token1 === 'WOVER' ? overPriceUSD : 1)).toFixed(2)}
                      </span>
                    )}
                  </div>
                  {/* Status indicator */}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-border/30">
                    <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-success' : 'bg-muted-foreground'}`} />
                    <span className={`text-[10px] ${isActive ? 'text-success' : 'text-muted-foreground'}`}>
                      {isActive ? 'Active liquidity' : 'Out of range'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No tokens in position</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddMore(position)}
              className="flex-1 md:flex-none hover:border-primary/50 hover:bg-primary/5"
            >
              <CirclePlus className="w-4 h-4 mr-1.5" />
              Add More
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCollect(position)}
              disabled={isCollecting || !hasUnclaimedFees}
              className={`flex-1 md:flex-none ${hasUnclaimedFees ? 'hover:border-success/50 hover:bg-success/5' : ''}`}
            >
              {isCollecting ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Wallet className="w-4 h-4 mr-1.5" />
              )}
              Collect
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRemove(position)}
              disabled={isRemoving || !isActive}
              className="flex-1 md:flex-none text-destructive hover:text-destructive hover:border-destructive/50 hover:bg-destructive/5"
            >
              {isRemoving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-1.5" />
              )}
              Remove
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="flex-1 md:flex-none hover:bg-muted/50"
            >
              <a
                href={`https://scan.over.network/token/${position.tokenId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-4 h-4 mr-1.5" />
                View
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
