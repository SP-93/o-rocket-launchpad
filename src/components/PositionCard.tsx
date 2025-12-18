import { Button } from "@/components/ui/button";
import { TokenIcon } from "@/components/TokenIcon";
import { Position } from "@/hooks/useLiquidity";
import { CirclePlus, Wallet, Trash2, ExternalLink, Loader2, TrendingUp, TrendingDown, Activity, DollarSign } from "lucide-react";

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

  // Calculate USD value of unclaimed tokens
  const calculateUSDValue = (): number => {
    const getTokenValue = (symbol: string, amount: string): number => {
      const parsedAmount = parseFloat(amount);
      if (symbol === 'USDT' || symbol === 'USDC') return parsedAmount;
      if (symbol === 'WOVER' || symbol === 'OVER') return parsedAmount * overPriceUSD;
      return 0;
    };
    
    const token0Value = getTokenValue(position.token0, position.tokensOwed0);
    const token1Value = getTokenValue(position.token1, position.tokensOwed1);
    return token0Value + token1Value;
  };

  const positionUSDValue = calculateUSDValue();

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              {overPriceUSD > 0 && positionUSDValue > 0 ? (
                <p className="text-lg font-bold text-primary">
                  ${positionUSDValue.toFixed(2)}
                </p>
              ) : positionUSDValue === 0 ? (
                <p className="text-sm text-muted-foreground">$0.00</p>
              ) : (
                <p className="text-sm text-muted-foreground">--</p>
              )}
            </div>

            {/* Liquidity Status */}
            <div className="glass-card rounded-xl p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Liquidity</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-success' : 'bg-muted-foreground'}`} />
                <span className={`text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {isActive ? 'Active' : 'Empty'}
                </span>
              </div>
              {!isActive && (
                <p className="text-xs text-muted-foreground mt-1">
                  Position has no liquidity
                </p>
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
