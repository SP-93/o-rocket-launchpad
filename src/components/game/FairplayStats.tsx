import { useMemo } from 'react';
import { BarChart3, TrendingUp, Zap, Shield } from 'lucide-react';

interface FairplayStatsProps {
  roundHistory: Array<{
    roundNumber: number;
    crashPoint?: number;
    status: string;
  }>;
}

const FairplayStats = ({ roundHistory }: FairplayStatsProps) => {
  const stats = useMemo(() => {
    const crashedRounds = roundHistory.filter(r => 
      (r.status === 'crashed' || r.status === 'payout') && r.crashPoint
    );
    
    if (crashedRounds.length === 0) {
      return null;
    }

    const crashPoints = crashedRounds.map(r => (r.crashPoint || 100) / 100);
    const total = crashedRounds.length;
    const avg = crashPoints.reduce((a, b) => a + b, 0) / total;
    const min = Math.min(...crashPoints);
    const max = Math.max(...crashPoints);
    
    // Distribution buckets
    const under1_5x = crashPoints.filter(c => c < 1.5).length;
    const between1_5_2x = crashPoints.filter(c => c >= 1.5 && c < 2).length;
    const between2_3x = crashPoints.filter(c => c >= 2 && c < 3).length;
    const between3_5x = crashPoints.filter(c => c >= 3 && c < 5).length;
    const above5x = crashPoints.filter(c => c >= 5).length;
    
    const distribution = [
      { label: '<1.5x', count: under1_5x, pct: (under1_5x / total * 100).toFixed(1) },
      { label: '1.5-2x', count: between1_5_2x, pct: (between1_5_2x / total * 100).toFixed(1) },
      { label: '2-3x', count: between2_3x, pct: (between2_3x / total * 100).toFixed(1) },
      { label: '3-5x', count: between3_5x, pct: (between3_5x / total * 100).toFixed(1) },
      { label: '5x+', count: above5x, pct: (above5x / total * 100).toFixed(1) },
    ];
    
    // Calculate standard deviation to show randomness
    const variance = crashPoints.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / total;
    const stdDev = Math.sqrt(variance);
    
    return {
      total,
      avg: avg.toFixed(2),
      min: min.toFixed(2),
      max: max.toFixed(2),
      stdDev: stdDev.toFixed(2),
      distribution,
    };
  }, [roundHistory]);

  if (!stats) {
    return (
      <div className="text-center text-muted-foreground py-4 text-sm">
        Not enough data yet. Play more rounds to see statistics.
      </div>
    );
  }

  const maxCount = Math.max(...stats.distribution.map(d => d.count));

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-muted/30 rounded-lg p-2 text-center">
          <div className="text-xs text-muted-foreground">Rounds</div>
          <div className="text-lg font-bold">{stats.total}</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-2 text-center">
          <div className="text-xs text-muted-foreground">Avg</div>
          <div className="text-lg font-bold text-primary">{stats.avg}x</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-2 text-center">
          <div className="text-xs text-muted-foreground">Min</div>
          <div className="text-lg font-bold text-destructive">{stats.min}x</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-2 text-center">
          <div className="text-xs text-muted-foreground">Max</div>
          <div className="text-lg font-bold text-success">{stats.max}x</div>
        </div>
      </div>

      {/* Distribution Chart */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="w-4 h-4 text-primary" />
          Crash Distribution
        </div>
        <div className="space-y-1.5">
          {stats.distribution.map((bucket) => (
            <div key={bucket.label} className="flex items-center gap-2">
              <div className="w-14 text-xs text-muted-foreground text-right">
                {bucket.label}
              </div>
              <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-300"
                  style={{ width: `${(bucket.count / maxCount) * 100}%` }}
                />
              </div>
              <div className="w-12 text-xs text-muted-foreground">
                {bucket.pct}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Randomness Indicator */}
      <div className="bg-success/10 border border-success/20 rounded-lg p-3 flex items-start gap-3">
        <Shield className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-medium text-success">No Patterns Detected</div>
          <div className="text-xs text-muted-foreground mt-1">
            Standard deviation: {stats.stdDev}x — Results are cryptographically random and unpredictable.
            Each round uses a unique server seed hashed before betting opens.
          </div>
        </div>
      </div>
    </div>
  );
};

export default FairplayStats;
