import { useState, useEffect, useCallback } from 'react';
import GlowCard from '@/components/ui/GlowCard';
import { 
  Ticket, Clock, CheckCircle, XCircle, 
  TrendingUp, RefreshCw, Loader2
} from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TicketData {
  id: string;
  wallet_address: string;
  payment_currency: string;
  payment_amount: number;
  ticket_value: number;
  created_at: string;
  is_used: boolean;
  expires_at: string;
}

interface TicketStats {
  totalWover: number;
  count: number;
  activeCount: number;
  usedCount: number;
  expiredCount: number;
  activeValue: number;
}

const TicketStatsPanel = () => {
  const { address } = useWallet();
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [stats, setStats] = useState<TicketStats>({
    totalWover: 0,
    count: 0,
    activeCount: 0,
    usedCount: 0,
    expiredCount: 0,
    activeValue: 0
  });
  const [isLoading, setIsLoading] = useState(false);

  const fetchTickets = useCallback(async () => {
    if (!address) return;
    
    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('game-get-tickets', {
        body: { 
          admin_mode: true, 
          admin_wallet: address,
          limit: 100 
        },
      });

      if (response.error) throw response.error;
      
      if (response.data?.tickets) {
        setTickets(response.data.tickets);
      }
      
      if (response.data?.stats) {
        setStats({
          totalWover: response.data.stats.totalWover || 0,
          count: response.data.stats.count || 0,
          activeCount: response.data.stats.activeCount || 0,
          usedCount: response.data.stats.usedCount || 0,
          expiredCount: response.data.stats.expiredCount || 0,
          activeValue: response.data.stats.activeValue || 0
        });
      }
    } catch (err) {
      console.error('[TicketStatsPanel] Failed to fetch tickets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 15000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  const getTicketStatus = (ticket: TicketData): { label: string; color: string; icon: any } => {
    const now = new Date();
    const expiresAt = new Date(ticket.expires_at);
    
    if (ticket.is_used) {
      return { label: 'Used', color: 'text-muted-foreground bg-muted/30', icon: CheckCircle };
    }
    if (expiresAt < now) {
      return { label: 'Expired', color: 'text-destructive bg-destructive/10', icon: XCircle };
    }
    return { label: 'Active', color: 'text-success bg-success/10', icon: Ticket };
  };

  const getTimeRemaining = (expiresAt: string): string => {
    const now = new Date();
    const expires = new Date(expiresAt);
    if (expires < now) return 'Expired';
    return formatDistanceToNow(expires, { addSuffix: false });
  };

  return (
    <GlowCard className="p-6" glowColor="cyan">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/20">
            <Ticket className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Ticket Overview</h3>
            <p className="text-xs text-muted-foreground">Real-time ticket status</p>
          </div>
        </div>
        <button 
          onClick={fetchTickets}
          disabled={isLoading}
          className="p-2 rounded-lg bg-card/50 hover:bg-card border border-border/30 transition-colors"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="p-4 rounded-xl bg-success/10 border border-success/20">
          <div className="flex items-center gap-2 mb-2">
            <Ticket className="w-4 h-4 text-success" />
            <span className="text-xs text-success font-medium">Active</span>
          </div>
          <p className="text-2xl font-bold text-success">{stats.activeCount}</p>
          <p className="text-xs text-muted-foreground mt-1">{stats.activeValue} WOVER value</p>
        </div>
        
        <div className="p-4 rounded-xl bg-muted/30 border border-border/20">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Used</span>
          </div>
          <p className="text-2xl font-bold">{stats.usedCount}</p>
          <p className="text-xs text-muted-foreground mt-1">tickets consumed</p>
        </div>
        
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-destructive" />
            <span className="text-xs text-destructive font-medium">Expired</span>
          </div>
          <p className="text-2xl font-bold text-destructive">{stats.expiredCount}</p>
          <p className="text-xs text-muted-foreground mt-1">tickets expired</p>
        </div>
        
        <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-xs text-primary font-medium">Total Sales</span>
          </div>
          <p className="text-2xl font-bold text-primary">{stats.count}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.totalWover.toLocaleString()} WOVER
          </p>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="border border-border/30 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-card/50 border-b border-border/30">
          <span className="text-sm font-medium">Recent Purchases</span>
        </div>
        
        <ScrollArea className="h-[300px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background/95 backdrop-blur-sm">
              <tr className="border-b border-border/30 text-left text-muted-foreground text-xs">
                <th className="px-4 py-3">Wallet</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading tickets...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No tickets purchased yet
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => {
                  const status = getTicketStatus(ticket);
                  const StatusIcon = status.icon;
                  const timeRemaining = getTimeRemaining(ticket.expires_at);
                  const isExpiringSoon = !ticket.is_used && 
                    new Date(ticket.expires_at) > new Date() && 
                    new Date(ticket.expires_at).getTime() - Date.now() < 24 * 60 * 60 * 1000;
                  
                  return (
                    <tr key={ticket.id} className="border-b border-border/10 hover:bg-card/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">
                        {ticket.wallet_address.slice(0, 6)}...{ticket.wallet_address.slice(-4)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold">{ticket.ticket_value}</span>
                        <span className="text-muted-foreground text-xs ml-1">WOVER</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium",
                          ticket.payment_currency === 'WOVER' 
                            ? "bg-warning/20 text-warning" 
                            : "bg-success/20 text-success"
                        )}>
                          {ticket.payment_amount.toLocaleString()} {ticket.payment_currency}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                          status.color
                        )}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "text-xs",
                          ticket.is_used ? "text-muted-foreground" :
                          timeRemaining === 'Expired' ? "text-destructive" :
                          isExpiringSoon ? "text-warning" : "text-foreground"
                        )}>
                          {timeRemaining}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {format(new Date(ticket.created_at), 'MMM d, HH:mm')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </ScrollArea>
      </div>
    </GlowCard>
  );
};

export default TicketStatsPanel;
