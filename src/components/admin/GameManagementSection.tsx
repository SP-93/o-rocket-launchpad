import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { 
  Rocket, Play, Pause, RefreshCw, DollarSign, 
  Users, TrendingUp, Clock, AlertTriangle, CheckCircle,
  Loader2, Settings, History, Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

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

interface RoundStats {
  total_rounds: number;
  total_bets: number;
  total_wagered: number;
  total_payouts: number;
  avg_crash_point: number;
}

const GameManagementSection = () => {
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
  const [stats, setStats] = useState<RoundStats>({
    total_rounds: 0,
    total_bets: 0,
    total_wagered: 0,
    total_payouts: 0,
    avg_crash_point: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isDistributing, setIsDistributing] = useState(false);
  const [refillAmount, setRefillAmount] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch pool data
      const { data: poolData } = await supabase
        .from('game_pool')
        .select('*')
        .limit(1)
        .single();
      
      if (poolData) setPool(poolData);

      // Fetch revenue data
      const { data: revenueData } = await supabase
        .from('game_revenue')
        .select('*')
        .limit(1)
        .single();
      
      if (revenueData) setRevenue(revenueData);

      // Fetch config
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
      }

      // Fetch round stats
      const { data: roundsData } = await supabase
        .from('game_rounds')
        .select('crash_point, total_bets, total_wagered, total_payouts');
      
      if (roundsData && roundsData.length > 0) {
        const totalRounds = roundsData.length;
        const totalBets = roundsData.reduce((sum, r) => sum + (r.total_bets || 0), 0);
        const totalWagered = roundsData.reduce((sum, r) => sum + (r.total_wagered || 0), 0);
        const totalPayouts = roundsData.reduce((sum, r) => sum + (r.total_payouts || 0), 0);
        const avgCrashPoint = roundsData.reduce((sum, r) => sum + (r.crash_point || 0), 0) / totalRounds;
        
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

  const handleStartNewRound = async () => {
    try {
      const { error } = await supabase.functions.invoke('game-round-manager', {
        body: { action: 'start_new_round' },
      });
      
      if (error) throw error;
      
      toast.success('New round started!');
      fetchData();
    } catch (error: any) {
      toast.error('Failed to start round: ' + error.message);
    }
  };

  const handleDistributeRevenue = async () => {
    if (!revenue?.pending_wover && !revenue?.pending_usdt) {
      toast.error('No pending revenue to distribute');
      return;
    }
    
    setIsDistributing(true);
    try {
      const { error } = await supabase.functions.invoke('game-admin-distribute', {
        body: { action: 'distribute' },
      });
      
      if (error) throw error;
      
      toast.success('Revenue distributed successfully!');
      fetchData();
    } catch (error: any) {
      toast.error('Distribution failed: ' + error.message);
    } finally {
      setIsDistributing(false);
    }
  };

  const handleRefillPool = async () => {
    const amount = parseFloat(refillAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    
    try {
      // Update pool balance
      const newBalance = (pool?.current_balance || 0) + amount;
      
      const { error } = await supabase
        .from('game_pool')
        .update({ 
          current_balance: newBalance,
          total_deposits: (pool?.total_deposits || 0) + amount,
          last_refill_at: new Date().toISOString()
        })
        .eq('id', pool?.id);
      
      if (error) throw error;
      
      toast.success(`Pool refilled with ${amount} WOVER`);
      setRefillAmount('');
      fetchData();
    } catch (error: any) {
      toast.error('Refill failed: ' + error.message);
    }
  };

  const handleUpdateConfig = async (key: string, value: any) => {
    try {
      // Check if config exists
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
      
      setConfig(prev => ({ ...prev, [key]: value }));
      toast.success(`${key} updated`);
    } catch (error: any) {
      toast.error('Failed to update config: ' + error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlowCard className="p-4" glowColor="cyan">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Rounds</p>
              <p className="text-xl font-bold">{stats.total_rounds}</p>
            </div>
          </div>
        </GlowCard>
        
        <GlowCard className="p-4" glowColor="purple">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Bets</p>
              <p className="text-xl font-bold">{stats.total_bets}</p>
            </div>
          </div>
        </GlowCard>
        
        <GlowCard className="p-4" glowColor="cyan">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Wagered</p>
              <p className="text-xl font-bold">{stats.total_wagered.toFixed(0)}</p>
            </div>
          </div>
        </GlowCard>
        
        <GlowCard className="p-4" glowColor="purple">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Crash</p>
              <p className="text-xl font-bold">{stats.avg_crash_point.toFixed(2)}×</p>
            </div>
          </div>
        </GlowCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prize Pool Management */}
        <GlowCard className="p-6" glowColor="cyan">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-warning" />
            Prize Pool
          </h3>
          
          <div className="space-y-4">
            <div className="bg-background/50 rounded-lg p-4 border border-border/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Current Balance</span>
                <span className={`text-2xl font-bold ${(pool?.current_balance || 0) < 1000 ? 'text-destructive' : 'text-success'}`}>
                  {pool?.current_balance?.toLocaleString() || 0} WOVER
                </span>
              </div>
              {(pool?.current_balance || 0) < 1000 && (
                <div className="flex items-center gap-2 text-destructive text-xs mt-2">
                  <AlertTriangle className="w-3 h-3" />
                  Low balance - consider refilling
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-background/30 p-3 rounded-lg">
                <p className="text-muted-foreground text-xs">Total Deposits</p>
                <p className="font-semibold">{pool?.total_deposits?.toLocaleString() || 0}</p>
              </div>
              <div className="bg-background/30 p-3 rounded-lg">
                <p className="text-muted-foreground text-xs">Total Payouts</p>
                <p className="font-semibold">{pool?.total_payouts?.toLocaleString() || 0}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Amount (WOVER)"
                value={refillAmount}
                onChange={(e) => setRefillAmount(e.target.value)}
                className="flex-1"
              />
              <NeonButton onClick={handleRefillPool} className="px-4">
                <DollarSign className="w-4 h-4 mr-1" /> Refill
              </NeonButton>
            </div>
          </div>
        </GlowCard>

        {/* Revenue Distribution */}
        <GlowCard className="p-6" glowColor="purple">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-success" />
            Pending Revenue
          </h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background/50 rounded-lg p-4 border border-warning/30">
                <p className="text-xs text-muted-foreground mb-1">WOVER</p>
                <p className="text-xl font-bold text-warning">
                  {revenue?.pending_wover?.toLocaleString() || 0}
                </p>
              </div>
              <div className="bg-background/50 rounded-lg p-4 border border-success/30">
                <p className="text-xs text-muted-foreground mb-1">USDT</p>
                <p className="text-xl font-bold text-success">
                  {revenue?.pending_usdt?.toLocaleString() || 0}
                </p>
              </div>
            </div>

            <div className="bg-background/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-2">Distribution Split</p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-primary/10 rounded p-2">
                  <p className="font-semibold">40%</p>
                  <p className="text-muted-foreground">Team</p>
                </div>
                <div className="bg-success/10 rounded p-2">
                  <p className="font-semibold">30%</p>
                  <p className="text-muted-foreground">Liquidity</p>
                </div>
                <div className="bg-warning/10 rounded p-2">
                  <p className="font-semibold">30%</p>
                  <p className="text-muted-foreground">Future</p>
                </div>
              </div>
            </div>

            <NeonButton 
              onClick={handleDistributeRevenue} 
              disabled={isDistributing || (!revenue?.pending_wover && !revenue?.pending_usdt)}
              className="w-full"
            >
              {isDistributing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <DollarSign className="w-4 h-4 mr-2" />
              )}
              Distribute Revenue
            </NeonButton>
          </div>
        </GlowCard>
      </div>

      {/* Game Controls & Config */}
      <GlowCard className="p-6" glowColor="cyan">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          Game Configuration
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Game Status */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="game-enabled" className="flex items-center gap-2">
                {config.game_enabled ? (
                  <CheckCircle className="w-4 h-4 text-success" />
                ) : (
                  <Pause className="w-4 h-4 text-destructive" />
                )}
                Game Status
              </Label>
              <Switch
                id="game-enabled"
                checked={config.game_enabled}
                onCheckedChange={(checked) => handleUpdateConfig('game_enabled', checked)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {config.game_enabled ? 'Game is running' : 'Game is paused'}
            </p>
          </div>

          {/* Betting Duration */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Betting Duration (sec)
            </Label>
            <Input
              type="number"
              value={config.betting_duration}
              onChange={(e) => handleUpdateConfig('betting_duration', parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Max Multiplier */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              Max Multiplier
            </Label>
            <Input
              type="number"
              value={config.max_multiplier}
              onChange={(e) => handleUpdateConfig('max_multiplier', parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Min Bet */}
          <div className="space-y-2">
            <Label>Min Bet (tickets)</Label>
            <Input
              type="number"
              value={config.min_bet}
              onChange={(e) => handleUpdateConfig('min_bet', parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Max Bet */}
          <div className="space-y-2">
            <Label>Max Bet (tickets)</Label>
            <Input
              type="number"
              value={config.max_bet}
              onChange={(e) => handleUpdateConfig('max_bet', parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Instant Crash % */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Instant Crash %
            </Label>
            <Input
              type="number"
              value={config.instant_crash_probability}
              onChange={(e) => handleUpdateConfig('instant_crash_probability', parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-border/30">
          <NeonButton onClick={handleStartNewRound} className="flex-1">
            <Play className="w-4 h-4 mr-2" /> Force Start Round
          </NeonButton>
          <NeonButton variant="secondary" onClick={fetchData} className="px-4">
            <RefreshCw className="w-4 h-4" />
          </NeonButton>
        </div>
      </GlowCard>
    </div>
  );
};

export default GameManagementSection;
