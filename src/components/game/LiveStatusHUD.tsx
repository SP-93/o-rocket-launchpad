import { useEffect, useState } from 'react';
import { WifiOff, Rocket, AlertTriangle, Clock, Zap, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LiveStatusHUDProps {
  engineStatus: {
    isEnabled: boolean;
    lastAction: string | null;
    lastTick: Date | null;
    error: string | null;
  };
  roundStatus: string | null;
  roundNumber: number | null;
  gamePaused?: boolean;
  pauseReason?: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  betting: { label: 'Betting', color: 'text-success', icon: <Clock className="w-3 h-3" /> },
  countdown: { label: 'Starting', color: 'text-warning', icon: <Zap className="w-3 h-3" /> },
  flying: { label: 'Flying!', color: 'text-primary', icon: <Rocket className="w-3 h-3" /> },
  crashed: { label: 'Crashed', color: 'text-destructive', icon: <AlertTriangle className="w-3 h-3" /> },
  payout: { label: 'Settling', color: 'text-muted-foreground', icon: <Clock className="w-3 h-3" /> },
};

export function LiveStatusHUD({ engineStatus, roundStatus, roundNumber, gamePaused, pauseReason }: LiveStatusHUDProps) {
  const [tickAge, setTickAge] = useState<number>(0);
  
  useEffect(() => {
    // Guard against null/undefined lastTick
    if (!engineStatus?.lastTick) {
      setTickAge(0);
      return;
    }
    
    const updateAge = () => {
      try {
        const tickTime = new Date(engineStatus.lastTick!).getTime();
        if (isNaN(tickTime)) {
          setTickAge(0);
          return;
        }
        const age = (Date.now() - tickTime) / 1000;
        // Cap at 99 to prevent display issues
        setTickAge(Math.min(age, 99));
      } catch {
        setTickAge(0);
      }
    };
    
    updateAge();
    const interval = setInterval(updateAge, 500);
    return () => clearInterval(interval);
  }, [engineStatus?.lastTick]);

  // Determine connection status:
  // - If engine is enabled and ticking recently = Live
  // - If engine disabled (intentionally stopped) = Stopped  
  // - If game is paused = Paused with reason
  // - If engine enabled but no recent tick = Offline
  const isEngineStopped = !engineStatus?.isEnabled;
  const hasRecentTick = tickAge < 5 && tickAge >= 0;
  const isLive = engineStatus?.isEnabled && hasRecentTick;
  const statusConfig = roundStatus ? STATUS_CONFIG[roundStatus] : null;

  return (
    <div className="fixed top-20 left-3 md:left-4 z-40 flex flex-col gap-1.5">
      {/* Connection Status - compact */}
      <div className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] md:text-xs font-medium backdrop-blur-md border shadow-lg",
        isLive 
          ? "bg-success/20 border-success/30 text-success" 
          : gamePaused
            ? "bg-warning/20 border-warning/30 text-warning"
            : isEngineStopped
              ? "bg-muted/40 border-border/40 text-muted-foreground"
              : "bg-destructive/20 border-destructive/30 text-destructive"
      )}>
        {isLive ? (
          <>
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span>Live</span>
          </>
        ) : gamePaused ? (
          <>
            <AlertTriangle className="w-3 h-3" />
            <span className="hidden md:inline">{pauseReason || 'Paused'}</span>
            <span className="md:hidden">Paused</span>
          </>
        ) : isEngineStopped ? (
          <>
            <Pause className="w-3 h-3" />
            <span>Stopped</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3 h-3" />
            <span>Offline</span>
          </>
        )}
      </div>

      {/* Round Status - only show when available */}
      {roundStatus && statusConfig && (
        <div className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] md:text-xs font-medium backdrop-blur-md border bg-background/60 border-border/40 shadow-lg",
          statusConfig.color
        )}>
          {statusConfig.icon}
          <span>{statusConfig.label}</span>
          {roundNumber && <span className="opacity-60 font-mono">#{roundNumber}</span>}
        </div>
      )}

      {/* Error indicator - hidden on mobile for cleaner look */}
      {engineStatus?.error && (
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium backdrop-blur-md border bg-destructive/20 border-destructive/30 text-destructive">
          <AlertTriangle className="w-3 h-3" />
          <span className="truncate max-w-[120px]">{engineStatus.error}</span>
        </div>
      )}
    </div>
  );
}
