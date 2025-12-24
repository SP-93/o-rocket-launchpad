import { TrendingUp } from 'lucide-react';
import type { GameRound } from '@/hooks/useGameRound';

interface CrashHistoryProps {
  history: GameRound[];
}

const CrashHistory = ({ history }: CrashHistoryProps) => {
  const getStyle = (point: number | null) => {
    if (!point) return 'text-muted-foreground bg-muted/30 border-border/30';
    if (point >= 10) return 'text-warning bg-warning/20 border-warning/40';
    if (point >= 5) return 'text-warning bg-warning/15 border-warning/30';
    if (point >= 2) return 'text-success bg-success/15 border-success/30';
    return 'text-destructive bg-destructive/15 border-destructive/30';
  };

  if (!history || history.length === 0) {
    return null;
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border/20 flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium">History</span>
        <span className="text-[10px] text-muted-foreground">Last {Math.min(history.length, 15)} rounds</span>
      </div>
      {/* Horizontal scroll on mobile, wrap on desktop */}
      <div className="p-2 overflow-x-auto scrollbar-hide">
        <div className="flex lg:flex-wrap gap-1.5 min-w-max lg:min-w-0">
          {history.slice(0, 15).map((round) => (
            <div
              key={round.id}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border backdrop-blur-sm flex-shrink-0 ${getStyle(round.crash_point)}`}
              title={`Round #${round.round_number}`}
            >
              {round.crash_point?.toFixed(2) || '?.??'}×
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CrashHistory;
