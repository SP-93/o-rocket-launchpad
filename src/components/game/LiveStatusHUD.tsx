import { useEffect, useState } from 'react';
import { Wifi, WifiOff, Rocket, AlertTriangle, Clock, Zap } from 'lucide-react';
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
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  betting: { label: 'Betting Open', color: 'text-success', icon: <Clock className="w-3 h-3" /> },
  countdown: { label: 'Countdown', color: 'text-warning', icon: <Zap className="w-3 h-3" /> },
  flying: { label: 'In Flight!', color: 'text-primary', icon: <Rocket className="w-3 h-3" /> },
  crashed: { label: 'Crashed', color: 'text-destructive', icon: <AlertTriangle className="w-3 h-3" /> },
  payout: { label: 'Payout', color: 'text-muted-foreground', icon: <Clock className="w-3 h-3" /> },
};

export function LiveStatusHUD({ engineStatus, roundStatus, roundNumber }: LiveStatusHUDProps) {
  const [tickAge, setTickAge] = useState<number>(0);
  
  useEffect(() => {
    if (!engineStatus.lastTick) return;
    
    const updateAge = () => {
      const age = (Date.now() - new Date(engineStatus.lastTick!).getTime()) / 1000;
      setTickAge(age);
    };
    
    updateAge();
    const interval = setInterval(updateAge, 500);
    return () => clearInterval(interval);
  }, [engineStatus.lastTick]);

  const isConnected = engineStatus.isEnabled && tickAge < 5;
  const statusConfig = roundStatus ? STATUS_CONFIG[roundStatus] : null;

  return (
    <div className="fixed top-20 left-4 z-40 flex flex-col gap-2">
      {/* Connection Status */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md border",
        isConnected 
          ? "bg-success/20 border-success/30 text-success" 
          : "bg-destructive/20 border-destructive/30 text-destructive"
      )}>
        {isConnected ? (
          <>
            <Wifi className="w-3 h-3" />
            <span>Live</span>
            <span className="opacity-70">({tickAge.toFixed(1)}s)</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3 h-3" />
            <span>Offline</span>
          </>
        )}
      </div>

      {/* Round Status */}
      {roundStatus && statusConfig && (
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md border bg-background/50 border-border/30",
          statusConfig.color
        )}>
          {statusConfig.icon}
          <span>{statusConfig.label}</span>
          {roundNumber && <span className="opacity-70">#{roundNumber}</span>}
        </div>
      )}

      {/* Error indicator */}
      {engineStatus.error && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md border bg-destructive/20 border-destructive/30 text-destructive">
          <AlertTriangle className="w-3 h-3" />
          <span className="truncate max-w-[150px]">{engineStatus.error}</span>
        </div>
      )}
    </div>
  );
}
