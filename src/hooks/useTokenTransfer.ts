import { useState, useCallback } from 'react';
import { useWalletClient, usePublicClient } from 'wagmi';
import { parseUnits } from 'viem';
import { overProtocol } from '@/config/web3modal';
import { toast } from '@/hooks/use-toast';

// ERC20 ABI for transfer
const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
] as const;

// Token addresses on OverProtocol
export const TOKEN_ADDRESSES = {
  WOVER: '0x59c914C8ac6F212bb655737CC80d9Abc79A1e273' as `0x${string}`,
  USDT: '0xA510432E4aa60B4acd476fb850EC84B7EE226b2d' as `0x${string}`,
  USDC: '0x8712796136Ac8e0EEeC123251ef93702f265aa80' as `0x${string}`,
} as const;

// Treasury wallet
export const TREASURY_WALLET = '0x8334966329b7f4b459633696A8CA59118253bC89' as `0x${string}`;

export interface TransferResult {
  success: boolean;
  txHash?: string;
  error?: string;
  status?: 'pending' | 'confirmed' | 'failed';
}

export function useTokenTransfer() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [isPending, setIsPending] = useState(false);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);

  // Poll for transaction receipt with longer timeout
  const waitForReceipt = useCallback(async (
    hash: `0x${string}`,
    maxAttempts: number = 120, // 10 minutes with 5s intervals
    intervalMs: number = 5000
  ): Promise<'success' | 'failed' | 'pending'> => {
    if (!publicClient) return 'pending';
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash });
        if (receipt) {
          return receipt.status === 'success' ? 'success' : 'failed';
        }
      } catch (error) {
        // Transaction not yet mined, continue polling
        console.log(`[TokenTransfer] Polling attempt ${attempt + 1}/${maxAttempts}...`);
      }
      
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
    
    return 'pending'; // Still pending after all attempts
  }, [publicClient]);

  const transferToken = useCallback(async (
    tokenSymbol: 'WOVER' | 'USDT',
    amount: number
  ): Promise<TransferResult> => {
    if (!walletClient) {
      return { success: false, error: 'Wallet not connected' };
    }

    const tokenAddress = TOKEN_ADDRESSES[tokenSymbol];
    if (!tokenAddress) {
      return { success: false, error: 'Invalid token' };
    }

    setIsPending(true);
    setPendingTxHash(null);
    
    try {
      // Get token decimals (WOVER has 18, USDT usually has 6)
      const decimals = tokenSymbol === 'WOVER' ? 18 : 6;
      const amountInWei = parseUnits(amount.toString(), decimals);

      console.log('[TokenTransfer] Initiating transfer:', {
        token: tokenSymbol,
        amount,
        decimals,
        to: TREASURY_WALLET,
      });

      // Use writeContract for ERC20 transfer
      const hash = await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [TREASURY_WALLET, amountInWei],
        chain: overProtocol,
        account: walletClient.account,
      });

      console.log('[TokenTransfer] Transaction sent:', hash);
      setPendingTxHash(hash);

      // Show pending toast
      toast({
        title: "Transaction Sent",
        description: "Waiting for confirmation... This may take a few minutes.",
      });

      // Wait for confirmation with extended polling
      const status = await waitForReceipt(hash);
      
      if (status === 'success') {
        console.log('[TokenTransfer] Transaction confirmed!');
        return { success: true, txHash: hash, status: 'confirmed' };
      } else if (status === 'failed') {
        return { success: false, error: 'Transaction failed on-chain', txHash: hash, status: 'failed' };
      } else {
        // Still pending - return success with pending status so user can use tx hash
        console.log('[TokenTransfer] Transaction still pending, but hash is valid');
        return { success: true, txHash: hash, status: 'pending' };
      }
    } catch (error: any) {
      console.error('[TokenTransfer] Error:', error);
      
      // Parse common errors
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        return { success: false, error: 'Transaction rejected by user' };
      }
      if (error.message?.includes('insufficient')) {
        return { success: false, error: 'Insufficient token balance' };
      }
      
      return { success: false, error: error.message || 'Transfer failed' };
    } finally {
      setIsPending(false);
    }
  }, [walletClient, waitForReceipt]);

  const getTokenBalance = useCallback(async (
    tokenSymbol: 'WOVER' | 'USDT',
    address: string
  ): Promise<number> => {
    if (!publicClient) return 0;

    const tokenAddress = TOKEN_ADDRESSES[tokenSymbol];
    if (!tokenAddress) return 0;

    try {
      const balance = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      });

      const decimals = tokenSymbol === 'WOVER' ? 18 : 6;
      return Number(balance) / Math.pow(10, decimals);
    } catch (error) {
      console.error('[TokenTransfer] Balance check error:', error);
      return 0;
    }
  }, [publicClient]);

  // Manual verification for pending transactions
  const verifyTransaction = useCallback(async (txHash: string): Promise<TransferResult> => {
    if (!publicClient) {
      return { success: false, error: 'No provider available' };
    }

    try {
      const receipt = await publicClient.getTransactionReceipt({ 
        hash: txHash as `0x${string}` 
      });
      
      if (receipt) {
        if (receipt.status === 'success') {
          return { success: true, txHash, status: 'confirmed' };
        } else {
          return { success: false, txHash, status: 'failed', error: 'Transaction failed' };
        }
      } else {
        return { success: true, txHash, status: 'pending' };
      }
    } catch (error) {
      console.error('[TokenTransfer] Verify error:', error);
      return { success: false, error: 'Could not verify transaction' };
    }
  }, [publicClient]);

  return {
    transferToken,
    getTokenBalance,
    verifyTransaction,
    isPending,
    pendingTxHash,
  };
}
