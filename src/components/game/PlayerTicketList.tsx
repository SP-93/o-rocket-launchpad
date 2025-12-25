import { useMemo } from 'react';
import { Ticket, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import type { GameTicket } from '@/hooks/useGameTickets';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PlayerTicketListProps {
  tickets: GameTicket[];
}

const PlayerTicketList = ({ tickets }: PlayerTicketListProps) => {
  // Sort by expiration (soonest first) and group by value
  const sortedGroupedTickets = useMemo(() => {
    if (tickets.length === 0) return [];
    
    // Sort by expires_at ascending
    const sorted = [...tickets].sort((a, b) => 
      new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime()
    );
    
    // Group by value while preserving order
    const groups = new Map<number, GameTicket[]>();
    for (const ticket of sorted) {
      const existing = groups.get(ticket.ticket_value) || [];
      existing.push(ticket);
      groups.set(ticket.ticket_value, existing);
    }
    
    return Array.from(groups.entries()).map(([value, groupTickets]) => ({
      value,
      tickets: groupTickets,
      // Use earliest expiring ticket for display
      earliestExpiry: new Date(groupTickets[0].expires_at)
    }));
  }, [tickets]);

  const getTimeRemaining = (expiresAt: Date): { text: string; urgency: 'normal' | 'warning' | 'critical' } => {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    
    if (diff < 0) return { text: 'Expired', urgency: 'critical' };
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return { 
        text: `${days}d ${hours % 24}h`, 
        urgency: days <= 2 ? 'warning' : 'normal' 
      };
    }
    
    if (hours > 0) {
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return { 
        text: `${hours}h ${minutes}m`, 
        urgency: hours <= 6 ? 'critical' : 'warning' 
      };
    }
    
    const minutes = Math.floor(diff / (1000 * 60));
    return { text: `${minutes}m`, urgency: 'critical' };
  };

  if (sortedGroupedTickets.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-2">
        {sortedGroupedTickets.map((group) => {
          const timeInfo = getTimeRemaining(group.earliestExpiry);
          
          return (
            <Tooltip key={group.value}>
              <TooltipTrigger asChild>
                <div className="relative group cursor-pointer animate-fade-in">
                  <div className={cn(
                    "relative w-16 h-16 rounded-lg border shadow-lg transition-all duration-300",
                    "group-hover:scale-110 group-hover:-translate-y-1",
                    "bg-gradient-to-br from-primary/40 via-primary/25 to-primary/10",
                    timeInfo.urgency === 'critical' 
                      ? "border-destructive/60 shadow-destructive/20" 
                      : timeInfo.urgency === 'warning'
                      ? "border-warning/60 shadow-warning/20"
                      : "border-primary/40"
                  )}>
                    {/* Perforated edge */}
                    <div className="absolute left-0.5 top-2 bottom-2 w-0.5 flex flex-col justify-around">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="w-1 h-1 rounded-full bg-background/80" />
                      ))}
                    </div>
                    
                    {/* Value x Count */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="flex items-center gap-0.5">
                        <span className="text-lg font-bold text-primary">{group.value}</span>
                        <span className="text-xs text-muted-foreground">×</span>
                        <span className="text-sm font-semibold text-primary/80">{group.tickets.length}</span>
                      </div>
                      <span className="text-[8px] text-muted-foreground uppercase tracking-wider">WOVER</span>
                    </div>
                    
                    {/* Expiry indicator */}
                    <div className={cn(
                      "absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[8px] font-medium",
                      "flex items-center gap-0.5 whitespace-nowrap",
                      timeInfo.urgency === 'critical' 
                        ? "bg-destructive text-destructive-foreground" 
                        : timeInfo.urgency === 'warning'
                        ? "bg-warning text-warning-foreground"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {timeInfo.urgency === 'critical' && (
                        <AlertTriangle className="w-2 h-2" />
                      )}
                      <Clock className="w-2 h-2" />
                      {timeInfo.text}
                    </div>
                    
                    {/* Shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  
                  {/* Glow on hover */}
                  <div className={cn(
                    "absolute inset-0 blur-lg rounded-lg opacity-0 group-hover:opacity-100 transition-opacity -z-10",
                    timeInfo.urgency === 'critical' ? "bg-destructive/30" :
                    timeInfo.urgency === 'warning' ? "bg-warning/30" : "bg-primary/30"
                  )} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <div className="space-y-1">
                  <div className="font-medium">{group.tickets.length} × {group.value} WOVER Tickets</div>
                  <div className="text-muted-foreground">
                    Earliest expires: {format(group.earliestExpiry, 'MMM d, yyyy HH:mm')}
                  </div>
                  {group.tickets.length > 1 && (
                    <div className="text-muted-foreground">
                      ({formatDistanceToNow(group.earliestExpiry, { addSuffix: true })})
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};

export default PlayerTicketList;
