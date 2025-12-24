import { User, TrendingUp, TrendingDown } from 'lucide-react';
import type { GameBet } from '@/hooks/useGameRound';

interface LiveBetsFeedProps {
  bets: GameBet[];
  currentStatus: string;
}

const LiveBetsFeed = ({ bets, currentStatus }: LiveBetsFeedProps) => {
  if (bets.length === 0) {
    return null;
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs font-medium">Live Bets</span>
        </div>
        <span className="text-xs text-muted-foreground">{bets.length} players</span>
      </div>
      
      <div className="max-h-[200px] overflow-y-auto">
        {bets.slice(0, 10).map((bet, index) => (
          <div 
            key={bet.id}
            className="px-3 py-2 flex items-center justify-between border-b border-border/10 last:border-0 hover:bg-card/30 transition-colors animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-3 h-3 text-primary" />
              </div>
              <div>
                <div className="text-xs font-mono">{formatAddress(bet.wallet_address)}</div>
                <div className="text-[10px] text-muted-foreground">{bet.bet_amount} WOVER</div>
              </div>
            </div>
            
            <div className="text-right">
              {bet.status === 'active' && currentStatus === 'flying' ? (
                <div className="flex items-center gap-1 text-success text-xs">
                  <TrendingUp className="w-3 h-3" />
                  <span>Active</span>
                </div>
              ) : bet.status === 'won' ? (
                <div className="text-success text-xs font-medium">
                  +{bet.winnings?.toFixed(2)} W
                </div>
              ) : bet.status === 'lost' ? (
                <div className="flex items-center gap-1 text-destructive text-xs">
                  <TrendingDown className="w-3 h-3" />
                  <span>Lost</span>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  {bet.auto_cashout_at ? `Auto @${bet.auto_cashout_at}x` : 'Manual'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LiveBetsFeed;
