import { useCoinGeckoPrice } from '@/hooks/useCoinGeckoPrice';
import { TrendingUp, TrendingDown, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { TokenIcon } from '@/components/TokenIcon';

interface LivePriceWidgetProps {
  compact?: boolean;
  className?: string;
}

export const LivePriceWidget = ({ compact = false, className = '' }: LivePriceWidgetProps) => {
  const { price, change24h, loading, error, refetch } = useCoinGeckoPrice();

  const isPositive = change24h >= 0;

  if (error) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <TokenIcon symbol="WOVER" size="sm" />
        <span className="text-xs text-muted-foreground">Price unavailable</span>
        <button onClick={refetch} className="text-primary hover:text-primary/80">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 bg-card/50 backdrop-blur-sm border border-border/30 rounded-lg px-3 py-1.5 ${className}`}>
        <TokenIcon symbol="WOVER" size="sm" />
        <div className="flex items-center gap-2">
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          ) : (
            <>
              <span className="text-sm font-semibold text-foreground">
                ${price.toFixed(5)}
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
        <a 
          href="https://www.coingecko.com/en/coins/overprotocol" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
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
      
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold gradient-text">
              ${price.toFixed(5)}
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
          <p className="text-xs text-muted-foreground">
            Live price from CoinGecko
          </p>
        </div>
      )}
    </div>
  );
};

export default LivePriceWidget;
