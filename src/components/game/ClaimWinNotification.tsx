import { useState, useEffect } from 'react';
import { Trophy, Coins, X, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useClaimWinnings } from '@/hooks/useClaimWinnings';
import { toast } from 'sonner';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';

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
  const { data: walletClient } = useWalletClient();
  
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
    if (showNotification && roundId) {
      checkCanClaim(roundId);
    }
  }, [showNotification, roundId, checkCanClaim]);

  const handleClaim = async () => {
    if (!roundId || !myBet || !walletClient || !myBet.winnings) return;
    
    try {
      // Create ethers signer from wagmi wallet client
      const provider = new ethers.providers.Web3Provider(walletClient as any);
      const signer = provider.getSigner();
      
      await claimWinnings(signer, roundId, myBet.winnings);
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
    <div className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className={cn(
        "relative glass-card p-4 rounded-2xl border-2 border-success/50",
        "bg-gradient-to-r from-success/20 via-card to-success/20",
        "shadow-lg shadow-success/20",
        "min-w-[320px] max-w-[400px]"
      )}>
        {/* Dismiss button */}
        <button 
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted/50 transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
        
        {/* Win animation glow */}
        <div className="absolute inset-0 rounded-2xl bg-success/10 animate-pulse" />
        
        <div className="relative flex items-start gap-4">
          {/* Trophy icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-success animate-bounce" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-success flex items-center gap-2">
              🎉 You Won!
            </h4>
            
            <div className="flex items-center gap-2 mt-1">
              <Coins className="w-4 h-4 text-warning" />
              <span className="text-lg font-bold text-warning">
                {myBet.winnings?.toFixed(2)} WOVER
              </span>
              {myBet.cashed_out_at && (
                <span className="text-xs text-muted-foreground">
                  @ {myBet.cashed_out_at.toFixed(2)}x
                </span>
              )}
            </div>
            
            {/* Claim button */}
            <div className="mt-3">
              {isClaiming ? (
                <Button disabled className="w-full" size="sm">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Claiming...
                </Button>
              ) : canClaim && walletClient ? (
                <Button 
                  onClick={handleClaim}
                  className="w-full bg-success hover:bg-success/90 text-success-foreground"
                  size="sm"
                >
                  Claim Winnings
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : txHash ? (
                <p className="text-xs text-success">
                  ✓ Already claimed
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
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