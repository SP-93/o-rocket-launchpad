import { useEffect, useState } from 'react';
import { Clock, Rocket, AlertTriangle, Loader2 } from 'lucide-react';

interface GameTimerProps {
  status: string;
  bettingDuration?: number;
}

const GameTimer = ({ status, bettingDuration = 15 }: GameTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(bettingDuration);

  useEffect(() => {
    if (status === 'betting') {
      setTimeLeft(bettingDuration);
      const interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 0) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setTimeLeft(bettingDuration);
    }
  }, [status, bettingDuration]);

  // Status-based display with clear indicators
  if (status === 'betting') {
    const isUrgent = timeLeft <= 5;
    const progress = (timeLeft / bettingDuration) * 100;

    return (
      <div className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all duration-300 ${
        isUrgent 
          ? 'bg-destructive/20 border-destructive/40 animate-pulse' 
          : 'bg-primary/10 border-primary/30'
      }`}>
        <Clock className={`w-3.5 h-3.5 ${isUrgent ? 'text-destructive' : 'text-primary'}`} />
        <span className={`font-mono font-bold text-sm ${isUrgent ? 'text-destructive' : 'text-primary'}`}>
          {timeLeft}s
        </span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider hidden sm:inline">
          Betting
        </span>
        
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-border/30 rounded-b-lg overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ease-linear ${
              isUrgent ? 'bg-destructive' : 'bg-primary'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (status === 'countdown') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-warning/20 border border-warning/40 animate-pulse">
        <Rocket className="w-3.5 h-3.5 text-warning" />
        <span className="font-bold text-sm text-warning">LAUNCHING</span>
      </div>
    );
  }

  if (status === 'flying') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/20 border border-success/40">
        <Rocket className="w-3.5 h-3.5 text-success animate-bounce" />
        <span className="font-bold text-sm text-success">LIVE</span>
      </div>
    );
  }

  if (status === 'crashed' || status === 'payout') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-destructive/20 border border-destructive/40">
        <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
        <span className="font-bold text-sm text-destructive">CRASHED</span>
      </div>
    );
  }

  // Waiting/idle state
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/30">
      <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
      <span className="text-xs text-muted-foreground">Waiting</span>
    </div>
  );
};

export default GameTimer;
