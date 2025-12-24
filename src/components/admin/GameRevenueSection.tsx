import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { DollarSign, Coins, RefreshCw, Send, Loader2, TrendingUp, Wallet } from 'lucide-react';
import { toast } from 'sonner';

interface RevenueData {
  total_wover_collected: number;
  total_usdt_collected: number;
  pending_wover: number;
  pending_usdt: number;
  last_distribution_at: string | null;
}

interface PoolData {
  current_balance: number;
  total_deposits: number;
  total_payouts: number;
}

export default function GameRevenueSection() {
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [pool, setPool] = useState<PoolData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDistributing, setIsDistributing] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch revenue data
      const { data: revenueData, error: revenueError } = await supabase
        .from('game_revenue')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (revenueError) {
        console.error('Error fetching revenue:', revenueError);
      } else if (revenueData) {
        setRevenue(revenueData as RevenueData);
      }

      // Fetch pool data
      const { data: poolData, error: poolError } = await supabase
        .from('game_pool')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (poolError) {
        console.error('Error fetching pool:', poolError);
      } else if (poolData) {
        setPool(poolData as PoolData);
      }
    } catch (err) {
      console.error('Error fetching game data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDistribute = async () => {
    setIsDistributing(true);
    try {
      const response = await supabase.functions.invoke('game-admin-distribute', {
        body: { action: 'distribute_revenue' },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success('Revenue distributed successfully');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to distribute revenue');
    } finally {
      setIsDistributing(false);
    }
  };

  if (isLoading) {
    return (
      <GlowCard className="p-6" glowColor="purple">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </GlowCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Revenue Section */}
      <GlowCard className="p-5" glowColor="purple">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-success" />
            Ticket Revenue
          </h3>
          <NeonButton variant="secondary" className="text-xs px-2 py-1" onClick={fetchData}>
            <RefreshCw className="w-3 h-3" />
          </NeonButton>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-background/50 rounded-xl p-3 border border-border/30">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Coins className="w-3.5 h-3.5 text-warning" />
              WOVER Collected
            </div>
            <p className="text-xl font-bold text-warning">
              {revenue?.total_wover_collected?.toFixed(2) || '0.00'}
            </p>
            <p className="text-xs text-muted-foreground">
              Pending: {revenue?.pending_wover?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div className="bg-background/50 rounded-xl p-3 border border-border/30">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <DollarSign className="w-3.5 h-3.5 text-success" />
              USDT Collected
            </div>
            <p className="text-xl font-bold text-success">
              {revenue?.total_usdt_collected?.toFixed(2) || '0.00'}
            </p>
            <p className="text-xs text-muted-foreground">
              Pending: {revenue?.pending_usdt?.toFixed(2) || '0.00'}
            </p>
          </div>
        </div>

        {revenue?.last_distribution_at && (
          <p className="text-xs text-muted-foreground mb-3">
            Last distributed: {new Date(revenue.last_distribution_at).toLocaleString()}
          </p>
        )}

        <NeonButton
          variant="primary"
          className="w-full text-sm py-2"
          onClick={handleDistribute}
          disabled={isDistributing || (!revenue?.pending_wover && !revenue?.pending_usdt)}
        >
          {isDistributing ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Distribute Revenue
        </NeonButton>
      </GlowCard>

      {/* Prize Pool Section */}
      <GlowCard className="p-5" glowColor="cyan">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
          <Wallet className="w-5 h-5 text-primary" />
          Prize Pool
        </h3>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-background/50 rounded-xl p-3 border border-border/30 text-center">
            <p className="text-xs text-muted-foreground mb-1">Balance</p>
            <p className="text-lg font-bold text-primary">
              {pool?.current_balance?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div className="bg-background/50 rounded-xl p-3 border border-border/30 text-center">
            <p className="text-xs text-muted-foreground mb-1">Deposits</p>
            <p className="text-lg font-bold text-success">
              {pool?.total_deposits?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div className="bg-background/50 rounded-xl p-3 border border-border/30 text-center">
            <p className="text-xs text-muted-foreground mb-1">Payouts</p>
            <p className="text-lg font-bold text-destructive">
              {pool?.total_payouts?.toFixed(2) || '0.00'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Pool is automatically filled from ticket sales</span>
        </div>
      </GlowCard>
    </div>
  );
}
