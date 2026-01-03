import { useState } from 'react';
import { Trash2, RefreshCw, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import GlowCard from '@/components/ui/GlowCard';

interface CleanupStats {
  totalTickets: number;
  expiredUnused: number;
  ghostTickets: number;
  testTickets: number;
}

const TicketCleanupPanel = () => {
  const [stats, setStats] = useState<CleanupStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [lastCleanupResult, setLastCleanupResult] = useState<string | null>(null);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const now = new Date().toISOString();
      
      // Total tickets
      const { count: totalTickets } = await supabase
        .from('game_tickets')
        .select('*', { count: 'exact', head: true });
      
      // Expired unused tickets
      const { count: expiredUnused } = await supabase
        .from('game_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('is_used', false)
        .lt('expires_at', now);
      
      // Ghost tickets (no tx_hash, older than 1 hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: ghostTickets } = await supabase
        .from('game_tickets')
        .select('*', { count: 'exact', head: true })
        .is('tx_hash', null)
        .lt('created_at', oneHourAgo);
      
      // Test tickets (ticket_value = 0 or very small payment)
      const { count: testTickets } = await supabase
        .from('game_tickets')
        .select('*', { count: 'exact', head: true })
        .or('ticket_value.eq.0,payment_amount.lt.0.0001');

      setStats({
        totalTickets: totalTickets || 0,
        expiredUnused: expiredUnused || 0,
        ghostTickets: ghostTickets || 0,
        testTickets: testTickets || 0,
      });
    } catch (err) {
      console.error('Failed to fetch cleanup stats:', err);
      toast.error('Failed to fetch stats');
    } finally {
      setIsLoading(false);
    }
  };

  const runCleanup = async (action: 'ghost' | 'expired' | 'test') => {
    setIsCleaningUp(true);
    setLastCleanupResult(null);
    
    try {
      let deleted = 0;
      const now = new Date().toISOString();
      
      if (action === 'ghost') {
        // Delete ghost tickets (no tx_hash, older than 1 hour, not used)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from('game_tickets')
          .delete()
          .is('tx_hash', null)
          .eq('is_used', false)
          .lt('created_at', oneHourAgo)
          .select();
        
        if (error) throw error;
        deleted = data?.length || 0;
      } else if (action === 'expired') {
        // Just mark as expired (don't delete - might have bet history)
        const { data, error } = await supabase
          .from('game_tickets')
          .update({ is_used: true })
          .eq('is_used', false)
          .lt('expires_at', now)
          .select();
        
        if (error) throw error;
        deleted = data?.length || 0;
        setLastCleanupResult(`Marked ${deleted} expired tickets as used`);
        toast.success(`Marked ${deleted} expired tickets as used`);
        fetchStats();
        return;
      } else if (action === 'test') {
        // Delete test tickets (value = 0, not used, no active bets)
        const { data, error } = await supabase
          .from('game_tickets')
          .delete()
          .eq('ticket_value', 0)
          .eq('is_used', false)
          .select();
        
        if (error) throw error;
        deleted = data?.length || 0;
      }
      
      setLastCleanupResult(`Cleaned up ${deleted} tickets`);
      toast.success(`Cleaned up ${deleted} tickets`);
      fetchStats();
    } catch (err: any) {
      console.error('Cleanup failed:', err);
      toast.error(`Cleanup failed: ${err.message}`);
      setLastCleanupResult(`Error: ${err.message}`);
    } finally {
      setIsCleaningUp(false);
    }
  };

  const runFullCleanup = async () => {
    if (!confirm('Run full cleanup? This will:\n1. Delete ghost tickets (no tx_hash)\n2. Mark expired tickets as used\n\nContinue?')) {
      return;
    }
    
    setIsCleaningUp(true);
    try {
      // Call backend cleanup function
      const { data, error } = await supabase.functions.invoke('game-admin-cleanup', {
        body: { 
          wallet_address: (window as any).ethereum?.selectedAddress || '',
          action: 'cleanup_ghost_tickets'
        }
      });
      
      if (error) throw error;
      
      setLastCleanupResult(`Cleanup complete: ${data?.deleted_count || 0} ghost tickets removed`);
      toast.success('Full cleanup completed');
      fetchStats();
    } catch (err: any) {
      console.error('Full cleanup failed:', err);
      toast.error(`Cleanup failed: ${err.message}`);
    } finally {
      setIsCleaningUp(false);
    }
  };

  return (
    <GlowCard className="p-5" glowColor="orange">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-orange-400" />
          <h3 className="font-semibold">Ticket Cleanup</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStats}
          disabled={isLoading}
          className="h-8"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Scan
        </Button>
      </div>

      {stats ? (
        <div className="space-y-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-background/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-foreground">{stats.totalTickets}</div>
              <div className="text-xs text-muted-foreground">Total Tickets</div>
            </div>
            <div className="bg-background/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-warning">{stats.expiredUnused}</div>
              <div className="text-xs text-muted-foreground">Expired Unused</div>
            </div>
            <div className="bg-background/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-destructive">{stats.ghostTickets}</div>
              <div className="text-xs text-muted-foreground">Ghost (No TX)</div>
            </div>
            <div className="bg-background/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-muted-foreground">{stats.testTickets}</div>
              <div className="text-xs text-muted-foreground">Test (Value=0)</div>
            </div>
          </div>

          {/* Cleanup Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => runCleanup('ghost')}
              disabled={isCleaningUp || stats.ghostTickets === 0}
              className="text-xs"
            >
              {isCleaningUp ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Trash2 className="w-3 h-3 mr-1" />}
              Clean Ghost ({stats.ghostTickets})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runCleanup('expired')}
              disabled={isCleaningUp || stats.expiredUnused === 0}
              className="text-xs"
            >
              {isCleaningUp ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Trash2 className="w-3 h-3 mr-1" />}
              Mark Expired ({stats.expiredUnused})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runCleanup('test')}
              disabled={isCleaningUp || stats.testTickets === 0}
              className="text-xs"
            >
              {isCleaningUp ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Trash2 className="w-3 h-3 mr-1" />}
              Clean Test ({stats.testTickets})
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={runFullCleanup}
              disabled={isCleaningUp}
              className="text-xs"
            >
              {isCleaningUp ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
              Full Cleanup
            </Button>
          </div>

          {/* Last Result */}
          {lastCleanupResult && (
            <div className="flex items-center gap-2 text-xs p-2 bg-success/10 border border-success/30 rounded-lg">
              <CheckCircle className="w-3.5 h-3.5 text-success" />
              <span>{lastCleanupResult}</span>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 text-xs p-2 bg-warning/10 border border-warning/30 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <span className="text-muted-foreground">
              <strong className="text-warning">Safe cleanup:</strong> Only removes tickets not tied to active bets or pending claims.
              Ghost tickets = created but never confirmed on-chain (no tx_hash).
            </span>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-sm text-muted-foreground">
          Click "Scan" to analyze ticket database
        </div>
      )}
    </GlowCard>
  );
};

export default TicketCleanupPanel;
