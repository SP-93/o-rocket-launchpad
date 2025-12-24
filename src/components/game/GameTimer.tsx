import { useEffect, useState } from 'react';
import { Clock, Zap } from 'lucide-react';

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

  if (status !== 'betting') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card/50 border border-border/30">
        <Zap className="w-3 h-3 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          {status === 'flying' ? 'Flying' : 
           status === 'countdown' ? 'Starting' :
           status === 'crashed' ? 'Crashed' : 'Waiting'}
        </span>
      </div>
    );
  }

  const isUrgent = timeLeft <= 5;
  const progress = (timeLeft / bettingDuration) * 100;

  return (
    <div className={`relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all duration-300 ${
      isUrgent 
        ? 'bg-destructive/10 border-destructive/30' 
        : 'bg-primary/10 border-primary/30'
    }`}>
      <Clock className={`w-3 h-3 ${isUrgent ? 'text-destructive animate-pulse' : 'text-primary'}`} />
      <span className={`text-xs font-bold font-mono ${isUrgent ? 'text-destructive' : 'text-primary'}`}>
        {timeLeft}s
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
};

export default GameTimer;
