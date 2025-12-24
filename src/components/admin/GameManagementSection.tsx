import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { supabase } from '@/integrations/supabase/client';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { 
  Rocket, Play, Pause, RefreshCw, DollarSign, 
  Users, TrendingUp, Clock, AlertTriangle, CheckCircle,
  Loader2, Settings, Wallet, PlayCircle, StopCircle,
  Zap, Timer, Target, RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useCrashGameContract } from '@/hooks/useCrashGameContract';
import { useWallet } from '@/hooks/useWallet';
import { getDeployedContracts, getDeployedContractsAsync } from '@/contracts/storage';

interface GamePool {
  id: string;
  current_balance: number;
  total_deposits: number;
  total_payouts: number;
  last_refill_at: string | null;
}

interface GameRevenue {
  id: string;
  pending_wover: number;
  pending_usdt: number;
  total_wover_collected: number;
  total_usdt_collected: number;
  last_distribution_at: string | null;
}

interface GameConfig {
  game_enabled: boolean;
  min_bet: number;
  max_bet: number;
  betting_duration: number;
  max_multiplier: number;
  instant_crash_probability: number;
}

interface GameStatus {
  active: boolean;
  reason?: string;
}

interface RoundStats {
  total_rounds: number;
  total_bets: number;
  total_wagered: number;
  total_payouts: number;
  avg_crash_point: number;
}

interface CurrentRound {
  id: string;
  round_number: number;
  status: string;
  server_seed_hash?: string;
  crash_point?: number;
}

