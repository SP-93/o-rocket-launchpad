import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { toast } from '@/hooks/use-toast';
import { CRASH_GAME_ABI } from '@/contracts/artifacts/crashGame';
import { getDeployedContracts } from '@/contracts/storage';
import { getProviderSync } from '@/lib/rpcProvider';

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

  const checkCanClaim = useCallback(async (roundId: number): Promise<{ canClaim: boolean; pendingAmount: string }> => {
    if (!walletAddress) {
      return { canClaim: false, pendingAmount: '0' };
    }

    try {
      const contract = getContract();
      
      const [canClaim, pendingAmount] = await Promise.all([
        contract.canClaimWinnings(roundId, walletAddress),
        contract.getPendingClaimAmount(roundId, walletAddress),
      ]);

      const formattedAmount = ethers.utils.formatEther(pendingAmount);
      
      setClaimState(prev => ({
        ...prev,
        canClaim,
        pendingAmount: formattedAmount,
      }));

      return { canClaim, pendingAmount: formattedAmount };
    } catch (error) {
      console.error('Error checking claim status:', error);
      return { canClaim: false, pendingAmount: '0' };
    }
  }, [walletAddress, getContract]);

  const claimWinnings = useCallback(async (
    signer: ethers.Signer,
    roundId: number
  ): Promise<string> => {
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    setClaimState(prev => ({ ...prev, isClaiming: true }));

    try {
      const contract = getContract(signer);
      
      // Check if can claim first
      const canClaim = await contract.canClaimWinnings(roundId, walletAddress);
      if (!canClaim) {
        throw new Error('Nothing to claim for this round');
      }

      // Get pending amount for display
      const pendingAmount = await contract.getPendingClaimAmount(roundId, walletAddress);
      const formattedAmount = ethers.utils.formatEther(pendingAmount);

      // Estimate gas
      const gasEstimate = await contract.estimateGas.claimWinnings(roundId);
      const gasLimit = gasEstimate.mul(120).div(100); // Add 20% buffer

      // Send claim transaction
      const tx = await contract.claimWinnings(roundId, {
        gasLimit,
      });

      toast({
        title: "Claiming Winnings...",
        description: `Transaction submitted. Claiming ${formattedAmount} WOVER`,
      });

      // Wait for confirmation
      const receipt = await tx.wait();

      if (receipt.status === 0) {
        throw new Error('Claim transaction failed');
      }

      setClaimState({
        isClaiming: false,
        canClaim: false,
        pendingAmount: '0',
        txHash: tx.hash,
      });

      toast({
        title: "Winnings Claimed! 🎉",
        description: `Successfully claimed ${formattedAmount} WOVER`,
      });

      return tx.hash;
    } catch (error: any) {
      console.error('Claim error:', error);
      
      setClaimState(prev => ({ ...prev, isClaiming: false }));

      // Parse error message
      let errorMessage = 'Failed to claim winnings';
      if (error.reason) {
        errorMessage = error.reason;
      } else if (error.message?.includes('user rejected')) {
        errorMessage = 'Transaction rejected by user';
      } else if (error.message?.includes('Already claimed')) {
        errorMessage = 'Winnings already claimed';
      } else if (error.message?.includes('Did not cash out')) {
        errorMessage = 'No winnings to claim - you lost this round';
      } else if (error.message?.includes('Round not completed')) {
        errorMessage = 'Round not yet completed';
      }

      toast({
        title: "Claim Failed",
        description: errorMessage,
        variant: "destructive",
      });

      throw new Error(errorMessage);
    }
  }, [walletAddress, getContract]);

  const getPlayerBet = useCallback(async (roundId: number): Promise<{
    amount: string;
    cashedOutAt: number;
    claimed: boolean;
    isWover: boolean;
  } | null> => {
    if (!walletAddress) return null;

    try {
      const contract = getContract();
      const bet = await contract.getPlayerBet(roundId, walletAddress);
      
      return {
        amount: ethers.utils.formatEther(bet.amount),
        cashedOutAt: bet.cashedOutAt.toNumber(),
        claimed: bet.claimed,
        isWover: bet.isWover,
      };
    } catch (error) {
      console.error('Error getting player bet:', error);
      return null;
    }
  }, [walletAddress, getContract]);

  return {
    ...claimState,
    checkCanClaim,
    claimWinnings,
    getPlayerBet,
  };
};

export default useClaimWinnings;
