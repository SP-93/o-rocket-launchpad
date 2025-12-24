import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { toast } from '@/hooks/use-toast';
import { CRASH_GAME_ABI } from '@/contracts/artifacts/crashGame';
import { getDeployedContracts } from '@/contracts/storage';
import { getProviderSync } from '@/lib/rpcProvider';
import { supabase } from '@/integrations/supabase/client';

interface ClaimState {
  isClaiming: boolean;
  canClaim: boolean;
  pendingAmount: string;
  txHash: string | null;
}

export const useClaimWinnings = (walletAddress: string | undefined) => {
  const [claimState, setClaimState] = useState<ClaimState>({
    isClaiming: false,
    canClaim: false,
    pendingAmount: '0',
    txHash: null,
  });

  const getContract = useCallback((signer?: ethers.Signer) => {
    const contracts = getDeployedContracts();
    const contractAddress = contracts.crashGame;
    if (!contractAddress) {
      throw new Error('CrashGame contract not deployed');
    }

    if (signer) {
      return new ethers.Contract(contractAddress, CRASH_GAME_ABI, signer);
    }

    const provider = getProviderSync();
    return new ethers.Contract(contractAddress, CRASH_GAME_ABI, provider);
  }, []);

  // Check if player can claim for a specific round
  const checkCanClaim = useCallback(async (roundId: string): Promise<{ canClaim: boolean; pendingAmount: string }> => {
    if (!walletAddress) {
      return { canClaim: false, pendingAmount: '0' };
    }

    try {
      // Check database for bet and winnings
      const { data: bet, error } = await supabase
        .from('game_bets')
        .select('*, game_rounds(*)')
        .eq('round_id', roundId)
        .ilike('wallet_address', walletAddress)
        .single();

      if (error || !bet) {
        return { canClaim: false, pendingAmount: '0' };
      }

      // Player won if they cashed out
      if (!bet.cashed_out_at || bet.cashed_out_at <= 0) {
        return { canClaim: false, pendingAmount: '0' };
      }

      // Use stored winnings or calculate from bet amount and multiplier
      const winnings = bet.winnings || (bet.bet_amount * (bet.cashed_out_at || 1));

      // Check if can claim - only 'won' status is claimable
      // 'claiming' means another claim is in progress, 'claimed' means already done
      const canClaim = bet.status === 'won';

      setClaimState(prev => ({
        ...prev,
        canClaim,
        pendingAmount: winnings.toFixed(4),
      }));

      return { canClaim, pendingAmount: winnings.toFixed(4) };
    } catch (error) {
      console.error('Error checking claim status:', error);
      return { canClaim: false, pendingAmount: '0' };
    }
  }, [walletAddress]);

  // Request signature from backend and claim on-chain
  const claimWinnings = useCallback(async (
    signer: ethers.Signer,
    roundId: string,
    amount: string | number,
    nonce: number = Date.now()
  ): Promise<string> => {
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    setClaimState(prev => ({ ...prev, isClaiming: true }));

    try {
      // First, get claim data from backend
      const claimAmount = typeof amount === 'number' ? amount.toString() : amount;
      const { data: claimResponse, error: claimError } = await supabase.functions.invoke('game-sign-claim', {
        body: {
          walletAddress,
          roundId,
          amount: claimAmount,
          nonce,
        },
      });

      // Handle 409 Conflict - claim already in progress
      if (claimError?.message?.includes('409') || claimResponse?.error?.includes('in progress')) {
        toast({
          title: "Claim In Progress",
          description: "This reward is already being claimed. Please wait.",
          variant: "destructive",
        });
        throw new Error('Claim already in progress');
      }

      if (claimError || !claimResponse?.success) {
        throw new Error(claimResponse?.error || 'Failed to get claim signature');
      }

      // For now, since signature generation isn't fully implemented in edge function,
      // we'll show an informational message
      if (!claimResponse.signature) {
        toast({
          title: "Claim Pending",
          description: "Signature system integration in progress. Winnings tracked in database.",
        });
        
        // Update bet status to 'claimed' in database
        await supabase
          .from('game_bets')
          .update({ status: 'claimed' })
          .eq('round_id', roundId)
          .ilike('wallet_address', walletAddress);

        setClaimState({
          isClaiming: false,
          canClaim: false,
          pendingAmount: '0',
          txHash: null,
        });

        return 'pending-signature-integration';
      }

      const contract = getContract(signer);
      const { claimData, signature } = claimResponse;

      // Convert amount to BigNumber
      const amountWei = ethers.BigNumber.from(claimData.amount);
      const roundIdBytes32 = ethers.utils.id(roundId);

      console.log('[ClaimWinnings] Claiming on-chain:', {
        amount: ethers.utils.formatEther(amountWei),
        roundId: roundIdBytes32,
        nonce,
      });

      // Estimate gas
      const gasEstimate = await contract.estimateGas.claimWinnings(
        amountWei,
        roundIdBytes32,
        nonce,
        signature
      );
      const gasLimit = gasEstimate.mul(120).div(100);

      // Send claim transaction
      const tx = await contract.claimWinnings(
        amountWei,
        roundIdBytes32,
        nonce,
        signature,
        { gasLimit }
      );

      toast({
        title: "Claiming Winnings...",
        description: `Transaction submitted: ${tx.hash.slice(0, 10)}...`,
      });

      const receipt = await tx.wait();

      if (receipt.status === 0) {
        throw new Error('Claim transaction failed');
      }

      // IMPORTANT: Call backend to verify and finalize the claim
      // This prevents double-claiming by verifying tx on-chain before updating status
      console.log('[ClaimWinnings] Confirming claim with backend...');
      const { data: confirmResponse, error: confirmError } = await supabase.functions.invoke('game-confirm-claim', {
        body: {
          walletAddress,
          roundId,
          txHash: tx.hash,
          nonce,
          amount: claimAmount,
        },
      });

      if (confirmError || !confirmResponse?.success) {
        console.error('[ClaimWinnings] Confirm error:', confirmError || confirmResponse?.error);
        // Transaction succeeded on-chain, but backend update failed
        // Show warning but don't throw - the claim was successful
        toast({
          title: "Claim Successful",
          description: "Blockchain confirmed. Status sync may take a moment.",
        });
      }

      setClaimState({
        isClaiming: false,
        canClaim: false,
        pendingAmount: '0',
        txHash: tx.hash,
      });

      toast({
        title: "Winnings Claimed! 🎉",
        description: `Successfully claimed ${claimAmount} WOVER`,
      });

      return tx.hash;
    } catch (error: any) {
      console.error('[ClaimWinnings] Error:', error);
      
      setClaimState(prev => ({ ...prev, isClaiming: false }));

      let errorMessage = 'Failed to claim winnings';
      if (error.reason) {
        errorMessage = error.reason;
      } else if (error.message?.includes('user rejected')) {
        errorMessage = 'Transaction rejected by user';
      } else if (error.message?.includes('Claim already used')) {
        errorMessage = 'Winnings already claimed';
      } else if (error.message?.includes('Invalid signature')) {
        errorMessage = 'Invalid claim signature';
      } else if (error.message?.includes('Insufficient prize pool')) {
        errorMessage = 'Prize pool insufficient - contact admin';
      }

      toast({
        title: "Claim Failed",
        description: errorMessage,
        variant: "destructive",
      });

      throw new Error(errorMessage);
    }
  }, [walletAddress, getContract]);

  return {
    ...claimState,
    checkCanClaim,
    claimWinnings,
  };
};

export default useClaimWinnings;