const GameManagementSection = () => {
  const { getProvider } = useWallet();
  const { refillPrizePool, fetchContractState, contractState } = useCrashGameContract();
  
  const [pool, setPool] = useState<GamePool | null>(null);
  const [revenue, setRevenue] = useState<GameRevenue | null>(null);
  const [config, setConfig] = useState<GameConfig>({
    game_enabled: true,
    min_bet: 1,
    max_bet: 100,
    betting_duration: 15,
    max_multiplier: 100,
    instant_crash_probability: 3,
  });
  const [gameStatus, setGameStatus] = useState<GameStatus>({ active: false, reason: 'Unknown' });
  const [currentRound, setCurrentRound] = useState<CurrentRound | null>(null);
  const [stats, setStats] = useState<RoundStats>({
    total_rounds: 0,
    total_bets: 0,
    total_wagered: 0,
    total_payouts: 0,
    avg_crash_point: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefilling, setIsRefilling] = useState(false);
  const [isTogglingGame, setIsTogglingGame] = useState(false);
  const [isRunningRound, setIsRunningRound] = useState(false);
  const [roundPhase, setRoundPhase] = useState<string | null>(null);
  const [refillAmount, setRefillAmount] = useState('');
  const [onChainBalance, setOnChainBalance] = useState<string | null>(null);

  // Auto-cycling state
  const [isAutoCycling, setIsAutoCycling] = useState(false);
  const [roundDelay, setRoundDelay] = useState(5);
  const [nextRoundCountdown, setNextRoundCountdown] = useState<number | null>(null);
  const autoCycleRef = useRef<boolean>(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchData();
    fetchOnChainBalance();
    fetchGameStatus();
  }, []);

  const fetchGameStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('game-round-manager', {
        body: { action: 'get_status' },
      });

      if (!error && data) {
        setGameStatus({ 
          active: data.game_active, 
          reason: data.game_paused_reason || undefined 
        });
        setCurrentRound(data.current_round);
      }
    } catch (error) {
      console.error('Failed to fetch game status:', error);
    }
  };

  const fetchOnChainBalance = async () => {
    try {
      const contracts = await getDeployedContractsAsync();
      if (!contracts.crashGame) {
        setOnChainBalance(null);
        return;
      }
      
      const state = await fetchContractState();
      if (state) {
        setOnChainBalance(state.prizePool);
        const onChainBalanceNum = parseFloat(state.prizePool);
        if (!isNaN(onChainBalanceNum)) {
          await supabase
            .from('game_pool')
            .update({ 
              current_balance: onChainBalanceNum,
              updated_at: new Date().toISOString()
            })
            .neq('id', '00000000-0000-0000-0000-000000000000');
        }
      } else {
        setOnChainBalance(null);
      }
    } catch (error) {
      console.error('Failed to fetch on-chain balance:', error);
      setOnChainBalance(null);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: poolData } = await supabase
        .from('game_pool')
        .select('*')
        .limit(1)
        .single();
      
      if (poolData) setPool(poolData);

      const { data: revenueData } = await supabase
        .from('game_revenue')
        .select('*')
        .limit(1)
        .single();
      
      if (revenueData) setRevenue(revenueData);

      const { data: configData } = await supabase
        .from('game_config')
        .select('config_key, config_value');
      
      if (configData) {
        const configMap: Record<string, any> = {};
        configData.forEach((item) => {
          configMap[item.config_key] = item.config_value;
        });
        setConfig({
          game_enabled: configMap.game_enabled ?? true,
          min_bet: configMap.min_bet ?? 1,
          max_bet: configMap.max_bet ?? 100,
          betting_duration: configMap.betting_duration ?? 15,
          max_multiplier: configMap.max_multiplier ?? 100,
          instant_crash_probability: configMap.instant_crash_probability ?? 3,
        });

        if (configMap.game_status) {
          setGameStatus(configMap.game_status);
        }
      }

      const { data: roundsData } = await supabase
        .from('game_rounds')
        .select('crash_point, total_bets, total_wagered, total_payouts');
      
      if (roundsData && roundsData.length > 0) {
        const totalRounds = roundsData.length;
        const totalBets = roundsData.reduce((sum, r) => sum + (r.total_bets || 0), 0);
        const totalWagered = roundsData.reduce((sum, r) => sum + (r.total_wagered || 0), 0);
        const totalPayouts = roundsData.reduce((sum, r) => sum + (r.total_payouts || 0), 0);
        const crashedRounds = roundsData.filter(r => r.crash_point !== null);
        const avgCrashPoint = crashedRounds.length > 0 
          ? crashedRounds.reduce((sum, r) => sum + (r.crash_point || 0), 0) / crashedRounds.length 
          : 0;
        
        setStats({
          total_rounds: totalRounds,
          total_bets: totalBets,
          total_wagered: totalWagered,
          total_payouts: totalPayouts,
          avg_crash_point: avgCrashPoint,
        });
      }
    } catch (error) {
      console.error('Failed to fetch game data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleGame = async () => {
    setIsTogglingGame(true);
    try {
      const newStatus = { 
        active: !gameStatus.active, 
        reason: gameStatus.active ? 'Paused by admin' : undefined 
      };

      const { data: existing } = await supabase
        .from('game_config')
        .select('id')
        .eq('config_key', 'game_status')
        .single();

      if (existing) {
        await supabase
          .from('game_config')
          .update({ config_value: newStatus })
          .eq('config_key', 'game_status');
      } else {
        await supabase
          .from('game_config')
          .insert({ config_key: 'game_status', config_value: newStatus });
      }

      setGameStatus(newStatus);
      toast.success(newStatus.active ? 'Game resumed!' : 'Game paused');
    } catch (error: any) {
      toast.error('Failed to toggle game: ' + error.message);
    } finally {
      setIsTogglingGame(false);
    }
  };

  const handleRunRoundCycle = async () => {
    if (!gameStatus.active) {
      toast.error('Game is paused. Resume it first.');
      return;
    }

    setIsRunningRound(true);
    try {
      setRoundPhase('Starting round...');
      const { data: startData, error: startError } = await supabase.functions.invoke('game-round-manager', {
        body: { action: 'start_round' },
      });
      
      if (startError) {
        throw new Error(startError.message || 'Failed to start round');
      }

      if (!startData?.success || !startData?.round) {
        throw new Error(startData?.error || 'No round data returned');
      }

      const roundId = startData.round.id;
      const roundNumber = startData.round.round_number;
      toast.success(`Round #${roundNumber} started!`);

      const bettingDuration = config.betting_duration || 15;
      setRoundPhase(`Betting phase (${bettingDuration}s)...`);
      await sleep(bettingDuration * 1000);

      setRoundPhase('Countdown...');
      const { error: countdownError } = await supabase.functions.invoke('game-round-manager', {
        body: { action: 'start_countdown', round_id: roundId },
      });
      if (countdownError) throw new Error('Failed to start countdown');
      
      await sleep(3000);

      setRoundPhase('Flying! 🚀');
      const { error: flyingError } = await supabase.functions.invoke('game-round-manager', {
        body: { action: 'start_flying', round_id: roundId },
      });
      if (flyingError) throw new Error('Failed to start flying');

      const flyDuration = 2000 + Math.random() * 8000;
      await sleep(flyDuration);

      setRoundPhase('Crashing...');
      const { data: crashData, error: crashError } = await supabase.functions.invoke('game-round-manager', {
        body: { action: 'crash', round_id: roundId },
      });
      if (crashError) throw new Error(crashError.message || 'Failed to crash');

      const crashPoint = crashData?.crash_point || '?';
      toast.info(`💥 Crashed at ${crashPoint}x`);

      setRoundPhase('Processing payouts...');
      const { data: payoutData, error: payoutError } = await supabase.functions.invoke('game-round-manager', {
        body: { action: 'process_payouts', round_id: roundId },
      });
      if (payoutError) {
        console.error('Payout error:', payoutError);
      }

      const totalPayouts = payoutData?.total_payouts || 0;
      const winnerCount = payoutData?.winning_bets || 0;

      setRoundPhase(null);
      toast.success(`Round #${roundNumber} complete! ${winnerCount} winners, ${totalPayouts} WOVER paid out`);
      
      fetchData();
      fetchGameStatus();

    } catch (error: any) {
      console.error('Round cycle error:', error);
      toast.error('Round cycle failed: ' + error.message);
      setRoundPhase(null);
    } finally {
      setIsRunningRound(false);
    }
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const runAutoCycle = useCallback(async () => {
    if (!autoCycleRef.current || !gameStatus.active) {
      setIsAutoCycling(false);
      return;
    }

    setIsRunningRound(true);

    try {
      setRoundPhase('Starting round...');
      const { data: startData, error: startError } = await supabase.functions.invoke('game-round-manager', {
        body: { action: 'start_round' },
      });
      
      if (startError || !startData?.success) {
        throw new Error(startError?.message || startData?.error || 'Failed to start round');
      }

      const roundId = startData.round.id;
      const roundNumber = startData.round.round_number;

      const bettingDuration = config.betting_duration || 15;
      setRoundPhase(`Betting (${bettingDuration}s)...`);
      await sleep(bettingDuration * 1000);

      if (!autoCycleRef.current) return;

      setRoundPhase('Countdown...');
      await supabase.functions.invoke('game-round-manager', {
        body: { action: 'start_countdown', round_id: roundId },
      });
      await sleep(3000);

      if (!autoCycleRef.current) return;

      setRoundPhase('Flying! 🚀');
      await supabase.functions.invoke('game-round-manager', {
        body: { action: 'start_flying', round_id: roundId },
      });

      const flyDuration = 2000 + Math.random() * 8000;
      await sleep(flyDuration);

      if (!autoCycleRef.current) return;

      setRoundPhase('Crashing...');
      await supabase.functions.invoke('game-round-manager', {
        body: { action: 'crash', round_id: roundId },
      });

      setRoundPhase('Payouts...');
      await supabase.functions.invoke('game-round-manager', {
        body: { action: 'process_payouts', round_id: roundId },
      });

      setRoundPhase(null);
      setIsRunningRound(false);

      if (autoCycleRef.current) {
        setNextRoundCountdown(roundDelay);
        
        let countdown = roundDelay;
        countdownIntervalRef.current = setInterval(() => {
          countdown--;
          setNextRoundCountdown(countdown);
          if (countdown <= 0) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
            }
            setNextRoundCountdown(null);
          }
        }, 1000);

        await sleep(roundDelay * 1000);
        
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
        setNextRoundCountdown(null);

        if (autoCycleRef.current && gameStatus.active) {
          runAutoCycle();
        }
      }

    } catch (error: any) {
      console.error('Auto-cycle error:', error);
      toast.error('Auto-cycle error: ' + error.message);
      setRoundPhase(null);
      setIsRunningRound(false);
      autoCycleRef.current = false;
      setIsAutoCycling(false);
    }
  }, [config.betting_duration, roundDelay, gameStatus.active]);

  const handleStartAutoCycle = async () => {
    if (!gameStatus.active) {
      toast.error('Game is paused. Resume it first.');
      return;
    }

    autoCycleRef.current = true;
    setIsAutoCycling(true);
    toast.success('Auto-cycling started!');
    runAutoCycle();
  };

  const handleStopAutoCycle = async () => {
    autoCycleRef.current = false;
    setIsAutoCycling(false);
    setNextRoundCountdown(null);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    toast.info('Auto-cycling stopped');
  };

  const handleRefillPool = async () => {
    if (!refillAmount) {
      toast.error('Enter refill amount');
      return;
    }

    setIsRefilling(true);
    try {
      const provider = await getProvider();
      if (!provider) throw new Error('Connect wallet first');
      
      const ethersProvider = new ethers.providers.Web3Provider(provider as any);
      const signer = ethersProvider.getSigner();
      
      await refillPrizePool(signer, refillAmount);
      setRefillAmount('');
      fetchOnChainBalance();
      fetchData();
    } catch (error: any) {
      toast.error('Refill failed: ' + error.message);
    } finally {
      setIsRefilling(false);
    }
  };

  const handleUpdateConfig = async (key: string, value: any) => {
    try {
      const { data: existing } = await supabase
        .from('game_config')
        .select('id')
        .eq('config_key', key)
        .single();

      if (existing) {
        await supabase
          .from('game_config')
          .update({ config_value: value })
          .eq('config_key', key);
      } else {
        await supabase
          .from('game_config')
          .insert({ config_key: key, config_value: value });
      }

      toast.success(`${key} updated`);
    } catch (error: any) {
      toast.error('Failed to update config: ' + error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Game Status Banner */}
      <div className={`rounded-lg p-4 border ${gameStatus.active ? 'bg-success/10 border-success/30' : 'bg-warning/10 border-warning/30'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {gameStatus.active ? (
              <CheckCircle className="w-6 h-6 text-success" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-warning" />
            )}
            <div>
              <p className="font-semibold">
                Game is {gameStatus.active ? 'ACTIVE' : 'PAUSED'}
              </p>
              {gameStatus.reason && !gameStatus.active && (
                <p className="text-xs text-muted-foreground">{gameStatus.reason}</p>
              )}
            </div>
          </div>
          
          <NeonButton
            variant={gameStatus.active ? 'secondary' : 'primary'}
            onClick={handleToggleGame}
            disabled={isTogglingGame}
          >
            {isTogglingGame ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : gameStatus.active ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pause Game
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Resume Game
              </>
            )}
          </NeonButton>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlowCard className="p-4" glowColor="cyan">
          <div className="flex items-center gap-2 mb-2">
            <Rocket className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Total Rounds</span>
          </div>
          <p className="text-2xl font-bold">{stats.total_rounds}</p>
        </GlowCard>

        <GlowCard className="p-4" glowColor="purple">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Total Bets</span>
          </div>
          <p className="text-2xl font-bold">{stats.total_bets}</p>
        </GlowCard>

        <GlowCard className="p-4" glowColor="cyan">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Total Wagered</span>
          </div>
          <p className="text-2xl font-bold">{stats.total_wagered.toFixed(0)}</p>
        </GlowCard>

        <GlowCard className="p-4" glowColor="purple">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Avg Crash</span>
          </div>
          <p className="text-2xl font-bold">{stats.avg_crash_point.toFixed(2)}×</p>
        </GlowCard>
      </div>

      {/* On-Chain Prize Pool */}
      <GlowCard className="p-6" glowColor="cyan">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" />
          On-Chain Prize Pool
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-background/50 rounded-lg p-4 border border-border/30">
            <p className="text-xs text-muted-foreground mb-1">Contract Balance</p>
            <p className="text-2xl font-bold text-primary">
              {onChainBalance ? `${parseFloat(onChainBalance).toFixed(2)} WOVER` : 'N/A'}
            </p>
            {contractState?.isPoolLow && (
              <Badge variant="destructive" className="mt-2">Low Pool Warning</Badge>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-sm">Refill Amount (WOVER)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="1000"
                value={refillAmount}
                onChange={(e) => setRefillAmount(e.target.value)}
              />
              <NeonButton
                onClick={handleRefillPool}
                disabled={isRefilling || !refillAmount}
              >
                {isRefilling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refill'}
              </NeonButton>
            </div>
          </div>
        </div>
      </GlowCard>

      {/* Round Control */}
      <GlowCard className="p-6" glowColor="purple">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          Round Control
        </h3>

        {roundPhase && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="font-medium">{roundPhase}</span>
            </div>
          </div>
        )}

        {nextRoundCountdown !== null && (
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-warning" />
              <span>Next round in {nextRoundCountdown}s...</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <NeonButton
              onClick={handleRunRoundCycle}
              disabled={isRunningRound || isAutoCycling || !gameStatus.active}
              className="w-full"
            >
              {isRunningRound ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <PlayCircle className="w-4 h-4 mr-2" />
              )}
              Run Single Round
            </NeonButton>
          </div>

          <div className="space-y-3">
            {isAutoCycling ? (
              <NeonButton
                variant="secondary"
                onClick={handleStopAutoCycle}
                className="w-full text-destructive"
              >
                <StopCircle className="w-4 h-4 mr-2" />
                Stop Auto-Cycle
              </NeonButton>
            ) : (
              <NeonButton
                onClick={handleStartAutoCycle}
                disabled={isRunningRound || !gameStatus.active}
                className="w-full"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Start Auto-Cycle
              </NeonButton>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <Label className="text-xs">Delay between rounds:</Label>
          <Input
            type="number"
            min={1}
            max={60}
            value={roundDelay}
            onChange={(e) => setRoundDelay(Number(e.target.value))}
            className="w-20"
          />
          <span className="text-xs text-muted-foreground">seconds</span>
        </div>
      </GlowCard>

      {/* Current Round Info */}
      {currentRound && (
        <GlowCard className="p-6" glowColor="cyan">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Current Round
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-background/50 rounded-lg p-3 border border-border/30">
              <p className="text-xs text-muted-foreground">Round #</p>
              <p className="text-xl font-bold">{currentRound.round_number}</p>
            </div>
            <div className="bg-background/50 rounded-lg p-3 border border-border/30">
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant="outline">{currentRound.status}</Badge>
            </div>
            <div className="bg-background/50 rounded-lg p-3 border border-border/30">
              <p className="text-xs text-muted-foreground">Crash Point</p>
              <p className="text-xl font-bold text-destructive">
                {currentRound.crash_point ? `${currentRound.crash_point}×` : '---'}
              </p>
            </div>
            <div className="bg-background/50 rounded-lg p-3 border border-border/30">
              <p className="text-xs text-muted-foreground">ID</p>
              <code className="text-xs font-mono">{currentRound.id.slice(0, 8)}...</code>
            </div>
          </div>
        </GlowCard>
      )}

      {/* Refresh Button */}
      <div className="flex justify-center">
        <NeonButton variant="ghost" onClick={() => { fetchData(); fetchGameStatus(); fetchOnChainBalance(); }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh All Data
        </NeonButton>
      </div>
    </div>
  );
};

export default GameManagementSection;
