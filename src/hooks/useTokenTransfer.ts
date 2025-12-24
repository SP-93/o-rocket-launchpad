import { useState, useCallback } from 'react';
import { useWalletClient, usePublicClient } from 'wagmi';
import { parseUnits, encodeFunctionData } from 'viem';
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
}

export function useTokenTransfer() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [isPending, setIsPending] = useState(false);

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
    
    try {
      // Get token decimals (WOVER has 18, USDT usually has 6)
      const decimals = tokenSymbol === 'WOVER' ? 18 : 6;
      const amountInWei = parseUnits(amount.toString(), decimals);

      // Use writeContract for ERC20 transfer (cleaner approach)
      const hash = await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [TREASURY_WALLET, amountInWei],
        chain: overProtocol,
        account: walletClient.account,
      });

      console.log('[TokenTransfer] Transaction sent:', hash);

      // Wait for confirmation
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ 
          hash,
          timeout: 60_000, // 60 seconds timeout
        });
        
        if (receipt.status === 'success') {
          console.log('[TokenTransfer] Transaction confirmed:', receipt);
          return { success: true, txHash: hash };
        } else {
          return { success: false, error: 'Transaction failed', txHash: hash };
        }
      }

      return { success: true, txHash: hash };
    } catch (error: any) {
      console.error('[TokenTransfer] Error:', error);
      
      // Parse common errors
      if (error.message?.includes('rejected')) {
        return { success: false, error: 'Transaction rejected by user' };
      }
      if (error.message?.includes('insufficient')) {
        return { success: false, error: 'Insufficient token balance' };
      }
      
      return { success: false, error: error.message || 'Transfer failed' };
    } finally {
      setIsPending(false);
    }
  }, [walletClient, publicClient]);

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

  return {
    transferToken,
    getTokenBalance,
    isPending,
  };
}
