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

  // Check if player can claim for a specific bet
  const checkCanClaim = useCallback(
    async (betId: string): Promise<{ canClaim: boolean; pendingAmount: string }> => {
      if (!walletAddress) {
        return { canClaim: false, pendingAmount: '0' };
      }

      try {
        const { data: bet, error } = await supabase
          .from('game_bets')
          .select('*')
          .eq('id', betId)
          .maybeSingle();

        if (error || !bet) {
          return { canClaim: false, pendingAmount: '0' };
        }

        // Ensure this bet belongs to the current wallet
        if (bet.wallet_address?.toLowerCase() !== walletAddress.toLowerCase()) {
          return { canClaim: false, pendingAmount: '0' };
        }

        // Player won if they cashed out
        if (!bet.cashed_out_at || bet.cashed_out_at <= 0) {
          return { canClaim: false, pendingAmount: '0' };
        }

        const winnings = bet.winnings || bet.bet_amount * (bet.cashed_out_at || 1);
        const canClaimNow = bet.status === 'won';

        setClaimState((prev) => ({
          ...prev,
          canClaim: canClaimNow,
          pendingAmount: winnings.toFixed(4),
        }));

        return { canClaim: canClaimNow, pendingAmount: winnings.toFixed(4) };
      } catch (error) {
        console.error('Error checking claim status:', error);
        return { canClaim: false, pendingAmount: '0' };
      }
    },
    [walletAddress]
  );

  // Request signature from backend and claim on-chain
  const claimWinnings = useCallback(
    async (
      signer: ethers.Signer,
      betId: string,
      amount: string | number,
      nonce: number = Date.now()
    ): Promise<string> => {
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }

      setClaimState((prev) => ({ ...prev, isClaiming: true }));

      const claimAmount = typeof amount === 'number' ? amount.toString() : amount;

      try {
        // 1) Get claim signature (also locks bet -> claiming)
        const { data: claimResponse, error: claimError } = await supabase.functions.invoke('game-sign-claim', {
          body: {
            walletAddress,
            betId,
            amount: claimAmount,
            nonce,
          },
        });

        // Handle 409 Conflict - claim already in progress
        if (claimError?.message?.includes('409') || claimResponse?.error?.includes('in progress')) {
          toast({
            title: 'Claim In Progress',
            description: 'This reward is already being claimed. Please wait.',
            variant: 'destructive',
          });
          throw new Error('Claim already in progress');
        }

        if (claimError || !claimResponse?.success) {
          throw new Error(claimResponse?.error || 'Failed to get claim signature');
        }

        const contract = getContract(signer);
        const { claimData, signature } = claimResponse;

        if (!signature || !claimData?.amount || !claimData?.roundId) {
          throw new Error('Invalid claim response');
        }

        // Convert amount to BigNumber
        const amountWei = ethers.BigNumber.from(claimData.amount);

        console.log('[ClaimWinnings] Claiming on-chain:', {
          betId,
          amount: ethers.utils.formatEther(amountWei),
          roundId: claimData.roundId,
          nonce,
        });

        // Estimate gas
        const gasEstimate = await contract.estimateGas.claimWinnings(
          amountWei,
          claimData.roundId,
          nonce,
          signature
        );
        const gasLimit = gasEstimate.mul(120).div(100);

        // 2) Send claim transaction
        const tx = await contract.claimWinnings(amountWei, claimData.roundId, nonce, signature, { gasLimit });

        toast({
          title: 'Claiming Winnings...',
          description: `Transaction submitted: ${tx.hash.slice(0, 10)}...`,
        });

        const receipt = await tx.wait();
        if (receipt.status === 0) {
          throw new Error('Claim transaction failed');
        }

        // 3) Confirm claim with backend (verifies on-chain event, updates DB)
        console.log('[ClaimWinnings] Confirming claim with backend...');
        const { data: confirmResponse, error: confirmError } = await supabase.functions.invoke('game-confirm-claim', {
          body: {
            walletAddress,
            betId,
            txHash: tx.hash,
            nonce,
            amount: claimAmount,
          },
        });

        if (confirmError || !confirmResponse?.success) {
          console.error('[ClaimWinnings] Confirm error:', confirmError || confirmResponse?.error);
          toast({
            title: 'Claim Submitted',
            description: 'Blockchain confirmed. Status sync may take a moment.',
          });
        }

        setClaimState({
          isClaiming: false,
          canClaim: false,
          pendingAmount: '0',
          txHash: tx.hash,
        });

        toast({
          title: 'Winnings Claimed',
          description: `Successfully claimed ${claimAmount} WOVER`,
        });

        return tx.hash;
      } catch (error: any) {
        console.error('[ClaimWinnings] Error:', error);

        // If user rejected tx in wallet, immediately unlock bet back to 'won'
        const message = String(error?.message || '');
        const rejected = error?.code === 4001 || message.toLowerCase().includes('user rejected');
        if (rejected) {
          try {
            await supabase.functions.invoke('game-cancel-claim', {
              body: { walletAddress, betId, nonce },
            });
          } catch (cancelErr) {
            console.warn('[ClaimWinnings] Failed to cancel claim lock:', cancelErr);
          }
        }

        setClaimState((prev) => ({ ...prev, isClaiming: false }));

        let errorMessage = 'Failed to claim winnings';
        if (error?.reason) {
          errorMessage = error.reason;
        } else if (rejected) {
          errorMessage = 'Transaction rejected by user';
        } else if (message.includes('Claim already used')) {
          errorMessage = 'Winnings already claimed';
        } else if (message.includes('Invalid signature')) {
          errorMessage = 'Invalid claim signature';
        } else if (message.includes('Insufficient prize pool')) {
          errorMessage = 'Prize pool insufficient - contact admin';
        }

        toast({
          title: 'Claim Failed',
          description: errorMessage,
          variant: 'destructive',
        });

        throw new Error(errorMessage);
      }
    },
    [walletAddress, getContract]
  );


  return {
    ...claimState,
    checkCanClaim,
    claimWinnings,
  };
};

export default useClaimWinnings;
