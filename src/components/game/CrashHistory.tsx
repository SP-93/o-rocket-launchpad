import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { GameRound } from '@/hooks/useGameRound';

interface CrashHistoryProps {
  history: GameRound[];
}

const CrashHistory = ({ history }: CrashHistoryProps) => {
  const getColor = (crashPoint: number) => {
    if (crashPoint < 1.5) return 'text-destructive';
    if (crashPoint < 2) return 'text-warning';
    if (crashPoint < 5) return 'text-success';
    return 'text-primary';
  };

  const getBgColor = (crashPoint: number) => {
    if (crashPoint < 1.5) return 'bg-destructive/20';
    if (crashPoint < 2) return 'bg-warning/20';
    if (crashPoint < 5) return 'bg-success/20';
    return 'bg-primary/20';
  };

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="w-4 h-4 text-primary" />
          Crash History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-4">
            No rounds yet
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {history.map((round) => (
              <div
                key={round.id}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold ${getBgColor(round.crash_point || 1)} ${getColor(round.crash_point || 1)}`}
              >
                {round.crash_point?.toFixed(2)}x
              </div>
            ))}
          </div>
        )}
        
        {history.length > 0 && (
          <div className="mt-3 pt-3 border-t border-primary/10 flex justify-between text-xs text-muted-foreground">
            <span>
              Avg: {(history.reduce((sum, r) => sum + (r.crash_point || 0), 0) / history.length).toFixed(2)}x
            </span>
            <span>
              Last {history.length} rounds
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CrashHistory;
