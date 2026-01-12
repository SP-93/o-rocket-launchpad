import { useCoinGeckoPrice } from '@/hooks/useCoinGeckoPrice';
import { useDexPrice } from '@/hooks/useDexPrice';
import { TrendingUp, TrendingDown, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { TokenIcon } from '@/components/TokenIcon';

interface LivePriceWidgetProps {
  compact?: boolean;
  className?: string;
}

export const LivePriceWidget = ({ compact = false, className = '' }: LivePriceWidgetProps) => {
  const { price: cexPrice, change24h, loading: cexLoading, error: cexError, refetch: refetchCex } = useCoinGeckoPrice();
  const { dexPrice, isLoading: dexLoading, error: dexError, refetch: refetchDex } = useDexPrice();

  const isPositive = change24h >= 0;

  const handleRefresh = () => {
    refetchCex();
    refetchDex();
  };

  if (cexError && dexError) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <TokenIcon symbol="WOVER" size="sm" />
        <span className="text-xs text-muted-foreground">Price unavailable</span>
        <button onClick={handleRefresh} className="text-primary hover:text-primary/80">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex flex-col gap-1.5 bg-card/50 backdrop-blur-sm border border-border/30 rounded-lg px-3 py-2 ${className}`}>
        {/* CEX Price Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TokenIcon symbol="WOVER" size="sm" />
            {cexLoading ? (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            ) : (
              <>
                <span className="text-sm font-semibold text-foreground">
                  ${cexPrice.toFixed(5)}
                </span>
                <span className={`text-xs font-medium flex items-center gap-0.5 ${
                  isPositive ? 'text-success' : 'text-destructive'
                }`}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {isPositive ? '+' : ''}{change24h.toFixed(2)}%
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground font-medium">CEX</span>
            <a 
              href="https://www.coingecko.com/en/coins/overprotocol" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* DEX Price Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TokenIcon symbol="WOVER" size="sm" />
            {dexLoading ? (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            ) : dexError ? (
              <span className="text-xs text-muted-foreground">N/A</span>
            ) : (
              <span className="text-sm font-semibold text-foreground">
                ${dexPrice?.toFixed(5) || '0.00000'}
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground font-medium">DEX</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`glass-card p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TokenIcon symbol="WOVER" size="md" />
          <span className="font-semibold text-foreground">OVER</span>
        </div>
        <a 
          href="https://www.coingecko.com/en/coins/overprotocol" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          CoinGecko <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      
      <div className="space-y-3">
        {/* CEX Price */}
        {cexLoading ? (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold gradient-text">
                ${cexPrice.toFixed(5)}
              </span>
              <span className={`text-sm font-medium flex items-center gap-1 px-2 py-0.5 rounded-full ${
                isPositive 
                  ? 'bg-success/20 text-success' 
                  : 'bg-destructive/20 text-destructive'
              }`}>
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isPositive ? '+' : ''}{change24h.toFixed(2)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">CEX live price (CoinGecko)</p>
          </div>
        )}

        {/* DEX Price */}
        {dexLoading ? (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-foreground">
                ${dexPrice?.toFixed(5) || '0.00000'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">DEX live price (Pool)</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LivePriceWidget;
