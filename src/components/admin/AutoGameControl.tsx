import { useState, useEffect, useCallback } from 'react';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { 
  Play, Square, Rocket, Clock, 
  Zap, AlertTriangle, CheckCircle, Loader2,
  Timer, Pause, Power, RefreshCw
} from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { isAdmin } from '@/config/admin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCrashGameContract } from '@/hooks/useCrashGameContract';
// TicketStatsPanel removed - now only in Admin.tsx Game tab

interface EngineState {
  isEnabled: boolean;
  gameActive: boolean;
  currentRound: any | null;
  prizePool: number;
  lastAction: string | null;
  error: string | null;
  pauseReason: string | null;
  threshold: number;
  activePlayers: number;
}

const PHASE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  idle: { label: 'Idle', color: 'text-muted-foreground', icon: Pause },
  betting: { label: 'Betting', color: 'text-primary', icon: Timer },
  countdown: { label: 'Countdown', color: 'text-warning', icon: Clock },
  flying: { label: 'Flying', color: 'text-success', icon: Rocket },
  crashed: { label: 'Crashed!', color: 'text-destructive', icon: Zap },
  payout: { label: 'Payouts', color: 'text-info', icon: CheckCircle },
};

const AutoGameControl = () => {
  const { address } = useWallet();
  const { fetchContractState } = useCrashGameContract();
  const [state, setState] = useState<EngineState>({
    isEnabled: false,
    gameActive: false,
    currentRound: null,
    prizePool: 0,
    lastAction: null,
    error: null,
    pauseReason: null,
    threshold: 100,
    activePlayers: 0,
  });
  const [onChainBalance, setOnChainBalance] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Fetch current status and on-chain balance
  const fetchStatus = useCallback(async () => {
    try {
      const response = await supabase.functions.invoke('game-round-manager', {
        body: { action: 'get_status' },
      });

      if (response.data) {
        setState(prev => ({
          ...prev,
          isEnabled: response.data.engine_enabled ?? false,
          gameActive: response.data.game_active ?? false,
          currentRound: response.data.current_round,
          prizePool: response.data.prize_pool ?? 0,
          pauseReason: response.data.pause_reason ?? null,
          threshold: response.data.threshold ?? 100,
          activePlayers: response.data.active_players ?? 0,
          error: null,
        }));
        setLastUpdate(new Date());
      }
      
      // Fetch on-chain balance
      const contractState = await fetchContractState();
      if (contractState) {
        setOnChainBalance(contractState.prizePool);
      }
    } catch (err: any) {
      console.error('[AdminEngine] Status fetch failed:', err);
      setState(prev => ({ ...prev, error: err.message }));
    }
  }, [fetchContractState]);

  // Poll for status updates
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Enable engine
  const handleEnableEngine = async () => {
    if (!address || !isAdmin(address)) {
      toast.error('Admin wallet required');
      return;
    }

    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('game-round-manager', {
        body: { action: 'enable_engine', admin_wallet: address },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success('Game engine started!');
      setState(prev => ({ ...prev, isEnabled: true, error: null }));
    } catch (err: any) {
      toast.error(`Failed to start engine: ${err.message}`);
      setState(prev => ({ ...prev, error: err.message }));
    } finally {
      setIsLoading(false);
    }
  };

  // Disable engine with graceful shutdown
  const handleDisableEngine = async () => {
    if (!address || !isAdmin(address)) {
      toast.error('Admin wallet required');
      return;
    }

    // Warn if there's an active flying round
    const currentStatus = state.currentRound?.status;
    if (currentStatus === 'flying') {
      const confirmed = window.confirm(
        `⚠️ Round ${state.currentRound?.round_number} is currently FLYING!\n\n` +
        `Stopping the engine will force crash this round immediately.\n\n` +
        `All active bets will be marked as LOST.\n\n` +
        `Are you sure you want to stop the engine?`
      );
      if (!confirmed) return;
    }

    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('game-round-manager', {
        body: { action: 'disable_engine', admin_wallet: address },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Check if a round was force crashed
      if (response.data?.force_crashed) {
        toast.warning(`Round ${response.data.force_crashed.roundNumber} was force crashed at ${response.data.force_crashed.crashPoint}x`);
      }
      
      toast.info('Game engine stopped');
      setState(prev => ({ ...prev, isEnabled: false }));
    } catch (err: any) {
      toast.error(`Failed to stop engine: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Force crash any stuck round (emergency action)
  const handleForceCrash = async () => {
    if (!address || !isAdmin(address)) {
      toast.error('Admin wallet required');
      return;
    }

    const confirmed = window.confirm(
      `⚠️ This will FORCE CRASH the current round immediately!\n\n` +
      `All active bets will be marked as LOST.\n\n` +
      `Only use this for stuck rounds. Are you sure?`
    );
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('game-round-manager', {
        body: { action: 'force_crash_round', admin_wallet: address },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success(`Round ${response.data.round_number} force crashed at ${response.data.crash_point}x`);
      fetchStatus();
    } catch (err: any) {
      toast.error(`Failed to force crash: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const currentStatus = state.currentRound?.status || 'idle';
  const phaseConfig = PHASE_CONFIG[currentStatus] || PHASE_CONFIG.idle;
  const PhaseIcon = phaseConfig.icon;

  return (
    <div className="space-y-4">
      {/* Main Control Card */}
      <GlowCard className="p-6" glowColor={state.isEnabled ? 'cyan' : 'purple'}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-3 h-3 rounded-full",
              state.isEnabled ? "bg-success animate-pulse" : "bg-muted"
            )} />
            <h3 className="text-lg font-semibold">Game Engine</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {lastUpdate && (
              <span>Updated: {lastUpdate.toLocaleTimeString()}</span>
            )}
          </div>
        </div>

        {/* Engine Status Banner */}
        <div className={cn(
          "rounded-lg p-4 mb-4 border",
          state.isEnabled 
            ? "bg-success/10 border-success/20" 
            : "bg-muted/30 border-border/30"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Power className={cn(
                "w-6 h-6",
                state.isEnabled ? "text-success" : "text-muted-foreground"
              )} />
              <div>
                <p className={cn(
                  "font-semibold",
                  state.isEnabled ? "text-success" : "text-muted-foreground"
                )}>
                  {state.isEnabled ? 'Engine Running' : 'Engine Stopped'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {state.isEnabled 
                    ? 'Game loop is running automatically on the server' 
                    : 'Click Start to begin automatic gameplay'}
                </p>
              </div>
            </div>
          </div>
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
            <p className="text-xl font-bold">{state.currentRound?.round_number || '---'}</p>
          </div>
          
          <div className="bg-background/50 rounded-lg p-3 border border-border/30">
            <p className="text-xs text-muted-foreground">Prize Pool (On-Chain)</p>
            <p className="text-xl font-bold text-warning">
              {onChainBalance ? `${parseFloat(onChainBalance).toLocaleString()} WOVER` : '---'}
            </p>
          </div>
          
          <div className="bg-background/50 rounded-lg p-3 border border-border/30">
            <p className="text-xs text-muted-foreground">
              {currentStatus === 'crashed' ? 'Crash Point' : 'Active Players'}
            </p>
            <p className="text-xl font-bold font-mono">
              {currentStatus === 'crashed' 
                ? `${state.currentRound?.crash_point?.toFixed(2)}x`
                : state.activePlayers}
            </p>
          </div>
        </div>

        {/* Pause Reason Display */}
        {state.pauseReason && !state.gameActive && (
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2 text-warning">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-sm font-medium">Game Paused</span>
                <p className="text-xs mt-0.5 opacity-80">
                  {state.pauseReason} (Threshold: {state.threshold} WOVER)
                </p>
              </div>
            </div>
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
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex gap-3">
          {!state.isEnabled ? (
            <NeonButton 
              onClick={handleEnableEngine} 
              className="flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Start Engine
            </NeonButton>
          ) : (
            <NeonButton 
              onClick={handleDisableEngine} 
              variant="destructive"
              className="flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Square className="w-4 h-4 mr-2" />
              )}
              Stop Engine
            </NeonButton>
          )}
        </div>

        {/* Emergency Force Crash Button - only show when there's an active round */}
        {state.currentRound && ['flying', 'countdown', 'betting'].includes(state.currentRound.status) && (
          <div className="mt-3">
            <NeonButton 
              onClick={handleForceCrash}
              variant="ghost"
              className="w-full border border-destructive/50 text-destructive hover:bg-destructive/10"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <AlertTriangle className="w-4 h-4 mr-2" />
              )}
              Force Crash Round (Emergency)
            </NeonButton>
          </div>
        )}

        {/* Info Text */}
        <div className="mt-4 p-3 bg-muted/20 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>How it works:</strong> The game engine runs on the server. Once started, it automatically 
            manages rounds: betting → countdown → flying → crash → payouts. All game clients help keep 
            the engine ticking by periodically syncing with the server.
          </p>
        </div>
      </GlowCard>

    </div>
  );
};

export default AutoGameControl;
