import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import GlowCard from '@/components/ui/GlowCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { NETWORK_CONFIG } from '@/config/admin';
import { useAccount } from 'wagmi';

interface BetStats {
  total: number;
  active: number;
  won: number;
  lost: number;
  claiming: number;
  claimed: number;
  pendingLiability: number;
}

interface RecentBet {
  id: string;
  wallet_address: string;
  bet_amount: number;
  status: string;
  winnings: number | null;
  cashed_out_at: number | null;
  claim_tx_hash: string | null;
  created_at: string;
}

interface StuckClaim {
  id: string;
  winnings: number;
  claiming_started_at: string;
}

const BetsOverviewPanel = () => {
  const [stats, setStats] = useState<BetStats | null>(null);
  const [recentBets, setRecentBets] = useState<RecentBet[]>([]);
  const [stuckClaims, setStuckClaims] = useState<StuckClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  
  const { address: walletAddress } = useAccount();

  const fetchData = useCallback(async () => {
    if (!walletAddress) {
      setIsLoading(false);
      return;
    }

    try {
      // Use edge function to bypass RLS
      const { data, error } = await supabase.functions.invoke('game-admin-stats', {
        body: { 
          wallet_address: walletAddress,
          action: 'all'
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setStats(data.stats || null);
      setRecentBets(data.recentBets || []);
      setStuckClaims(data.stuckClaims || []);
    } catch (error: any) {
      console.error('Error fetching bets data:', error);
      if (error.message?.includes('Unauthorized')) {
        toast.error('Admin access required');
      }
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleResetStuckClaims = async () => {
    setIsResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('game-reset-stuck-claims', {});
      if (error) throw error;
      toast.success(`Reset ${data?.resetCount || 0} stuck claims`);
      await fetchData();
    } catch (error: any) {
      toast.error('Failed to reset stuck claims: ' + (error.message || 'Unknown error'));
    } finally {
      setIsResetting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="outline" className="text-primary border-primary/30">Active</Badge>;
      case 'won':
        return <Badge variant="outline" className="text-success border-success/30">Won</Badge>;
      case 'lost':
        return <Badge variant="outline" className="text-destructive border-destructive/30">Lost</Badge>;
      case 'claiming':
        return <Badge variant="outline" className="text-warning border-warning/30">Claiming</Badge>;
      case 'claimed':
        return <Badge variant="outline" className="text-success border-success/30">Claimed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (isLoading) {
    return (
      <GlowCard className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </GlowCard>
    );
  }

  if (!walletAddress) {
    return (
      <GlowCard className="p-6">
        <div className="text-center py-8 text-muted-foreground">
          Connect wallet to view stats
        </div>
      </GlowCard>
    );
  }

  return (
    <GlowCard className="p-6" glowColor="cyan">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Bets Overview
        </h3>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-background/50 rounded-lg p-3 border border-border/30">
            <p className="text-xs text-muted-foreground">Total Bets</p>
            <p className="text-xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-success/10 rounded-lg p-3 border border-success/30">
            <p className="text-xs text-success">Won</p>
            <p className="text-xl font-bold text-success">{stats.won}</p>
          </div>
          <div className="bg-destructive/10 rounded-lg p-3 border border-destructive/30">
            <p className="text-xs text-destructive">Lost</p>
            <p className="text-xl font-bold text-destructive">{stats.lost}</p>
          </div>
          <div className="bg-warning/10 rounded-lg p-3 border border-warning/30">
            <p className="text-xs text-warning">Claiming</p>
            <p className="text-xl font-bold text-warning">{stats.claiming}</p>
          </div>
          <div className="bg-background/50 rounded-lg p-3 border border-border/30">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-xl font-bold">{stats.active}</p>
          </div>
          <div className="bg-background/50 rounded-lg p-3 border border-border/30">
            <p className="text-xs text-muted-foreground">Claimed</p>
            <p className="text-xl font-bold">{stats.claimed}</p>
          </div>
          <div className="bg-primary/10 rounded-lg p-3 border border-primary/30 col-span-2">
            <p className="text-xs text-primary">Pending Liability</p>
            <p className="text-xl font-bold text-primary">{stats.pendingLiability.toFixed(2)} WOVER</p>
          </div>
        </div>
      )}

      {/* Stuck Claims Section */}
      {stuckClaims.length > 0 && (
        <div className="mb-6 p-4 bg-warning/10 rounded-lg border border-warning/30">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-warning flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Stuck Claims ({stuckClaims.length})
            </h4>
            <Button
              size="sm"
              variant="outline"
              className="text-warning border-warning/30 hover:bg-warning/10"
              onClick={handleResetStuckClaims}
              disabled={isResetting}
            >
              {isResetting ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
              Reset All
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            These bets have been in "claiming" status for over 5 minutes. Click reset to unlock them.
          </p>
        </div>
      )}

      {/* Recent Bets Table */}
      <div>
        <h4 className="font-semibold mb-3">Recent Bets</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left py-2 px-2 text-muted-foreground font-medium">Wallet</th>
                <th className="text-right py-2 px-2 text-muted-foreground font-medium">Amount</th>
                <th className="text-center py-2 px-2 text-muted-foreground font-medium">Status</th>
                <th className="text-right py-2 px-2 text-muted-foreground font-medium">Winnings</th>
                <th className="text-right py-2 px-2 text-muted-foreground font-medium">TX</th>
              </tr>
            </thead>
            <tbody>
              {recentBets.slice(0, 15).map((bet) => (
                <tr key={bet.id} className="border-b border-border/20 hover:bg-background/30">
                  <td className="py-2 px-2 font-mono text-xs">{truncateAddress(bet.wallet_address)}</td>
                  <td className="py-2 px-2 text-right">{bet.bet_amount} WOVER</td>
                  <td className="py-2 px-2 text-center">{getStatusBadge(bet.status)}</td>
                  <td className="py-2 px-2 text-right">
                    {bet.winnings ? (
                      <span className="text-success">{bet.winnings.toFixed(2)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {bet.claim_tx_hash ? (
                      <a
                        href={`${NETWORK_CONFIG.blockExplorerUrls[0]}/tx/${bet.claim_tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {recentBets.length === 0 && (
          <p className="text-center text-muted-foreground py-4">No bets yet</p>
        )}
      </div>
    </GlowCard>
  );
};

export default BetsOverviewPanel;
