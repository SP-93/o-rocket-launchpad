import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { supabase } from '@/integrations/supabase/client';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { DollarSign, Coins, RefreshCw, Send, Loader2, TrendingUp, Wallet, Link2, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getDeployedContracts } from '@/contracts/storage';
import { CRASH_GAME_ABI } from '@/contracts/artifacts/crashGame';

interface RevenueData {
  total_wover_collected: number;
  total_usdt_collected: number;
  pending_wover: number;
  pending_usdt: number;
  last_distribution_at: string | null;
}

interface PoolData {
  id?: string;
  current_balance: number;
  total_deposits: number;
  total_payouts: number;
}

interface ContractPoolData {
  prizePool: string;
  totalDeposited: string;
  totalClaimed: string;
}

export default function GameRevenueSection() {
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [pool, setPool] = useState<PoolData | null>(null);
  const [contractPool, setContractPool] = useState<ContractPoolData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDistributing, setIsDistributing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch on-chain contract state
  const fetchContractState = useCallback(async () => {
    try {
      const contracts = getDeployedContracts();
      if (!contracts.crashGame) {
        console.log('[GameRevenue] No CrashGame contract deployed');
        return null;
      }

      const provider = new ethers.providers.JsonRpcProvider('https://rpc.overprotocol.com');
      const contract = new ethers.Contract(contracts.crashGame, CRASH_GAME_ABI, provider);

      const stats = await contract.getStats();
      
      const contractData: ContractPoolData = {
        prizePool: ethers.utils.formatEther(stats.prizePool || stats[0] || 0),
        totalDeposited: ethers.utils.formatEther(stats.totalDeposited || stats[1] || 0),
        totalClaimed: ethers.utils.formatEther(stats.totalClaimed || stats[2] || 0),
      };

      console.log('[GameRevenue] Contract state:', contractData);
      return contractData;
    } catch (error) {
      console.error('[GameRevenue] Failed to fetch contract state:', error);
      return null;
    }
  }, []);

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

      // Fetch pool data from DB
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

      // Fetch on-chain contract state
      const contractData = await fetchContractState();
      if (contractData) {
        setContractPool(contractData);
      }
    } catch (err) {
      console.error('Error fetching game data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchContractState]);

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

  // Sync DB with contract balance
  const handleSyncToDb = async () => {
    if (!contractPool) return;

    setIsSyncing(true);
    try {
      const contractBalance = parseFloat(contractPool.prizePool);
      const contractDeposits = parseFloat(contractPool.totalDeposited);
      const contractPayouts = parseFloat(contractPool.totalClaimed);

      // Update game_pool table
      const { error } = await supabase
        .from('game_pool')
        .upsert({
          id: pool?.id || undefined,
          current_balance: contractBalance,
          total_deposits: contractDeposits,
          total_payouts: contractPayouts,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) throw error;

      toast.success('Database synced with contract balance');
      fetchData();
    } catch (err) {
      console.error('Sync error:', err);
      toast.error('Failed to sync database');
    } finally {
      setIsSyncing(false);
    }
  };

  // Calculate if there's a mismatch
  const hasMismatch = contractPool && pool && 
    Math.abs(parseFloat(contractPool.prizePool) - (pool.current_balance || 0)) > 0.01;

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

      {/* Contract Prize Pool (On-Chain) */}
      {contractPool && (
        <GlowCard className="p-5" glowColor="cyan">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              Prize Pool (On-Chain)
            </h3>
            {hasMismatch && (
              <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Mismatch
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-background/50 rounded-xl p-3 border border-primary/30 text-center">
              <p className="text-xs text-muted-foreground mb-1">Contract Balance</p>
              <p className="text-lg font-bold text-primary">
                {parseFloat(contractPool.prizePool).toFixed(2)}
              </p>
              <p className="text-[10px] text-muted-foreground">WOVER</p>
            </div>
            <div className="bg-background/50 rounded-xl p-3 border border-border/30 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Deposited</p>
              <p className="text-lg font-bold text-success">
                {parseFloat(contractPool.totalDeposited).toFixed(2)}
              </p>
            </div>
            <div className="bg-background/50 rounded-xl p-3 border border-border/30 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Claimed</p>
              <p className="text-lg font-bold text-destructive">
                {parseFloat(contractPool.totalClaimed).toFixed(2)}
              </p>
            </div>
          </div>

          {hasMismatch && (
            <NeonButton
              variant="secondary"
              className="w-full text-sm py-2"
              onClick={handleSyncToDb}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sync Database to Contract
            </NeonButton>
          )}
        </GlowCard>
      )}

      {/* Database Prize Pool (Off-Chain) */}
      <GlowCard className="p-5" glowColor="purple">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-muted-foreground" />
            Prize Pool (Database)
          </h3>
          {!hasMismatch && contractPool && (
            <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Synced
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-background/50 rounded-xl p-3 border border-border/30 text-center">
            <p className="text-xs text-muted-foreground mb-1">Balance</p>
            <p className="text-lg font-bold text-muted-foreground">
              {pool?.current_balance?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div className="bg-background/50 rounded-xl p-3 border border-border/30 text-center">
            <p className="text-xs text-muted-foreground mb-1">Deposits</p>
            <p className="text-lg font-bold text-muted-foreground">
              {pool?.total_deposits?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div className="bg-background/50 rounded-xl p-3 border border-border/30 text-center">
            <p className="text-xs text-muted-foreground mb-1">Payouts</p>
            <p className="text-lg font-bold text-muted-foreground">
              {pool?.total_payouts?.toFixed(2) || '0.00'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Database record for tracking - contract is source of truth</span>
        </div>
      </GlowCard>
    </div>
  );
}
