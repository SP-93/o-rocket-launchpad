import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, Zap, Hand, Target } from 'lucide-react';
import { useGameTickets, type GameTicket } from '@/hooks/useGameTickets';
import { useGameBetting } from '@/hooks/useGameBetting';
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

type AutoCashout = 'x2' | 'x10' | 'off';

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
  
  // Sound effects
  const soundEnabled = typeof window !== 'undefined' && localStorage.getItem('rocketGameSound') !== 'false';
  const { playSound } = useGameSounds(soundEnabled);

  const canBet = currentRound?.status === 'betting' && !myBet && isConnected;
  const canCashOut = currentRound?.status === 'flying' && myBet?.status === 'active';

  const handlePlaceBet = async () => {
    if (!selectedTicket) {
      toast({
        title: "Select a Ticket",
        description: "Please select a ticket to place your bet",
        variant: "destructive",
      });
      return;
    }

    try {
      const autoCashoutValue = autoCashout === 'x2' ? 2 : autoCashout === 'x10' ? 10 : null;
      await placeBet(selectedTicket, autoCashoutValue);
      
      // Play bet sound
      playSound('bet');
      
      toast({
        title: "Bet Placed!",
        description: `Betting ${selectedTicket.ticket_value} WOVER${autoCashoutValue ? ` with auto cash-out at x${autoCashoutValue}` : ''}`,
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
      
      // Play cashout sound
      playSound('cashout');
      
      toast({
        title: "Cashed Out! 🎉",
        description: `Won ${result.cashout.winnings.toFixed(2)} WOVER at ${currentMultiplier}x`,
      });
    } catch (error) {
      toast({
        title: "Cash Out Failed",
        description: error instanceof Error ? error.message : "Failed to cash out",
        variant: "destructive",
      });
    }
  };

  // If player has an active bet
  if (myBet && currentRound) {
    const potentialWin = myBet.bet_amount * currentMultiplier;
    
    return (
      <Card className="glass-card border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="w-5 h-5 text-warning" />
            Your Bet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex justify-between mb-2">
              <span className="text-muted-foreground">Bet Amount:</span>
              <span className="font-bold">{myBet.bet_amount} WOVER</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-muted-foreground">Auto Cash-out:</span>
              <span className="font-medium">
                {myBet.auto_cashout_at ? `x${myBet.auto_cashout_at}` : 'Manual'}
              </span>
            </div>
            {myBet.status === 'active' && currentRound.status === 'flying' && (
              <div className="flex justify-between text-lg pt-2 border-t border-primary/20">
                <span className="text-muted-foreground">Potential Win:</span>
                <span className="font-bold text-success">{potentialWin.toFixed(2)} WOVER</span>
              </div>
            )}
            {myBet.status === 'won' && (
              <div className="flex justify-between text-lg pt-2 border-t border-primary/20">
                <span className="text-muted-foreground">Won:</span>
                <span className="font-bold text-success">{myBet.winnings.toFixed(2)} WOVER</span>
              </div>
            )}
            {myBet.status === 'lost' && (
              <div className="flex justify-between text-lg pt-2 border-t border-primary/20">
                <span className="text-muted-foreground">Result:</span>
                <span className="font-bold text-destructive">LOST</span>
              </div>
            )}
          </div>

          {canCashOut && (
            <Button
              onClick={handleCashOut}
              disabled={isCashingOut}
              className="w-full h-16 text-xl font-bold bg-success hover:bg-success/90 text-success-foreground animate-pulse"
            >
              {isCashingOut ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Hand className="w-6 h-6 mr-2" />
                  CASH OUT ({potentialWin.toFixed(2)} WOVER)
                </>
              )}
            </Button>
          )}

          {currentRound.status === 'betting' && (
            <p className="text-center text-sm text-muted-foreground">
              Waiting for round to start...
            </p>
          )}
          
          {currentRound.status === 'countdown' && (
            <p className="text-center text-sm text-warning animate-pulse">
              🚀 Launching in 3... 2... 1...
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Betting form
  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="w-5 h-5 text-primary" />
          Place Bet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <div className="text-center py-6 text-muted-foreground">
            Connect wallet to place bets
          </div>
        ) : availableTickets.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-2">No tickets available</p>
            <p className="text-sm text-primary">Buy tickets above to play!</p>
          </div>
        ) : !canBet ? (
          <div className="text-center py-6 text-muted-foreground">
            {currentRound?.status === 'flying' 
              ? 'Round in progress...'
              : currentRound?.status === 'crashed'
              ? 'Round ended. Next round soon...'
              : 'Waiting for betting phase...'}
          </div>
        ) : (
          <>
            {/* Ticket Selection */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Select Ticket</label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {availableTickets.map((ticket) => (
                  <Button
                    key={ticket.id}
                    variant={selectedTicket?.id === ticket.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTicket(ticket)}
                    className={`justify-between ${selectedTicket?.id === ticket.id ? "bg-primary" : "border-primary/30"}`}
                  >
                    <span>{ticket.ticket_value} WOVER</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Auto Cash-out Selection */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Auto Cash-out</label>
              <RadioGroup
                value={autoCashout}
                onValueChange={(v) => setAutoCashout(v as AutoCashout)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="x2" id="x2" />
                  <Label htmlFor="x2" className="cursor-pointer">x2</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="x10" id="x10" />
                  <Label htmlFor="x10" className="cursor-pointer">x10</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="off" id="off" />
                  <Label htmlFor="off" className="cursor-pointer">Manual</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Place Bet Button */}
            <Button
              onClick={handlePlaceBet}
              disabled={!selectedTicket || isPlacingBet}
              className="w-full btn-primary"
            >
              {isPlacingBet ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Placing Bet...
                </>
              ) : selectedTicket ? (
                `Bet ${selectedTicket.ticket_value} WOVER`
              ) : (
                'Select a Ticket'
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default BettingPanel;
