import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { 
  FileText, RefreshCw, Loader2, Clock, User, 
  Database, ArrowRight, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

interface AuditLogEntry {
  id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  old_value: any;
  new_value: any;
  wallet_address: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const AuditLogSection = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: dbError } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (dbError) {
        throw dbError;
      }

      setLogs(data || []);
    } catch (err: any) {
      console.error('Failed to fetch audit logs:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const getActionColor = (action: string) => {
    if (action.includes('insert')) return 'text-success';
    if (action.includes('update')) return 'text-warning';
    if (action.includes('delete')) return 'text-destructive';
    return 'text-primary';
  };

  const getActionIcon = (action: string) => {
    if (action.includes('insert')) return '➕';
    if (action.includes('update')) return '✏️';
    if (action.includes('delete')) return '🗑️';
    return '📋';
  };

  if (isLoading) {
    return (
      <GlowCard className="p-4" glowColor="purple">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading audit logs...</span>
        </div>
      </GlowCard>
    );
  }

  return (
    <GlowCard className="p-4" glowColor="purple">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" />
          <h3 className="font-semibold">Audit Log</h3>
          <span className="text-xs text-muted-foreground">({logs.length} entries)</span>
        </div>
        <NeonButton 
          variant="secondary" 
          className="text-xs px-3 py-1.5"
          onClick={fetchLogs}
          disabled={isLoading}
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </NeonButton>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 border border-destructive/30 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <p className="text-xs text-destructive">Failed to load logs: {error}</p>
        </div>
      )}

      {logs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No audit entries yet</p>
          <p className="text-xs">Actions will be logged here</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {logs.map((log) => (
            <div
              key={log.id}
              className="p-3 bg-background/30 rounded-lg border border-border/20 hover:border-border/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">{getActionIcon(log.action)}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${getActionColor(log.action)}`}>
                        {log.action.replace('config_', '').toUpperCase()}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        {log.table_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      <code className="font-mono">{truncateAddress(log.wallet_address)}</code>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                  <Clock className="w-3 h-3" />
                  {formatDate(log.created_at)}
                </div>
              </div>

              {/* Value Changes */}
              {(log.old_value || log.new_value) && (
                <div className="mt-2 pt-2 border-t border-border/20">
                  <div className="flex items-center gap-2 text-xs">
                    {log.old_value && (
                      <div className="flex-1 min-w-0">
                        <span className="text-muted-foreground">Old: </span>
                        <code className="text-destructive/80 truncate block">
                          {typeof log.old_value === 'object' 
                            ? JSON.stringify(log.old_value).slice(0, 50) + '...'
                            : String(log.old_value).slice(0, 50)
                          }
                        </code>
                      </div>
                    )}
                    {log.old_value && log.new_value && (
                      <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    )}
                    {log.new_value && (
                      <div className="flex-1 min-w-0">
                        <span className="text-muted-foreground">New: </span>
                        <code className="text-success/80 truncate block">
                          {typeof log.new_value === 'object' 
                            ? JSON.stringify(log.new_value).slice(0, 50) + '...'
                            : String(log.new_value).slice(0, 50)
                          }
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* IP & User Agent (collapsed by default) */}
              {log.ip_address && (
                <div className="mt-1 text-xs text-muted-foreground/60">
                  IP: {log.ip_address}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-border/30 text-xs text-muted-foreground text-center">
        All admin actions are permanently logged for security
      </div>
    </GlowCard>
  );
};

export default AuditLogSection;
