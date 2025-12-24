import { useState } from 'react';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Play, Square, Settings, Rocket, Clock, 
  Zap, AlertTriangle, CheckCircle, Loader2,
  Timer, TrendingUp, Pause
} from 'lucide-react';
import { useAutoGameLoop } from '@/hooks/useAutoGameLoop';
import { cn } from '@/lib/utils';

const PHASE_CONFIG = {
  idle: { label: 'Idle', color: 'text-muted-foreground', icon: Pause },
  betting: { label: 'Betting', color: 'text-primary', icon: Timer },
  countdown: { label: 'Countdown', color: 'text-warning', icon: Clock },
  flying: { label: 'Flying', color: 'text-success', icon: Rocket },
  crashed: { label: 'Crashed!', color: 'text-destructive', icon: Zap },
  payout: { label: 'Payouts', color: 'text-info', icon: CheckCircle },
  pausing: { label: 'Next Round...', color: 'text-muted-foreground', icon: Pause },
};

const AutoGameControl = () => {
  const { state, config, startAutoPlay, stopAutoPlay, updateConfig } = useAutoGameLoop();
  const [showSettings, setShowSettings] = useState(false);

  const phaseConfig = PHASE_CONFIG[state.currentPhase];
  const PhaseIcon = phaseConfig.icon;

  return (
    <div className="space-y-4">
      {/* Main Control Card */}
      <GlowCard className="p-6" glowColor={state.isRunning ? 'cyan' : 'purple'}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-3 h-3 rounded-full",
              state.isRunning ? "bg-success animate-pulse" : "bg-muted"
            )} />
            <h3 className="text-lg font-semibold">Auto Game Loop</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className={cn("w-4 h-4", showSettings && "text-primary")} />
          </Button>
        </div>

        {/* Status Display */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-background/50 rounded-lg p-3 border border-border/30">
            <p className="text-xs text-muted-foreground">Status</p>
            <div className={cn("flex items-center gap-2 mt-1", phaseConfig.color)}>
              <PhaseIcon className="w-4 h-4" />
              <span className="font-semibold">{phaseConfig.label}</span>
            </div>
          </div>
          
          <div className="bg-background/50 rounded-lg p-3 border border-border/30">
            <p className="text-xs text-muted-foreground">Round #</p>
            <p className="text-xl font-bold">{state.roundNumber || '---'}</p>
          </div>
          
          <div className="bg-background/50 rounded-lg p-3 border border-border/30">
            <p className="text-xs text-muted-foreground">Multiplier</p>
            <p className={cn(
              "text-xl font-bold font-mono",
              state.currentPhase === 'crashed' ? "text-destructive" : 
              state.currentPhase === 'flying' ? "text-success" : ""
            )}>
              {state.multiplier.toFixed(2)}x
            </p>
          </div>
          
          <div className="bg-background/50 rounded-lg p-3 border border-border/30">
            <p className="text-xs text-muted-foreground">
              {state.currentPhase === 'flying' ? 'Flying...' : 'Time Left'}
            </p>
            <p className="text-xl font-bold font-mono">
              {state.currentPhase === 'flying' ? (
                <TrendingUp className="w-5 h-5 text-success animate-pulse" />
              ) : (
                `${state.timeRemaining}s`
              )}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        {state.isRunning && state.currentPhase !== 'idle' && (
          <div className="mb-4">
            <div className="h-2 bg-background/50 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-300",
                  state.currentPhase === 'betting' ? "bg-primary" :
                  state.currentPhase === 'countdown' ? "bg-warning" :
                  state.currentPhase === 'flying' ? "bg-success animate-pulse" :
                  state.currentPhase === 'crashed' ? "bg-destructive" :
                  "bg-muted"
                )}
                style={{ 
                  width: state.currentPhase === 'flying' 
                    ? `${Math.min(100, (state.multiplier - 1) * 20)}%`
                    : state.timeRemaining > 0 
                      ? `${100 - (state.timeRemaining / config.bettingDuration) * 100}%`
                      : '100%'
                }}
              />
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="flex items-center justify-between text-sm mb-4">
          <div className="text-muted-foreground">
            Total rounds played: <span className="font-medium text-foreground">{state.totalRoundsPlayed}</span>
          </div>
          {state.crashPoint && (
            <div className="text-muted-foreground">
              Last crash: <span className="font-medium text-destructive">{state.crashPoint.toFixed(2)}x</span>
            </div>
          )}
        </div>

        {/* Last Action - helpful for debugging */}
        {state.lastAction && state.isRunning && (
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Last action: <code className="bg-background/50 px-1 rounded">{state.lastAction}</code></span>
          </div>
        )}

        {/* Error Display */}
        {state.error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-sm font-medium">Error</span>
                <p className="text-xs mt-0.5 opacity-80">{state.error}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Will auto-retry in 5 seconds if still running...
            </p>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex gap-3">
          {!state.isRunning ? (
            <NeonButton onClick={startAutoPlay} className="flex-1">
              <Play className="w-4 h-4 mr-2" />
              Start Auto Game
            </NeonButton>
          ) : (
            <NeonButton 
              onClick={stopAutoPlay} 
              variant="destructive"
              className="flex-1"
            >
              <Square className="w-4 h-4 mr-2" />
              Stop Auto Game
            </NeonButton>
          )}
        </div>
      </GlowCard>

      {/* Settings Panel */}
      {showSettings && (
        <GlowCard className="p-4" glowColor="purple">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Game Loop Settings
          </h4>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Betting Duration (sec)</Label>
              <Input
                type="number"
                min={5}
                max={60}
                value={config.bettingDuration}
                onChange={(e) => updateConfig({ bettingDuration: parseInt(e.target.value) || 15 })}
                disabled={state.isRunning}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label className="text-xs">Countdown (sec)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={config.countdownDuration}
                onChange={(e) => updateConfig({ countdownDuration: parseInt(e.target.value) || 3 })}
                disabled={state.isRunning}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label className="text-xs">Min Flying (sec)</Label>
              <Input
                type="number"
                min={2}
                max={30}
                value={config.minFlyingDuration}
                onChange={(e) => updateConfig({ minFlyingDuration: parseInt(e.target.value) || 3 })}
                disabled={state.isRunning}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label className="text-xs">Max Flying (sec)</Label>
              <Input
                type="number"
                min={5}
                max={60}
                value={config.maxFlyingDuration}
                onChange={(e) => updateConfig({ maxFlyingDuration: parseInt(e.target.value) || 15 })}
                disabled={state.isRunning}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label className="text-xs">Pause Between Rounds (sec)</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={config.pauseBetweenRounds}
                onChange={(e) => updateConfig({ pauseBetweenRounds: parseInt(e.target.value) || 3 })}
                disabled={state.isRunning}
                className="mt-1"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            ⚠️ Settings can only be changed when auto-game is stopped.
          </p>
        </GlowCard>
      )}
    </div>
  );
};

export default AutoGameControl;
