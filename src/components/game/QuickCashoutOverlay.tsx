import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface QuickCashoutOverlayProps {
  walletAddress: string | undefined;
  myBet: {
    id: string;
    bet_amount: number;
    status: string | null;
    cashed_out_at: number | null;
    auto_cashout_at: number | null;
  } | null;
  currentMultiplier: number;
  roundStatus: string;
  onCashout?: () => void;
}

const QuickCashoutOverlay = ({ walletAddress, myBet, currentMultiplier, roundStatus, onCashout }: QuickCashoutOverlayProps) => {
  const [isCashingOut, setIsCashingOut] = useState(false);
  const [justCashedOut, setJustCashedOut] = useState(false);

  const canCashOut = walletAddress && myBet && 
    myBet.status === 'active' && 
    roundStatus === 'flying' && 
    !myBet.cashed_out_at;

  const potentialWin = myBet ? (myBet.bet_amount * currentMultiplier).toFixed(2) : '0.00';

  const handleCashOut = async () => {
    if (!myBet || !canCashOut || !walletAddress) return;
    
    setIsCashingOut(true);
    try {
      const { data, error } = await supabase.functions.invoke('game-cashout', {
        body: { 
          wallet_address: walletAddress,
          bet_id: myBet.id, 
          current_multiplier: currentMultiplier 
        }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      setJustCashedOut(true);
      const actualWin = data?.cashout?.winnings?.toFixed(2) || potentialWin;
      toast.success(`Cashed out at ${currentMultiplier.toFixed(2)}x! Won ${actualWin.toFixed(2)} WOVER`);
      onCashout?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cash out');
    } finally {
      setIsCashingOut(false);
    }
  };

  // Don't show if no active bet
  if (!myBet || myBet.status !== 'active') return null;

  // Already cashed out
  if (myBet.cashed_out_at || justCashedOut) {
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
        <div className="bg-success/90 backdrop-blur-md px-6 py-3 rounded-xl border border-success/50 shadow-lg shadow-success/20">
          <div className="text-center">
            <div className="text-success-foreground font-bold text-lg">
              ✓ Cashed Out at {(myBet.cashed_out_at || currentMultiplier).toFixed(2)}x
            </div>
          </div>
        </div>
      </div>
    );
  }

  // During flying - show cashout button
  if (roundStatus === 'flying') {
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
        <Button
          onClick={handleCashOut}
          disabled={isCashingOut || !canCashOut}
          size="lg"
          className={cn(
            "min-w-[200px] h-14 text-lg font-bold",
            "bg-gradient-to-r from-warning via-warning/90 to-warning",
            "hover:from-warning/90 hover:via-warning hover:to-warning/90",
            "text-warning-foreground shadow-lg shadow-warning/30",
            "animate-pulse hover:animate-none transition-all",
            "border-2 border-warning/50"
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
              CASH OUT ({potentialWin} W)
            </>
          )}
        </Button>
      </div>
    );
  }

  // Waiting for round to start flying
  if (roundStatus === 'betting' || roundStatus === 'countdown') {
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
        <div className="bg-card/90 backdrop-blur-md px-6 py-3 rounded-xl border border-primary/30">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Your bet</div>
            <div className="font-bold text-primary">{myBet.bet_amount} WOVER</div>
            {myBet.auto_cashout_at && (
              <div className="text-xs text-muted-foreground">
                Auto: {myBet.auto_cashout_at}x
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default QuickCashoutOverlay;
