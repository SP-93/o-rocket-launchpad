/**
 * Game Debug Panel - Shows when ?debug=1 is in URL
 * Displays server time, round status, logs, and pending purchases
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, ChevronDown, ChevronUp, Trash2, RefreshCw } from 'lucide-react';
import { getGameLogs, clearGameLogs, getPendingPurchases, clearPendingPurchases } from '@/lib/gameLogger';
import type { GameRound, GameBet } from '@/hooks/useGameRound';
import { cn } from '@/lib/utils';

interface GameDebugPanelProps {
  currentRound: GameRound | null;
  myBet: GameBet | null;
  currentMultiplier: number;
  serverTime?: string;
}

const GameDebugPanel = ({ currentRound, myBet, currentMultiplier, serverTime }: GameDebugPanelProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [logs, setLogs] = useState(getGameLogs());
  const [pendingPurchases, setPendingPurchases] = useState(getPendingPurchases());

  // Check if debug mode is enabled
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setIsVisible(urlParams.get('debug') === '1');
  }, []);

  // Refresh logs periodically
  useEffect(() => {
    if (!isVisible) return;
    
    const interval = setInterval(() => {
      setLogs(getGameLogs());
      setPendingPurchases(getPendingPurchases());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  const handleClearLogs = () => {
    clearGameLogs();
    setLogs([]);
  };

  const handleClearPending = () => {
    clearPendingPurchases();
    setPendingPurchases([]);
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString();
  };

  const getStatusColor = (status: string | null | undefined) => {
    switch (status) {
      case 'betting': return 'text-primary';
      case 'countdown': return 'text-warning';
      case 'flying': return 'text-success';
      case 'crashed': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] max-w-sm w-full">
      <div className="bg-card/95 backdrop-blur border border-border rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div 
          className="flex items-center justify-between px-3 py-2 bg-muted/50 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-mono font-bold">DEBUG</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-xs font-bold", getStatusColor(currentRound?.status))}>
              {currentRound?.status?.toUpperCase() || 'NO ROUND'}
            </span>
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </div>
        </div>

        {isExpanded && (
          <div className="p-3 space-y-3 text-xs font-mono">
            {/* Round Status */}
            <div className="space-y-1">
              <div className="text-muted-foreground">ROUND</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">ID: </span>
                  <span>{currentRound?.id?.slice(0, 8) || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">#: </span>
                  <span>{currentRound?.round_number || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <span className={getStatusColor(currentRound?.status)}>
                    {currentRound?.status || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Mult: </span>
                  <span className="text-success font-bold">{currentMultiplier.toFixed(2)}x</span>
                </div>
              </div>
              {currentRound?.started_at && (
                <div>
                  <span className="text-muted-foreground">Started: </span>
                  <span>{formatTime(currentRound.started_at)}</span>
                </div>
              )}
            </div>

            {/* My Bet */}
            {myBet && (
              <div className="space-y-1 border-t border-border pt-2">
                <div className="text-muted-foreground">MY BET</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Amount: </span>
                    <span>{myBet.bet_amount} WOVER</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status: </span>
                    <span className={myBet.status === 'won' ? 'text-success' : myBet.status === 'lost' ? 'text-destructive' : ''}>
                      {myBet.status}
                    </span>
                  </div>
                  {myBet.auto_cashout_at && (
                    <div>
                      <span className="text-muted-foreground">Auto: </span>
                      <span>{myBet.auto_cashout_at}x</span>
                    </div>
                  )}
                  {myBet.cashed_out_at && (
                    <div>
                      <span className="text-muted-foreground">Cashed: </span>
                      <span className="text-success">{myBet.cashed_out_at}x</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pending Purchases */}
            {pendingPurchases.length > 0 && (
              <div className="space-y-1 border-t border-border pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-warning">PENDING PURCHASES ({pendingPurchases.length})</span>
                  <Button variant="ghost" size="sm" onClick={handleClearPending} className="h-5 px-1">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                {pendingPurchases.map((p, i) => (
                  <div key={i} className="text-[10px] bg-warning/10 rounded p-1">
                    <div>{p.txHash.slice(0, 16)}...</div>
                    <div>{p.ticketValue} WOVER via {p.paymentCurrency}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Logs */}
            <div className="space-y-1 border-t border-border pt-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">LOGS ({logs.length})</span>
                <Button variant="ghost" size="sm" onClick={handleClearLogs} className="h-5 px-1">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <ScrollArea className="h-32">
                <div className="space-y-1">
                  {logs.slice(0, 20).map((log, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "text-[10px] p-1 rounded",
                        log.error ? 'bg-destructive/20 text-destructive' : 'bg-muted/30'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{log.action}</span>
                        <span className="text-muted-foreground">{log.correlationId.slice(-6)}</span>
                      </div>
                      {log.error && <div className="text-destructive">{log.error}</div>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Server Time */}
            <div className="text-center text-muted-foreground border-t border-border pt-2">
              Client: {new Date().toLocaleTimeString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameDebugPanel;
