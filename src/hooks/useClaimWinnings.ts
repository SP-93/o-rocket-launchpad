import { useState, useCallback, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { toast } from '@/hooks/use-toast';
import { CRASH_GAME_ABI } from '@/contracts/artifacts/crashGame';
import { getDeployedContractsAsync } from '@/contracts/storage';
import { supabase } from '@/integrations/supabase/client';

// LocalStorage key for pending claim recovery
const PENDING_CLAIM_KEY = 'pending_claim';
const CLAIM_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes max age for recovery
const CLAIM_MIN_AGE_MS = 5 * 1000; // Wait at least 5 seconds before recovery

interface PendingClaimData {
  betId: string;
  txHash: string; // May be empty if signature obtained but tx not yet sent
  nonce: number;
  amount: string;
  walletAddress: string;
  timestamp: number;
  // NEW: Store signature for recovery if tx wasn't sent
  signature?: string;
  roundIdHash?: string;
  contractAddress?: string;
  amountWei?: string;
}

interface ClaimState {
  isClaiming: boolean;
  canClaim: boolean;
  pendingAmount: string;
  txHash: string | null;
  isRecovering: boolean;
}

// Save pending claim to localStorage BEFORE sending transaction
const savePendingClaim = (data: PendingClaimData) => {
  try {
    localStorage.setItem(PENDING_CLAIM_KEY, JSON.stringify(data));
    console.log('[ClaimWinnings] Saved pending claim to localStorage:', data.betId, 'txHash:', data.txHash || 'NOT_SENT_YET');
  } catch (e) {
    console.warn('[ClaimWinnings] Failed to save pending claim:', e);
  }
};

// Update pending claim with tx hash after sending
const updatePendingClaimTxHash = (txHash: string) => {
  try {
    const data = localStorage.getItem(PENDING_CLAIM_KEY);
    if (!data) return;
    const pending = JSON.parse(data) as PendingClaimData;
    pending.txHash = txHash;
    localStorage.setItem(PENDING_CLAIM_KEY, JSON.stringify(pending));
    console.log('[ClaimWinnings] Updated pending claim with txHash:', txHash);
  } catch (e) {
    console.warn('[ClaimWinnings] Failed to update pending claim txHash:', e);
  }
};

// Clear pending claim from localStorage
const clearPendingClaim = () => {
  try {
    localStorage.removeItem(PENDING_CLAIM_KEY);
    console.log('[ClaimWinnings] Cleared pending claim from localStorage');
  } catch (e) {
    console.warn('[ClaimWinnings] Failed to clear pending claim:', e);
  }
};

// Get pending claim from localStorage
const getPendingClaim = (): PendingClaimData | null => {
  try {
    const data = localStorage.getItem(PENDING_CLAIM_KEY);
    if (!data) return null;
    return JSON.parse(data) as PendingClaimData;
  } catch (e) {
    console.warn('[ClaimWinnings] Failed to read pending claim:', e);
    return null;
  }
};

export const useClaimWinnings = (walletAddress: string | undefined) => {
  const [claimState, setClaimState] = useState<ClaimState>({
    isClaiming: false,
    canClaim: false,
    pendingAmount: '0',
    txHash: null,
    isRecovering: false,
  });

  // Ref to track if beforeunload is set
  const beforeUnloadRef = useRef<((e: BeforeUnloadEvent) => void) | null>(null);

  // CRITICAL: Add beforeunload warning when claiming
  useEffect(() => {
    if (claimState.isClaiming && !beforeUnloadRef.current) {
      const handler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = 'Claim in progress! If you leave, you may lose your transaction. Are you sure?';
        return e.returnValue;
      };
      window.addEventListener('beforeunload', handler);
      beforeUnloadRef.current = handler;
      console.log('[ClaimWinnings] Added beforeunload warning');
    } else if (!claimState.isClaiming && beforeUnloadRef.current) {
      window.removeEventListener('beforeunload', beforeUnloadRef.current);
      beforeUnloadRef.current = null;
      console.log('[ClaimWinnings] Removed beforeunload warning');
    }

    return () => {
      if (beforeUnloadRef.current) {
        window.removeEventListener('beforeunload', beforeUnloadRef.current);
        beforeUnloadRef.current = null;
      }
    };
  }, [claimState.isClaiming]);

  // Recovery effect: check for pending claims on mount
  useEffect(() => {
    const recoverPendingClaim = async () => {
      if (!walletAddress) return;

      const pending = getPendingClaim();
      if (!pending) return;

      // Check if this pending claim belongs to current wallet
      if (pending.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        console.log('[ClaimWinnings] Pending claim for different wallet, ignoring');
        return;
      }

      const age = Date.now() - pending.timestamp;

      // Too old - call reset-stuck-claims to handle it server-side
      if (age > CLAIM_TIMEOUT_MS) {
        console.log('[ClaimWinnings] Pending claim too old, triggering server-side cleanup');
        try {
          await supabase.functions.invoke('game-reset-stuck-claims', {});
        } catch (e) {
          console.warn('[ClaimWinnings] Failed to trigger cleanup:', e);
        }
        clearPendingClaim();
        return;
      }

      // Too fresh - let the original flow complete
      if (age < CLAIM_MIN_AGE_MS) {
        console.log('[ClaimWinnings] Pending claim too fresh, waiting');
        return;
      }

      // Try to recover this claim
      console.log('[ClaimWinnings] Recovering pending claim:', pending.betId, 'txHash:', pending.txHash || 'NONE');
      setClaimState(prev => ({ ...prev, isRecovering: true }));

      try {
        // Case 1: We have a txHash - check if it was confirmed
        if (pending.txHash) {
          const provider = new ethers.providers.JsonRpcProvider('https://rpc.overprotocol.com');
          const receipt = await provider.getTransactionReceipt(pending.txHash);
          
          if (receipt) {
            if (receipt.status === 1) {
              // Transaction succeeded! Confirm with backend
              console.log('[ClaimWinnings] Pending tx confirmed on-chain, confirming with backend...');
              
              toast({
                title: 'Recovering Claim...',
                description: 'Found confirmed transaction, syncing...',
              });

              const { data: confirmResponse, error: confirmError } = await supabase.functions.invoke('game-confirm-claim', {
                body: {
                  walletAddress: pending.walletAddress,
                  betId: pending.betId,
                  txHash: pending.txHash,
                  nonce: pending.nonce,
                  amount: pending.amount,
                },
              });

              if (confirmError || !confirmResponse?.success) {
                console.warn('[ClaimWinnings] Recovery confirm failed:', confirmError || confirmResponse?.error);
              } else {
                toast({
                  title: 'Claim Recovered!',
                  description: `Successfully recovered ${pending.amount} WOVER claim`,
                });
              }
              
              clearPendingClaim();
            } else {
              // Transaction failed - reset via server
              console.log('[ClaimWinnings] Pending tx failed on-chain, triggering reset...');
              
              await supabase.functions.invoke('game-reset-stuck-claims', {});
              clearPendingClaim();
              
              toast({
                title: 'Claim Recovery Failed',
                description: 'Transaction failed. You can try claiming again.',
                variant: 'destructive',
              });
            }
          } else {
            // Transaction still pending - check if it's been too long
            if (age > 5 * 60 * 1000) {
              // 5 minutes with no receipt - likely dropped
              console.log('[ClaimWinnings] Pending tx not found after 5 min, triggering reset...');
              
              await supabase.functions.invoke('game-reset-stuck-claims', {});
              clearPendingClaim();
              
              toast({
                title: 'Claim Expired',
                description: 'Transaction not confirmed. You can try claiming again.',
                variant: 'destructive',
              });
            } else {
              // Still waiting - show message but don't clear
              toast({
                title: 'Claim Pending',
                description: 'Previous claim transaction still processing...',
              });
            }
          }
        } else {
          // Case 2: We have signature but no txHash - tx was never sent
          // The bet is locked as 'claiming' - need to either resend or reset
          console.log('[ClaimWinnings] Pending claim has signature but no txHash - resetting...');
          
          // Trigger server-side reset (will check on-chain status properly)
          await supabase.functions.invoke('game-reset-stuck-claims', {});
          clearPendingClaim();
          
          toast({
            title: 'Claim Reset',
            description: 'Previous claim was interrupted. You can try again.',
          });
        }
      } catch (error) {
        console.error('[ClaimWinnings] Recovery error:', error);
        // On error, don't clear - let next refresh try again
      } finally {
        setClaimState(prev => ({ ...prev, isRecovering: false }));
      }
    };

    recoverPendingClaim();
  }, [walletAddress]);

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

      // Track state for cleanup
      let locked = false;
      let txHash: string | null = null;

      try {
        // Preflight: resolve contract + verify network BEFORE locking bet in backend
        const deployed = await getDeployedContractsAsync();
        const contractAddress = deployed.crashGame;
        if (!contractAddress) {
          throw new Error('Game contract not configured');
        }

        const provider = signer.provider;
        if (!provider) {
          throw new Error('No wallet provider');
        }

        const net = await provider.getNetwork();
        if (net?.chainId !== 54176) {
          throw new Error(`Wrong network (chainId ${net?.chainId}). Switch to OverProtocol Mainnet`);
        }

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

        // Bet is now locked in "claiming" state
        locked = true;

        const { claimData, signature } = claimResponse;

        if (!signature || !claimData?.amount || !claimData?.roundId) {
          throw new Error('Invalid claim response');
        }

        // CRITICAL: Save pending claim IMMEDIATELY after getting signature, BEFORE sending tx
        // This ensures we can recover even if the user refreshes before tx is sent
        savePendingClaim({
          betId,
          txHash: '', // Will be updated after tx is sent
          nonce,
          amount: claimAmount,
          walletAddress,
          timestamp: Date.now(),
          signature,
          roundIdHash: claimData.roundId,
          contractAddress: claimData.contractAddress,
          amountWei: claimData.amount,
        });

        const contract = new ethers.Contract(contractAddress, CRASH_GAME_ABI, signer);

        // Convert amount to BigNumber
        const amountWei = ethers.BigNumber.from(claimData.amount);

        console.log('[ClaimWinnings] Claiming on-chain:', {
          betId,
          contractAddress,
          amount: ethers.utils.formatEther(amountWei),
          roundId: claimData.roundId,
          nonce,
        });

        // Gas: on mobile wallets estimateGas frequently fails; fallback to a safe fixed limit
        let gasLimit: ethers.BigNumber | undefined;
        try {
          const gasEstimate = await contract.estimateGas.claimWinnings(
            amountWei,
            claimData.roundId,
            nonce,
            signature
          );
          gasLimit = gasEstimate.mul(130).div(100);
        } catch (e) {
          console.warn('[ClaimWinnings] estimateGas failed, using fixed gasLimit', e);
          gasLimit = ethers.BigNumber.from(800_000);
        }

        // 2) Send claim transaction
        const tx = await contract.claimWinnings(amountWei, claimData.roundId, nonce, signature, { gasLimit });
        txHash = tx.hash;

        // CRITICAL: Update localStorage with actual txHash
        updatePendingClaimTxHash(tx.hash);

        // CRITICAL FIX: Save txHash to database IMMEDIATELY (before waiting for confirmation)
        // This ensures we can recover even if user refreshes during tx.wait()
        try {
          const { error: saveTxError } = await supabase.functions.invoke('game-save-tx-hash', {
            body: {
              walletAddress,
              betId,
              txHash: tx.hash,
              nonce,
            },
          });
          if (saveTxError) {
            console.warn('[ClaimWinnings] Failed to save txHash to DB (non-fatal):', saveTxError);
          } else {
            console.log('[ClaimWinnings] TxHash saved to database:', tx.hash);
          }
        } catch (saveErr) {
          console.warn('[ClaimWinnings] Error saving txHash (non-fatal):', saveErr);
        }

        toast({
          title: '⏳ Confirming Transaction...',
          description: `DO NOT REFRESH! TX: ${tx.hash.slice(0, 10)}...`,
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

        // SUCCESS - clear pending claim from localStorage
        clearPendingClaim();

        setClaimState({
          isClaiming: false,
          canClaim: false,
          pendingAmount: '0',
          txHash: tx.hash,
          isRecovering: false,
        });

        toast({
          title: 'Winnings Claimed!',
          description: `Successfully claimed ${claimAmount} WOVER`,
        });

        return tx.hash;
      } catch (error: any) {
        console.error('[ClaimWinnings] Error:', error);

        // If bet was locked but NO tx was sent, unlock it immediately
        if (locked && !txHash) {
          try {
            console.log('[ClaimWinnings] Unlocking claim (no tx sent)...');
            await supabase.functions.invoke('game-cancel-claim', {
              body: { walletAddress, betId, nonce },
            });
            // Also clear localStorage since no tx was sent
            clearPendingClaim();
          } catch (cancelErr) {
            console.warn('[ClaimWinnings] Failed to cancel claim lock:', cancelErr);
          }
        }

        // If tx was sent but failed BEFORE waiting completed, keep in localStorage for recovery
        // (recovery will handle it on next mount)

        setClaimState((prev) => ({ ...prev, isClaiming: false }));

        // Determine error message
        const message = String(error?.message || '');
        const rejected = error?.code === 4001 || message.toLowerCase().includes('user rejected');
        
        let errorMessage = 'Failed to claim winnings';
        if (error?.reason) {
          errorMessage = error.reason;
        } else if (rejected) {
          errorMessage = 'Transaction rejected by user';
          // User rejected - clear pending claim
          clearPendingClaim();
        } else if (message.includes('Claim already used')) {
          errorMessage = 'Winnings already claimed';
          clearPendingClaim();
        } else if (message.includes('Invalid signature')) {
          errorMessage = 'Invalid claim signature';
        } else if (message.includes('Insufficient prize pool')) {
          errorMessage = 'Prize pool insufficient - contact admin';
        } else if (message.includes('No wallet provider')) {
          errorMessage = 'Wallet not available - reconnect and try again';
        } else if (message.includes('estimateGas')) {
          errorMessage = 'Transaction failed - try again';
        }

        toast({
          title: 'Claim Failed',
          description: errorMessage,
          variant: 'destructive',
        });

        throw new Error(errorMessage);
      }
    },
    [walletAddress]
  );


  return {
    ...claimState,
    checkCanClaim,
    claimWinnings,
  };
};

export default useClaimWinnings;
