import { useState, useEffect, useCallback } from 'react';
import { Activity, Wifi, WifiOff, RefreshCw, Copy, Server, Clock, Wallet, Radio, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getRpcStatus, getProviderSync } from '@/lib/rpcProvider';
import { toast } from 'sonner';

declare const __BUILD_TIME__: string;

interface DiagnosticsData {
  buildTime: string;
  serviceWorker: {
    registered: boolean;
    controller: boolean;
    state: string;
  };
  rpcStatus: {
    endpoint: string | null;
    isConnected: boolean;
    blockNumber: number | null;
    error: string | null;
  };
  realtimeStatus: {
    connected: boolean;
    lastEventAt: string | null;
  };
  wallet: {
    hasProvider: boolean;
    providerName: string | null;
    chainId: number | null;
    isConnected: boolean;
  };
}

interface DiagnosticsPanelProps {
  className?: string;
  compact?: boolean;
}

const DiagnosticsPanel = ({ className = '', compact = false }: DiagnosticsPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDiagnostics = useCallback(async () => {
    setIsLoading(true);
    try {
      // Build time
      const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'unknown';

      // Service Worker status
      let swStatus = { registered: false, controller: false, state: 'none' };
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        swStatus.registered = registrations.length > 0;
        swStatus.controller = !!navigator.serviceWorker.controller;
        if (registrations.length > 0) {
          const sw = registrations[0].active || registrations[0].waiting || registrations[0].installing;
          swStatus.state = sw?.state || 'unknown';
        }
      }

      // RPC status
      let rpcStatus = { endpoint: null as string | null, isConnected: false, blockNumber: null as number | null, error: null as string | null };
      try {
        const status = getRpcStatus();
        rpcStatus.endpoint = status.endpoint;
        rpcStatus.isConnected = status.isConnected;
        
        // Try to get block number
        const provider = getProviderSync();
        const blockNum = await provider.getBlockNumber();
        rpcStatus.blockNumber = blockNum;
      } catch (err: any) {
        rpcStatus.error = err.message || 'RPC error';
      }

      // Realtime status (test with a quick channel)
      let realtimeStatus = { connected: false, lastEventAt: null as string | null };
      try {
        const channels = supabase.getChannels();
        realtimeStatus.connected = channels.length > 0;
        // Note: We can't easily get last event time without tracking it
      } catch {
        // Ignore
      }

      // Wallet status
      let walletStatus = { 
        hasProvider: false, 
        providerName: null as string | null, 
        chainId: null as number | null,
        isConnected: false 
      };
      if (typeof window !== 'undefined') {
        const eth = (window as any).ethereum;
        if (eth) {
          walletStatus.hasProvider = true;
          walletStatus.providerName = eth.isMetaMask ? 'MetaMask' : 
                                       eth.isCoinbaseWallet ? 'Coinbase' :
                                       eth.isWalletConnect ? 'WalletConnect' : 'Unknown';
          try {
            const accounts = await eth.request({ method: 'eth_accounts' });
            walletStatus.isConnected = accounts && accounts.length > 0;
            if (walletStatus.isConnected) {
              const chainId = await eth.request({ method: 'eth_chainId' });
              walletStatus.chainId = parseInt(chainId, 16);
            }
          } catch {
            // Ignore
          }
        }
      }

      setDiagnostics({
        buildTime,
        serviceWorker: swStatus,
        rpcStatus,
        realtimeStatus,
        wallet: walletStatus,
      });
    } catch (err) {
      console.error('Diagnostics fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isExpanded) {
      fetchDiagnostics();
    }
  }, [isExpanded, fetchDiagnostics]);

  const copyReport = () => {
    if (!diagnostics) return;
    const report = JSON.stringify(diagnostics, null, 2);
    navigator.clipboard.writeText(report);
    toast.success('Diagnostics copied to clipboard');
  };

  if (compact && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`flex items-center gap-1.5 px-2 py-1 text-xs bg-card/50 border border-border/30 rounded-md hover:bg-card/80 transition-colors ${className}`}
      >
        <Activity className="w-3 h-3 text-primary" />
        <span className="text-muted-foreground">Diagnostics</span>
      </button>
    );
  }

  return (
    <div className={`bg-card/90 backdrop-blur border border-border/50 rounded-lg overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-card/50">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">System Diagnostics</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchDiagnostics}
            disabled={isLoading}
            className="h-7 px-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyReport}
            disabled={!diagnostics}
            className="h-7 px-2"
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
          {compact && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="h-7 px-2 text-xs"
            >
              ✕
            </Button>
          )}
        </div>
      </div>

      {diagnostics ? (
        <div className="p-3 space-y-3 text-xs">
          {/* Build Time */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>Build Time</span>
            </div>
            <code className="font-mono text-foreground bg-background/50 px-2 py-0.5 rounded">
              {diagnostics.buildTime}
            </code>
          </div>

          {/* Service Worker */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Server className="w-3.5 h-3.5" />
              <span>Service Worker</span>
            </div>
            <div className="flex items-center gap-2">
              {diagnostics.serviceWorker.registered ? (
                <span className="text-success">Active ({diagnostics.serviceWorker.state})</span>
              ) : (
                <span className="text-muted-foreground">Not registered</span>
              )}
            </div>
          </div>

          {/* RPC Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Database className="w-3.5 h-3.5" />
              <span>RPC Provider</span>
            </div>
            <div className="flex items-center gap-2">
              {diagnostics.rpcStatus.isConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-success" />
                  <span className="text-success">Block #{diagnostics.rpcStatus.blockNumber}</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-destructive" />
                  <span className="text-destructive">{diagnostics.rpcStatus.error || 'Disconnected'}</span>
                </>
              )}
            </div>
          </div>

          {/* Realtime */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Radio className="w-3.5 h-3.5" />
              <span>Realtime</span>
            </div>
            <span className={diagnostics.realtimeStatus.connected ? 'text-success' : 'text-warning'}>
              {diagnostics.realtimeStatus.connected ? 'Connected' : 'No channels'}
            </span>
          </div>

          {/* Wallet */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="w-3.5 h-3.5" />
              <span>Wallet</span>
            </div>
            <div className="flex items-center gap-2">
              {diagnostics.wallet.hasProvider ? (
                <>
                  <span className={diagnostics.wallet.isConnected ? 'text-success' : 'text-warning'}>
                    {diagnostics.wallet.providerName}
                  </span>
                  {diagnostics.wallet.chainId && (
                    <span className="text-muted-foreground">
                      (Chain {diagnostics.wallet.chainId})
                    </span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">No provider</span>
              )}
            </div>
          </div>

          {/* RPC Endpoint */}
          {diagnostics.rpcStatus.endpoint && (
            <div className="pt-2 border-t border-border/30">
              <div className="text-muted-foreground mb-1">RPC Endpoint:</div>
              <code className="font-mono text-[10px] text-foreground/70 break-all">
                {diagnostics.rpcStatus.endpoint}
              </code>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 text-center text-xs text-muted-foreground">
          {isLoading ? 'Loading...' : 'Click refresh to load diagnostics'}
        </div>
      )}
    </div>
  );
};

export default DiagnosticsPanel;
