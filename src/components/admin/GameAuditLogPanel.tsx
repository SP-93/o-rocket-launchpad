import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import GlowCard from '@/components/ui/GlowCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FileText, Search, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface AuditLogEntry {
  id: string;
  event_type: string;
  wallet_address: string | null;
  ticket_id: string | null;
  bet_id: string | null;
  round_id: string | null;
  correlation_id: string | null;
  event_data: any;
  created_at: string;
}

const EVENT_TYPES = [
  'ALL',
  'TICKET_PURCHASED',
  'TICKET_REGISTER_IDEMPOTENT',
  'BET_PLACED',
  'CASHOUT',
  'CLAIM_CONFIRMED',
  'CLAIM_SIGN_REQUEST',
  'CLAIM_SIGN_REFUSED',
  'CLAIM_TX_SAVED',
  'ROUND_STARTED',
  'ROUND_CRASHED',
];

const GameAuditLogPanel = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [walletFilter, setWalletFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('ALL');
  const [correlationFilter, setCorrelationFilter] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const PAGE_SIZE = 30;

  const fetchLogs = useCallback(async (reset = false) => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('game_audit_log')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (walletFilter) {
        query = query.ilike('wallet_address', `%${walletFilter.toLowerCase()}%`);
      }
      if (eventTypeFilter && eventTypeFilter !== 'ALL') {
        query = query.eq('event_type', eventTypeFilter);
      }
      if (correlationFilter) {
        query = query.ilike('correlation_id', `%${correlationFilter}%`);
      }

      const currentPage = reset ? 0 : page;
      query = query.range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      const { data, error } = await query;

      if (error) throw error;

      if (reset) {
        setLogs(data || []);
        setPage(0);
      } else {
        setLogs(prev => [...prev, ...(data || [])]);
      }
      setHasMore((data?.length || 0) === PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [walletFilter, eventTypeFilter, correlationFilter, page]);

  useEffect(() => {
    fetchLogs(true);
  }, [walletFilter, eventTypeFilter, correlationFilter]);

  const handleLoadMore = () => {
    setPage(p => p + 1);
    fetchLogs(false);
  };

  const toggleRowExpanded = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getEventBadgeColor = (eventType: string) => {
    if (eventType.includes('TICKET')) return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    if (eventType.includes('BET')) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (eventType.includes('CASHOUT')) return 'bg-success/20 text-success border-success/30';
    if (eventType.includes('CLAIM')) return 'bg-warning/20 text-warning border-warning/30';
    if (eventType.includes('ROUND')) return 'bg-primary/20 text-primary border-primary/30';
    return 'bg-muted/20 text-muted-foreground border-muted/30';
  };

  const truncateId = (id: string | null) => id ? `${id.slice(0, 8)}...` : '—';

  return (
    <GlowCard className="p-6" glowColor="purple">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" />
          Game Audit Log
        </h3>
        <Button variant="outline" size="sm" onClick={() => fetchLogs(true)}>
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filter by wallet..."
            value={walletFilter}
            onChange={(e) => setWalletFilter(e.target.value)}
            className="pl-9 bg-background/50"
          />
        </div>
        <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
          <SelectTrigger className="bg-background/50">
            <SelectValue placeholder="Event Type" />
          </SelectTrigger>
          <SelectContent>
            {EVENT_TYPES.map(type => (
              <SelectItem key={type} value={type}>
                {type === 'ALL' ? 'All Events' : type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Correlation ID..."
          value={correlationFilter}
          onChange={(e) => setCorrelationFilter(e.target.value)}
          className="bg-background/50"
        />
      </div>

      {/* Logs Table */}
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        {isLoading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No audit logs found</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border/30">
                <th className="text-left py-2 px-2 text-muted-foreground font-medium w-8"></th>
                <th className="text-left py-2 px-2 text-muted-foreground font-medium">Time</th>
                <th className="text-left py-2 px-2 text-muted-foreground font-medium">Event</th>
                <th className="text-left py-2 px-2 text-muted-foreground font-medium">Wallet</th>
                <th className="text-left py-2 px-2 text-muted-foreground font-medium">IDs</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const isExpanded = expandedRows.has(log.id);
                return (
                  <>
                    <tr
                      key={log.id}
                      className="border-b border-border/20 hover:bg-background/30 cursor-pointer"
                      onClick={() => toggleRowExpanded(log.id)}
                    >
                      <td className="py-2 px-2">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </td>
                      <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), 'MM/dd HH:mm:ss')}
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className={getEventBadgeColor(log.event_type)}>
                          {log.event_type}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 font-mono text-xs">
                        {log.wallet_address ? `${log.wallet_address.slice(0, 8)}...` : '—'}
                      </td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">
                        {log.bet_id && <span className="mr-2">bet:{truncateId(log.bet_id)}</span>}
                        {log.ticket_id && <span className="mr-2">tkt:{truncateId(log.ticket_id)}</span>}
                        {log.round_id && <span>rnd:{truncateId(log.round_id)}</span>}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${log.id}-expanded`} className="bg-background/20">
                        <td colSpan={5} className="p-3">
                          <div className="text-xs font-mono bg-background/50 p-3 rounded-lg overflow-x-auto">
                            <p className="text-muted-foreground mb-1">
                              Correlation: <span className="text-foreground">{log.correlation_id || '—'}</span>
                            </p>
                            <pre className="text-foreground whitespace-pre-wrap">
                              {JSON.stringify(log.event_data, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Load More */}
      {hasMore && logs.length > 0 && (
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
            Load More
          </Button>
        </div>
      )}
    </GlowCard>
  );
};

export default GameAuditLogPanel;
