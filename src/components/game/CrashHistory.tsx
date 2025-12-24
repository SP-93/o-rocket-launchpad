import { TrendingUp } from 'lucide-react';
import type { GameRound } from '@/hooks/useGameRound';

interface CrashHistoryProps {
  history: GameRound[];
}

const CrashHistory = ({ history }: CrashHistoryProps) => {
  const getStyle = (point: number | null) => {
    if (!point) return 'text-muted-foreground bg-muted/20';
    if (point >= 5) return 'text-warning bg-warning/10';
    if (point >= 2) return 'text-success bg-success/10';
    return 'text-destructive bg-destructive/10';
  };

  if (!history || history.length === 0) {
    return null;
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border/20 flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium">History</span>
      </div>
      <div className="p-3 flex flex-wrap gap-1.5">
        {history.slice(0, 12).map((round) => (
          <div
            key={round.id}
            className={`px-2 py-1 rounded-md text-xs font-mono font-bold ${getStyle(round.crash_point)}`}
          >
            {round.crash_point?.toFixed(2) || '?.??'}×
          </div>
        ))}
      </div>
    </div>
  );
};

export default CrashHistory;
