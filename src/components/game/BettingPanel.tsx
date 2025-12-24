import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, Zap, Hand, Target, Ticket, TrendingUp, Wallet, ExternalLink } from 'lucide-react';
import { useGameTickets, type GameTicket } from '@/hooks/useGameTickets';
import { useGameBetting } from '@/hooks/useGameBetting';
import { useClaimWinnings } from '@/hooks/useClaimWinnings';
import type { GameRound, GameBet } from '@/hooks/useGameRound';
import { toast } from '@/hooks/use-toast';
import useGameSounds from '@/hooks/useGameSounds';


interface BettingPanelProps {
  walletAddress: string | undefined;
  isConnected: boolean;
  currentRound: GameRound | null;
  myBet: GameBet | null;
  currentMultiplier: number;
  onBetPlaced?: () => void;
}

type AutoCashout = 'x2' | 'x5' | 'x10' | 'off';

const BettingPanel = ({
  walletAddress,
  isConnected,
  currentRound,
  myBet,
  currentMultiplier,
  onBetPlaced,
}: BettingPanelProps) => {
  const [selectedTicket, setSelectedTicket] = useState<GameTicket | null>(null);
  const [autoCashout, setAutoCashout] = useState<AutoCashout>('off');
  
  const { availableTickets } = useGameTickets(walletAddress);
  const { placeBet, cashOut, isPlacingBet, isCashingOut } = useGameBetting(walletAddress);
  const { isClaiming, claimWinnings, checkCanClaim, canClaim, pendingAmount } = useClaimWinnings(walletAddress);
  
  const soundEnabled = typeof window !== 'undefined' && localStorage.getItem('rocketGameSound') !== 'false';
  const { playSound } = useGameSounds(soundEnabled);

  const canBet = currentRound?.status === 'betting' && !myBet && isConnected;
  const canCashOutState = currentRound?.status === 'flying' && myBet?.status === 'active';
  
  // Check if player can claim winnings when they won
  useEffect(() => {
    const checkClaimStatus = async () => {
      if (myBet?.status === 'won' && currentRound?.id) {
        console.log(`[BettingPanel] Checking claim status for round ${currentRound.id}`);
        const result = await checkCanClaim(currentRound.id);
        console.log(`[BettingPanel] Claim check result:`, result);
      }
    };
    checkClaimStatus();
  }, [myBet?.status, currentRound?.id, checkCanClaim]);

  const handleClaimWinnings = async () => {
    if (!currentRound?.id || !window.ethereum) {
      console.log('[BettingPanel] Cannot claim: missing round or ethereum');
      return;
    }
    
    try {
      console.log(`[BettingPanel] Starting claim for round ${currentRound.id}`);
      const { ethers } = await import('ethers');
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const signer = provider.getSigner();
      
      const txHash = await claimWinnings(signer, currentRound.id);
      console.log(`[BettingPanel] Claim successful: ${txHash}`);
      playSound('cashout');
    } catch (error) {
      console.error('[BettingPanel] Claim error:', error);
      // Error already handled in hook
    }
  };

  const handlePlaceBet = async () => {
    if (!selectedTicket) {
      toast({
        title: "Select a Ticket",
        description: "Choose a ticket to place your bet",
        variant: "destructive",
      });
      return;
    }

    try {
      const autoCashoutValue = autoCashout === 'x2' ? 2 : autoCashout === 'x5' ? 5 : autoCashout === 'x10' ? 10 : null;
      await placeBet(selectedTicket, autoCashoutValue);
      
      playSound('bet');
      
      toast({
        title: "Bet Placed! 🎯",
        description: `${selectedTicket.ticket_value} WOVER${autoCashoutValue ? ` • Auto @${autoCashoutValue}×` : ''}`,
      });
      
      setSelectedTicket(null);
      onBetPlaced?.();
    } catch (error) {
      toast({
        title: "Bet Failed",
        description: error instanceof Error ? error.message : "Failed to place bet",
        variant: "destructive",
      });
    }
  };

  const handleCashOut = async () => {
    if (!myBet) return;

    try {
      const result = await cashOut(myBet.id, currentMultiplier);
      playSound('cashout');
      
      toast({
        title: "Cashed Out! 🎉",
        description: `Won ${result.cashout.winnings.toFixed(2)} WOVER at ${currentMultiplier}×`,
      });
    } catch (error) {
      toast({
        title: "Cash Out Failed",
        description: error instanceof Error ? error.message : "Failed to cash out",
        variant: "destructive",
      });
    }
  };

  // Active bet view
  if (myBet && currentRound) {
    const potentialWin = myBet.bet_amount * currentMultiplier;
    
    return (
      <div className="glass-card overflow-hidden">
        <div className="relative px-4 py-3 border-b border-border/20">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-warning/60 to-transparent" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-warning/20">
              <Zap className="w-4 h-4 text-warning" />
            </div>
            <span className="font-semibold text-sm">Your Bet</span>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="p-3 rounded-xl bg-card/50 border border-border/20 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Bet Amount</span>
              <span className="font-bold">{myBet.bet_amount} WOVER</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Auto Cash-out</span>
              <span className="font-medium">
                {myBet.auto_cashout_at ? `@${myBet.auto_cashout_at}×` : 'Manual'}
              </span>
            </div>
            
            {myBet.status === 'active' && currentRound.status === 'flying' && (
              <div className="pt-2 border-t border-border/20">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Potential Win</span>
                  <span className="font-bold text-lg text-success">{potentialWin.toFixed(2)} WOVER</span>
                </div>
              </div>
            )}
            
            {myBet.status === 'won' && (
              <div className="pt-2 border-t border-border/20">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Won</span>
                  <span className="font-bold text-lg text-success">+{myBet.winnings?.toFixed(2)} WOVER</span>
                </div>
                {canClaim && (
                  <p className="text-xs text-primary mt-1">Click below to claim on-chain!</p>
                )}
              </div>
            )}
            
            {myBet.status === 'lost' && (
              <div className="pt-2 border-t border-border/20 text-center">
                <span className="font-bold text-destructive">💥 LOST</span>
              </div>
            )}
          </div>

          {canCashOutState && (
            <Button
              onClick={handleCashOut}
              disabled={isCashingOut}
              className="w-full h-14 text-lg font-bold bg-success hover:bg-success/90 text-success-foreground shadow-lg shadow-success/30"
            >
              {isCashingOut ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <div className="flex items-center gap-2">
                  <Hand className="w-5 h-5" />
                  <span>CASH OUT {potentialWin.toFixed(2)}</span>
                </div>
              )}
            </Button>
          )}

          {/* Claim Winnings Button - shows when player won */}
          {myBet.status === 'won' && canClaim && (
            <Button
              onClick={handleClaimWinnings}
              disabled={isClaiming}
              className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30"
            >
              {isClaiming ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  <span>CLAIM {pendingAmount} WOVER</span>
                </div>
              )}
            </Button>
          )}

          {currentRound.status === 'betting' && (
            <p className="text-center text-xs text-muted-foreground animate-pulse">
              ⏳ Waiting for round to start...
            </p>
          )}
          
          {currentRound.status === 'countdown' && (
            <p className="text-center text-sm text-warning animate-pulse font-medium">
              🚀 Launching in 3... 2... 1...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Betting form
  return (
    <div className="glass-card overflow-hidden">
      <div className="relative px-4 py-3 border-b border-border/20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/20">
            <Target className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">Place Bet</span>
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {!isConnected ? (
          <div className="text-center py-8 text-muted-foreground">
            <Ticket className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Connect wallet to place bets</p>
          </div>
        ) : availableTickets.length === 0 ? (
          <div className="text-center py-6">
            <Ticket className="w-8 h-8 mx-auto mb-2 text-primary/50" />
            <p className="text-muted-foreground text-sm mb-1">No tickets available</p>
            <p className="text-xs text-primary">Buy tickets to play!</p>
          </div>
        ) : !canBet ? (
          <div className="text-center py-6 text-muted-foreground">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {currentRound?.status === 'flying' 
                ? '🚀 Round in progress...'
                : currentRound?.status === 'crashed'
                ? '💥 Round ended. Next round soon...'
                : '⏳ Waiting for betting phase...'}
            </p>
          </div>
        ) : (
          <>
            {/* Ticket Selection */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium">Select Ticket</label>
              <div className="grid grid-cols-2 gap-2 max-h-28 overflow-y-auto pr-1">
                {availableTickets.map((ticket) => (
                  <Button
                    key={ticket.id}
                    variant={selectedTicket?.id === ticket.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTicket(ticket)}
                    className={`h-10 justify-center font-bold transition-all ${
                      selectedTicket?.id === ticket.id 
                        ? "bg-primary shadow-lg shadow-primary/30 border-0" 
                        : "border-border/40 hover:border-primary/40 hover:bg-primary/10"
                    }`}
                  >
                    {ticket.ticket_value} WOVER
                  </Button>
                ))}
              </div>
            </div>

            {/* Auto Cash-out */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium">Auto Cash-out</label>
              <RadioGroup
                value={autoCashout}
                onValueChange={(v) => setAutoCashout(v as AutoCashout)}
                className="grid grid-cols-4 gap-2"
              >
                {(['x2', 'x5', 'x10', 'off'] as const).map((val) => (
                  <div key={val} className="flex items-center">
                    <RadioGroupItem value={val} id={val} className="peer sr-only" />
                    <Label 
                      htmlFor={val} 
                      className="flex-1 text-center py-2 px-1 rounded-lg border border-border/40 cursor-pointer text-xs font-medium transition-all peer-data-[state=checked]:bg-primary/20 peer-data-[state=checked]:border-primary/40 peer-data-[state=checked]:text-primary hover:bg-card/50"
                    >
                      {val === 'off' ? 'Manual' : val}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Place Bet Button */}
            <Button
              onClick={handlePlaceBet}
              disabled={!selectedTicket || isPlacingBet}
              className="w-full btn-primary h-11 text-sm font-semibold"
            >
              {isPlacingBet ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Placing Bet...</span>
                </div>
              ) : selectedTicket ? (
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  <span>Bet {selectedTicket.ticket_value} WOVER</span>
                </div>
              ) : (
                'Select a Ticket'
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default BettingPanel;
