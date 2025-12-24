import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Loader2, Zap, ChevronUp, Ticket } from 'lucide-react';
import { useGameTickets } from '@/hooks/useGameTickets';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MobileBetBarProps {
  walletAddress: string | null;
  isConnected: boolean;
  currentRound: any;
  myBet: any;
  currentMultiplier: number;
  onBetPlaced?: () => void;
}

const MobileBetBar = ({ 
  walletAddress, 
  isConnected, 
  currentRound, 
  myBet, 
  currentMultiplier,
  onBetPlaced 
}: MobileBetBarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [isCashingOut, setIsCashingOut] = useState(false);
  const { availableTickets } = useGameTickets(walletAddress);

  if (!isConnected) return null;

  const canBet = currentRound?.status === 'betting' && !myBet;
  const canCashOut = myBet?.status === 'active' && currentRound?.status === 'flying' && !myBet?.cashed_out_at;
  const potentialWin = myBet ? Math.floor(myBet.bet_amount * currentMultiplier) : 0;

  const handleQuickBet = async () => {
    if (!selectedTicketId && availableTickets.length > 0) {
      setSelectedTicketId(availableTickets[0].id);
    }
    setIsOpen(true);
  };

  const handlePlaceBet = async () => {
    const ticket = availableTickets.find(t => t.id === selectedTicketId) || availableTickets[0];
    if (!ticket || !currentRound) {
      toast.error('No ticket selected');
      return;
    }
    
    setIsPlacingBet(true);
    try {
      const { error } = await supabase.functions.invoke('game-place-bet', {
        body: {
          wallet_address: walletAddress,
          ticket_id: ticket.id,
          round_id: currentRound.id,
          auto_cashout_at: null
        }
      });
      
      if (error) throw error;
      toast.success('Bet placed!');
      setIsOpen(false);
      onBetPlaced?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to place bet');
    } finally {
      setIsPlacingBet(false);
    }
  };

  const handleCashOut = async () => {
    if (!myBet) return;
    
    setIsCashingOut(true);
    try {
      const { error } = await supabase.functions.invoke('game-cashout', {
        body: {
          bet_id: myBet.id,
          cashout_multiplier: currentMultiplier,
          wallet_address: walletAddress
        }
      });
      
      if (error) throw error;
      toast.success(`Cashed out at ${currentMultiplier.toFixed(2)}x!`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to cash out');
    } finally {
      setIsCashingOut(false);
    }
  };

  // Show cashout button during flying
  if (canCashOut) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-gradient-to-t from-background via-background/95 to-transparent lg:hidden">
        <Button
          onClick={handleCashOut}
          disabled={isCashingOut}
          size="lg"
          className={cn(
            "w-full h-14 text-lg font-bold",
            "bg-gradient-to-r from-warning via-warning/90 to-warning",
            "text-warning-foreground shadow-lg shadow-warning/30",
            "animate-pulse hover:animate-none"
          )}
        >
          {isCashingOut ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Cashing Out...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 mr-2" />
              CASH OUT • {potentialWin} WOVER • {currentMultiplier.toFixed(2)}x
            </>
          )}
        </Button>
      </div>
    );
  }

  // Show bet placed status
  if (myBet?.status === 'active' && currentRound?.status !== 'flying') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-gradient-to-t from-background via-background/95 to-transparent lg:hidden">
        <div className="bg-card border border-primary/30 rounded-xl p-4 text-center">
          <div className="text-sm text-muted-foreground">Bet Placed</div>
          <div className="font-bold text-primary text-lg">{myBet.bet_amount} WOVER</div>
          {myBet.auto_cashout_at && (
            <div className="text-xs text-muted-foreground">Auto-cashout: {myBet.auto_cashout_at}x</div>
          )}
        </div>
      </div>
    );
  }

  // Show place bet UI
  if (canBet) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-gradient-to-t from-background via-background/95 to-transparent lg:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              onClick={handleQuickBet}
              size="lg"
              className="w-full h-14 text-lg font-bold btn-primary"
              disabled={availableTickets.length === 0}
            >
              {availableTickets.length === 0 ? (
                <>
                  <Ticket className="w-5 h-5 mr-2" />
                  No Tickets - Buy First
                </>
              ) : (
                <>
                  <ChevronUp className="w-5 h-5 mr-2" />
                  Place Bet ({availableTickets.length} tickets)
                </>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <div className="space-y-4 py-4">
              <h3 className="text-lg font-bold text-center">Select Ticket</h3>
              
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {availableTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={cn(
                      "p-3 rounded-lg border-2 transition-all text-left",
                      selectedTicketId === ticket.id 
                        ? "border-primary bg-primary/10" 
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="font-bold">{ticket.ticket_value} WOVER</div>
                    <div className="text-xs text-muted-foreground">
                      Paid: {ticket.payment_amount} {ticket.payment_currency}
                    </div>
                  </button>
                ))}
              </div>

              <Button
                onClick={handlePlaceBet}
                disabled={isPlacingBet || !selectedTicketId}
                size="lg"
                className="w-full h-12 font-bold btn-primary"
              >
                {isPlacingBet ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Placing Bet...
                  </>
                ) : (
                  'Place Bet'
                )}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // Waiting state
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-gradient-to-t from-background via-background/95 to-transparent lg:hidden">
      <div className="bg-card/80 backdrop-blur border border-border/50 rounded-xl p-3 text-center">
        <div className="text-muted-foreground text-sm">
          {currentRound?.status === 'countdown' && 'Get ready...'}
          {currentRound?.status === 'flying' && 'Round in progress'}
          {currentRound?.status === 'crashed' && 'Crashed! Next round soon...'}
          {!currentRound && 'Waiting for next round...'}
        </div>
      </div>
    </div>
  );
};

export default MobileBetBar;
