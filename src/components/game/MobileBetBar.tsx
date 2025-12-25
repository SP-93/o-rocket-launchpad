import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Loader2, Zap, ChevronUp, Ticket, ShoppingCart, ArrowDownToLine } from 'lucide-react';
import { useGameTickets } from '@/hooks/useGameTickets';
import { usePendingWinnings } from '@/hooks/usePendingWinnings';
import { useClaimWinnings } from '@/hooks/useClaimWinnings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import TicketPurchase from './TicketPurchase';
import { useWalletClient } from 'wagmi';
import { ethers } from 'ethers';

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
  const [isTicketSheetOpen, setIsTicketSheetOpen] = useState(false);
  const [isWithdrawSheetOpen, setIsWithdrawSheetOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [isCashingOut, setIsCashingOut] = useState(false);
  const [claimingBetId, setClaimingBetId] = useState<string | null>(null);
  
  const { availableTickets } = useGameTickets(walletAddress);
  const { pendingWinnings, totalPending, refetch: refetchPending } = usePendingWinnings(walletAddress || undefined);
  const { claimWinnings } = useClaimWinnings(walletAddress || undefined);
  const { data: walletClient } = useWalletClient();

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
      const response = await supabase.functions.invoke('game-place-bet', {
        body: {
          wallet_address: walletAddress,
          ticket_id: ticket.id,
          round_id: currentRound.id,
          auto_cashout_at: null
        }
      });
      
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      
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
      const response = await supabase.functions.invoke('game-cashout', {
        body: {
          wallet_address: walletAddress,
          bet_id: myBet.id,
          current_multiplier: currentMultiplier
        }
      });
      
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      
      const actualWin = response.data?.cashout?.winnings;
      toast.success(`Cashed out at ${currentMultiplier.toFixed(2)}x! Won ${actualWin?.toFixed(2) || ''} WOVER`);
      refetchPending();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cash out');
    } finally {
      setIsCashingOut(false);
    }
  };

  const handleClaimWinnings = async (bet: { id: string; round_id: string; winnings: number }) => {
    if (!walletClient || !walletAddress) {
      toast.error('Wallet not connected');
      return;
    }

    setClaimingBetId(bet.id);
    try {
      // Convert viem wallet client to ethers signer
      const provider = new ethers.providers.Web3Provider(walletClient as any);
      const signer = provider.getSigner();
      
      await claimWinnings(signer, bet.round_id, bet.winnings);
      toast.success(`Claimed ${bet.winnings.toFixed(2)} WOVER!`);
      refetchPending();
      
      if (pendingWinnings.length <= 1) {
        setIsWithdrawSheetOpen(false);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to claim winnings');
    } finally {
      setClaimingBetId(null);
    }
  };

  // Withdrawal button component - shown when there are pending winnings
  const WithdrawButton = ({ fullWidth = false }: { fullWidth?: boolean }) => {
    if (totalPending <= 0) return null;
    
    return (
      <Sheet open={isWithdrawSheetOpen} onOpenChange={setIsWithdrawSheetOpen}>
        <SheetTrigger asChild>
          <Button
            size="lg"
            className={cn(
              "h-12 font-bold gap-2",
              "bg-gradient-to-r from-success via-success/90 to-success",
              "text-success-foreground shadow-lg shadow-success/30",
              "animate-pulse hover:animate-none",
              fullWidth ? "w-full" : ""
            )}
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>Withdraw {totalPending.toFixed(2)} WOVER</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh]">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-center">Withdraw Winnings</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 overflow-y-auto max-h-[50vh]">
            {pendingWinnings.map((win) => (
              <div
                key={win.id}
                className="flex items-center justify-between p-4 rounded-xl bg-card border border-success/30"
              >
                <div>
                  <div className="font-bold text-success">{win.winnings.toFixed(2)} WOVER</div>
                  <div className="text-xs text-muted-foreground">
                    Bet: {win.bet_amount} • Multiplier: {win.cashed_out_at?.toFixed(2)}x
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleClaimWinnings(win)}
                  disabled={claimingBetId === win.id}
                  className="bg-success hover:bg-success/90 text-success-foreground"
                >
                  {claimingBetId === win.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Claim'
                  )}
                </Button>
              </div>
            ))}
            
            {pendingWinnings.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No pending winnings to claim
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  };

  // Show cashout button during flying - but also show withdraw if available
  if (canCashOut) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-gradient-to-t from-background via-background/95 to-transparent lg:hidden space-y-2">
        {/* Withdraw button always at top when there are pending winnings */}
        {totalPending > 0 && <WithdrawButton fullWidth />}
        
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
        <div className="flex gap-2">
          {/* Withdraw button - always visible when there are pending winnings */}
          <WithdrawButton />
          
          <div className="flex-1 bg-card border border-primary/30 rounded-xl p-3 text-center">
            <div className="text-xs text-muted-foreground">Bet Placed</div>
            <div className="font-bold text-primary">{myBet.bet_amount} WOVER</div>
            {myBet.auto_cashout_at && (
              <div className="text-xs text-muted-foreground">Auto: {myBet.auto_cashout_at}x</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show place bet UI with ticket purchase option
  if (canBet) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-gradient-to-t from-background via-background/95 to-transparent lg:hidden">
        {/* Withdraw button - always shown at top when there are pending winnings */}
        {totalPending > 0 && (
          <div className="mb-2">
            <WithdrawButton />
          </div>
        )}
        
        {/* No tickets - Show buy tickets button */}
        {availableTickets.length === 0 ? (
          <Sheet open={isTicketSheetOpen} onOpenChange={setIsTicketSheetOpen}>
            <SheetTrigger asChild>
              <Button
                size="lg"
                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-primary to-primary/80"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Buy Tickets to Play
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl h-[85vh] overflow-y-auto">
              <div className="py-4">
                <TicketPurchase walletAddress={walletAddress || undefined} isConnected={isConnected} />
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          /* Has tickets - Show bet controls */
          <div className="flex gap-2">
            {/* Buy More Tickets Button */}
            <Sheet open={isTicketSheetOpen} onOpenChange={setIsTicketSheetOpen}>
              <SheetTrigger asChild>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-4 border-primary/30 hover:bg-primary/10"
                >
                  <ShoppingCart className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl h-[85vh] overflow-y-auto">
                <div className="py-4">
                  <TicketPurchase walletAddress={walletAddress || undefined} isConnected={isConnected} />
                </div>
              </SheetContent>
            </Sheet>

            {/* Place Bet Button */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button
                  onClick={handleQuickBet}
                  size="lg"
                  className="flex-1 h-14 text-lg font-bold btn-primary"
                >
                  <ChevronUp className="w-5 h-5 mr-2" />
                  Place Bet ({availableTickets.length} tickets)
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
        )}
      </div>
    );
  }

  // Waiting state with ticket info
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-gradient-to-t from-background via-background/95 to-transparent lg:hidden">
      <div className="flex gap-2">
        {/* Withdraw button - always visible when there are pending winnings */}
        <WithdrawButton />
        
        {/* Buy Tickets Button */}
        <Sheet open={isTicketSheetOpen} onOpenChange={setIsTicketSheetOpen}>
          <SheetTrigger asChild>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-4 border-primary/30 hover:bg-primary/10"
            >
              <ShoppingCart className="w-4 h-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl h-[85vh] overflow-y-auto">
            <div className="py-4">
              <TicketPurchase walletAddress={walletAddress || undefined} isConnected={isConnected} />
            </div>
          </SheetContent>
        </Sheet>

        {/* Status Card */}
        <div className="flex-1 bg-card/80 backdrop-blur border border-border/50 rounded-xl p-3 flex items-center justify-between">
          <div className="text-muted-foreground text-sm">
            {currentRound?.status === 'countdown' && '⏳ Get ready...'}
            {currentRound?.status === 'flying' && '🚀 Round in progress'}
            {currentRound?.status === 'crashed' && '💥 Crashed! Next round soon...'}
            {!currentRound && '⏳ Waiting for next round...'}
          </div>
          <div className="flex items-center gap-1 text-xs text-primary">
            <Ticket className="w-3 h-3" />
            <span>{availableTickets.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileBetBar;