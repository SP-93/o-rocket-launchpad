import { useState, useEffect } from 'react';
import { History, Ticket, Trophy, TrendingUp, TrendingDown, Clock, Check, X, ExternalLink, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useGameHistory, type HistoryBet, type HistoryTicket } from '@/hooks/useGameHistory';
import { format } from 'date-fns';

interface GameHistoryPanelProps {
  walletAddress: string | undefined;
  isOpen: boolean;
  onClose: () => void;
}

export function GameHistoryPanel({ walletAddress, isOpen, onClose }: GameHistoryPanelProps) {
  const { history, isLoading, error, fetchHistory } = useGameHistory(walletAddress);
  const [expandedBet, setExpandedBet] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && walletAddress) {
      fetchHistory();
    }
  }, [isOpen, walletAddress, fetchHistory]);

  if (!isOpen) return null;

  const stats = history?.stats;
  const winRate = stats && stats.total_bets > 0 
    ? ((stats.total_wins / stats.total_bets) * 100).toFixed(1)
    : '0';

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">My Game History</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => fetchHistory()}
              disabled={isLoading}
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="p-4 border-b border-border">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-card/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-primary">{stats.total_wins}</div>
                <div className="text-xs text-muted-foreground">Total Wins</div>
              </div>
              <div className="bg-card/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-success">{winRate}%</div>
                <div className="text-xs text-muted-foreground">Win Rate</div>
              </div>
              <div className="bg-card/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-warning">{stats.best_multiplier.toFixed(2)}x</div>
                <div className="text-xs text-muted-foreground">Best Multi</div>
              </div>
              <div className="bg-card/50 rounded-lg p-3 text-center">
                <div className={cn(
                  "text-2xl font-bold",
                  stats.total_winnings - stats.total_wagered >= 0 ? "text-success" : "text-destructive"
                )}>
                  {(stats.total_winnings - stats.total_wagered).toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground">Net Profit</div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="bets" className="h-full flex flex-col">
            <TabsList className="mx-4 mt-2 grid grid-cols-2">
              <TabsTrigger value="bets" className="gap-1">
                <Trophy className="w-3.5 h-3.5" />
                Bets ({history?.bets.length || 0})
              </TabsTrigger>
              <TabsTrigger value="tickets" className="gap-1">
                <Ticket className="w-3.5 h-3.5" />
                Tickets ({history?.tickets.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bets" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="h-[400px] p-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : history?.bets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No bets yet. Start playing!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history?.bets.map((bet) => (
                      <BetCard 
                        key={bet.id} 
                        bet={bet} 
                        isExpanded={expandedBet === bet.id}
                        onToggle={() => setExpandedBet(expandedBet === bet.id ? null : bet.id)}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="tickets" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="h-[400px] p-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : history?.tickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No tickets purchased yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history?.tickets.map((ticket) => (
                      <TicketCard key={ticket.id} ticket={ticket} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function BetCard({ bet, isExpanded, onToggle }: { bet: HistoryBet; isExpanded: boolean; onToggle: () => void }) {
  const isWin = bet.status === 'won';
  
  return (
    <div className={cn(
      "rounded-lg border transition-colors",
      isWin ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"
    )}>
      <div 
        className="p-3 flex items-center justify-between cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            isWin ? "bg-success/20" : "bg-destructive/20"
          )}>
            {isWin ? (
              <TrendingUp className="w-4 h-4 text-success" />
            ) : (
              <TrendingDown className="w-4 h-4 text-destructive" />
            )}
          </div>
          <div>
            <div className="font-medium">Round #{bet.round_number}</div>
            <div className="text-xs text-muted-foreground">
              {format(new Date(bet.created_at), 'MMM d, HH:mm')}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={cn(
              "font-bold",
              isWin ? "text-success" : "text-destructive"
            )}>
              {bet.profit >= 0 ? '+' : ''}{bet.profit.toFixed(2)} WOVER
            </div>
            <div className="text-xs text-muted-foreground">
              Bet: {bet.bet_amount} @ {bet.cashed_out_at ? `${bet.cashed_out_at.toFixed(2)}x` : 'BUST'}
            </div>
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>
      
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-border/50 pt-2 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Crash Point:</span>
            <span className="font-mono">{bet.crash_point?.toFixed(2)}x</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Auto Cashout:</span>
            <span className="font-mono">{bet.auto_cashout_at ? `${bet.auto_cashout_at}x` : 'Manual'}</span>
          </div>
          {isWin && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Claim Status:</span>
              <span className={cn(
                "flex items-center gap-1",
                bet.claimed_at ? "text-success" : "text-warning"
              )}>
                {bet.claimed_at ? (
                  <>
                    <Check className="w-3 h-3" />
                    Claimed
                  </>
                ) : (
                  <>
                    <Clock className="w-3 h-3" />
                    Pending
                  </>
                )}
              </span>
            </div>
          )}
          {bet.claim_tx_hash && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">TX Hash:</span>
              <a 
                href={`https://explorer.over.network/tx/${bet.claim_tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary flex items-center gap-1 hover:underline"
              >
                {bet.claim_tx_hash.slice(0, 8)}...
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticket }: { ticket: HistoryTicket }) {
  const statusColors = {
    active: 'bg-success/20 text-success border-success/30',
    used: 'bg-muted text-muted-foreground border-muted',
    expired: 'bg-destructive/20 text-destructive border-destructive/30'
  };

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Ticket className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="font-medium flex items-center gap-2">
            {ticket.ticket_value} WOVER
            {ticket.serial_number && (
              <span className="text-xs text-muted-foreground font-mono">
                #{ticket.serial_number}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {format(new Date(ticket.created_at), 'MMM d, yyyy HH:mm')}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="text-right text-xs">
          <div className="text-muted-foreground">
            Paid: {ticket.payment_amount} {ticket.payment_currency}
          </div>
          {ticket.tx_hash && (
            <a 
              href={`https://explorer.over.network/tx/${ticket.tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1 justify-end"
            >
              {ticket.tx_hash.slice(0, 6)}...
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
        <Badge variant="outline" className={cn("text-xs", statusColors[ticket.status])}>
          {ticket.status}
        </Badge>
      </div>
    </div>
  );
}

export default GameHistoryPanel;
