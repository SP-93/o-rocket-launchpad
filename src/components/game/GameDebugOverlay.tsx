import { memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bug, Wifi, WifiOff, Clock, Activity } from 'lucide-react';

interface GameDebugOverlayProps {
  currentRound: {
    id: string;
    round_number: number;
    status: string;
    crash_point?: number | null;
    started_at?: string | null;
  } | null;
  currentMultiplier: number;
  engineStatus: {
    isEnabled: boolean;
    lastAction: string | null;
    lastTick: Date | null;
    error: string | null;
  };
  isLoading: boolean;
}

const GameDebugOverlay = memo(({ 
  currentRound, 
  currentMultiplier, 
  engineStatus,
  isLoading
}: GameDebugOverlayProps) => {
  const [searchParams] = useSearchParams();
  const isDebugMode = searchParams.get('debug') === '1';

  if (!isDebugMode) return null;

  const timeSinceLastTick = engineStatus.lastTick 
    ? Math.round((Date.now() - engineStatus.lastTick.getTime()) / 1000)
    : null;

  return (
    <div className="fixed top-20 right-4 z-50 bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 text-xs font-mono shadow-lg max-w-[280px]">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
        <Bug className="w-4 h-4 text-warning" />
        <span className="font-bold text-warning">Debug Mode</span>
      </div>
      
      {/* Connection Status */}
      <div className="flex items-center gap-2 mb-2">
        {engineStatus.isEnabled ? (
          <Wifi className="w-3 h-3 text-success" />
        ) : (
          <WifiOff className="w-3 h-3 text-destructive" />
        )}
        <span className={engineStatus.isEnabled ? 'text-success' : 'text-destructive'}>
          Engine: {engineStatus.isEnabled ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Round Info */}
      <div className="space-y-1 mb-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Round:</span>
          <span>{currentRound?.round_number ?? 'None'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status:</span>
          <span className={
            currentRound?.status === 'flying' ? 'text-success' :
            currentRound?.status === 'crashed' ? 'text-destructive' :
            currentRound?.status === 'betting' ? 'text-warning' :
            'text-muted-foreground'
          }>
            {currentRound?.status ?? 'N/A'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Multiplier:</span>
          <span className="text-primary font-bold">{currentMultiplier.toFixed(2)}x</span>
        </div>
        {currentRound?.crash_point && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Crash Point:</span>
            <span className="text-destructive">{currentRound.crash_point}x</span>
          </div>
        )}
      </div>

      {/* Engine Status */}
      <div className="space-y-1 pt-2 border-t border-border">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground flex items-center gap-1">
            <Activity className="w-3 h-3" /> Last Action:
          </span>
          <span>{engineStatus.lastAction ?? 'None'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> Last Tick:
          </span>
          <span className={timeSinceLastTick !== null && timeSinceLastTick > 5 ? 'text-warning' : ''}>
            {timeSinceLastTick !== null ? `${timeSinceLastTick}s ago` : 'Never'}
          </span>
        </div>
        {engineStatus.error && (
          <div className="text-destructive mt-1 p-1 bg-destructive/10 rounded text-[10px]">
            Error: {engineStatus.error}
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="mt-2 pt-2 border-t border-border text-warning">
          Loading round data...
        </div>
      )}
    </div>
  );
});

GameDebugOverlay.displayName = 'GameDebugOverlay';

export default GameDebugOverlay;
