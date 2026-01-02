import { useState, useEffect } from 'react';
import { Trophy, Coins, X, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useClaimWinnings } from '@/hooks/useClaimWinnings';
import { toast } from 'sonner';
interface ClaimWinNotificationProps {
  myBet: {
    id: string;
    status: string;
    winnings: number | null;
    cashed_out_at: number | null;
    round_id?: string;
  } | null;
  roundStatus: string | null;
  roundId: string | undefined;
  walletAddress: string | undefined;
  onClaimSuccess?: () => void;
}

const ClaimWinNotification = ({ 
  myBet, 
  roundStatus, 
  roundId,
  walletAddress,
  onClaimSuccess 
}: ClaimWinNotificationProps) => {
  const [dismissed, setDismissed] = useState(false);
  const [lastNotifiedRound, setLastNotifiedRound] = useState<string | null>(null);
  const { isClaiming, canClaim, txHash, checkCanClaim, claimWinnings } = useClaimWinnings(walletAddress);
  
  // Check if user just won
  const justWon = myBet?.status === 'won' && 
    (roundStatus === 'crashed' || roundStatus === 'payout');
  
  // Show notification when user wins
  const showNotification = justWon && !dismissed && myBet?.winnings && myBet.winnings > 0;
  
  // Reset dismissed state when round changes
  useEffect(() => {
    if (roundId && roundId !== lastNotifiedRound) {
      setDismissed(false);
      setLastNotifiedRound(roundId);
    }
  }, [roundId, lastNotifiedRound]);

  // Check claim eligibility when notification shows
  useEffect(() => {
    if (showNotification && myBet?.id) {
      checkCanClaim(myBet.id);
    }
  }, [showNotification, myBet?.id, checkCanClaim]);

  const handleClaim = async () => {
    if (!myBet?.id || !myBet.winnings) return;

    try {
      // claimWinnings now uses getUniversalSigner() internally
      await claimWinnings(myBet.id, myBet.winnings);
      toast.success('Winnings claimed successfully!');
      onClaimSuccess?.();
      setDismissed(true);
    } catch (error: any) {
      // Error already handled in hook with toast
      console.error('Claim error:', error);
    }
  };

  if (!showNotification) return null;

  return (
    <div className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up px-2 w-full max-w-[360px]">
      <div className={cn(
        "relative glass-card p-3 md:p-4 rounded-xl md:rounded-2xl border-2 border-success/50",
        "bg-gradient-to-r from-success/20 via-card to-success/20",
        "shadow-lg shadow-success/20"
      )}>
        {/* Dismiss button */}
        <button 
          onClick={() => setDismissed(true)}
          className="absolute top-1.5 right-1.5 p-1 rounded-full hover:bg-muted/50 transition-colors"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        
        {/* Win animation glow */}
        <div className="absolute inset-0 rounded-xl md:rounded-2xl bg-success/10 animate-pulse" />
        
        <div className="relative flex items-center gap-3">
          {/* Trophy icon - smaller on mobile */}
          <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-success/20 flex items-center justify-center">
            <Trophy className="w-5 h-5 md:w-6 md:h-6 text-success animate-bounce" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-success text-sm md:text-base flex items-center gap-1">
              🎉 You Won!
            </h4>
            
            <div className="flex items-center gap-1.5 mt-0.5">
              <Coins className="w-3.5 h-3.5 text-warning" />
              <span className="text-base md:text-lg font-bold text-warning">
                {myBet.winnings?.toFixed(2)} WOVER
              </span>
              {myBet.cashed_out_at && (
                <span className="text-[10px] md:text-xs text-muted-foreground">
                  @ {myBet.cashed_out_at.toFixed(2)}x
                </span>
              )}
            </div>
            
            {/* Claim button - inline on mobile */}
            <div className="mt-2">
              {isClaiming ? (
                <Button disabled className="h-8 w-full text-xs" size="sm">
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Claiming...
                </Button>
              ) : canClaim ? (
                <Button 
                  onClick={handleClaim}
                  className="h-8 w-full bg-success hover:bg-success/90 text-success-foreground text-xs"
                  size="sm"
                >
                  Claim Winnings
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              ) : txHash ? (
                <p className="text-[10px] md:text-xs text-success">
                  ✓ Already claimed
                </p>
              ) : (
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  Winnings added to your balance
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimWinNotification;