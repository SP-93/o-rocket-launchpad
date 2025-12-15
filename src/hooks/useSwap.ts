// Swap Hook - Handles token swaps via SwapRouter
import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './useWallet';
import { getDeployedContracts } from '@/contracts/storage';
import { TOKEN_ADDRESSES } from '@/config/admin';
import SwapRouterABI from '@/contracts/abis/SwapRouter.json';
import QuoterV2ABI from '@/contracts/abis/QuoterV2.json';
import logger from '@/lib/logger';

// Standard ERC20 ABI for approve and balanceOf
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
];

// WOVER ABI for wrapping/unwrapping
const WOVER_ABI = [
  'function deposit() external payable',
  'function withdraw(uint256 amount) external',
  'function balanceOf(address account) external view returns (uint256)',
];

export interface SwapQuote {
  amountOut: string;
  priceImpact: number;
  route: string;
  gasEstimate: string;
}

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippageTolerance: number; // in percentage, e.g., 0.5 for 0.5%
  deadline: number; // in minutes
}

export type SwapStatus = 'idle' | 'quoting' | 'approving' | 'swapping' | 'wrapping' | 'unwrapping' | 'success' | 'error';

const getTokenAddress = (symbol: string): string => {
  const addresses: Record<string, string> = {
    USDT: TOKEN_ADDRESSES.USDT,
    USDC: TOKEN_ADDRESSES.USDC,
    WOVER: TOKEN_ADDRESSES.WOVER,
    OVER: TOKEN_ADDRESSES.WOVER, // Use WOVER address for OVER
  };
  return addresses[symbol] || '';
};

// Dynamic decimals fetching from contract
const getTokenDecimalsFromContract = async (tokenAddress: string, provider: ethers.providers.Web3Provider): Promise<number> => {
  try {
    const token = new ethers.Contract(tokenAddress, ['function decimals() view returns (uint8)'], provider);
    const decimals = await token.decimals();
    return decimals;
  } catch {
    return 18; // Fallback
  }
};

export const useSwap = () => {
  const { address, isConnected, isCorrectNetwork } = useWallet();
  const [status, setStatus] = useState<SwapStatus>('idle');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Get quote for swap
  const getQuote = useCallback(async (
    tokenInSymbol: string,
    tokenOutSymbol: string,
    amountIn: string,
    fee: number = 3000
  ): Promise<SwapQuote | null> => {
    if (!amountIn || parseFloat(amountIn) === 0) {
      setQuote(null);
      return null;
    }

    const contracts = getDeployedContracts();
    if (!contracts.quoter) {
      setError('Quoter contract not deployed');
      return null;
    }

    setStatus('quoting');
    setError(null);

    try {
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const quoter = new ethers.Contract(contracts.quoter, QuoterV2ABI.abi, provider);

      const tokenIn = getTokenAddress(tokenInSymbol);
      const tokenOut = getTokenAddress(tokenOutSymbol);
      
      // Get decimals dynamically
      const decimalsIn = await getTokenDecimalsFromContract(tokenIn, provider);
      const decimalsOut = await getTokenDecimalsFromContract(tokenOut, provider);

      const amountInWei = ethers.utils.parseUnits(amountIn, decimalsIn);

      // Use quoteExactInputSingle
      const params = {
        tokenIn,
        tokenOut,
        amountIn: amountInWei,
        fee,
        sqrtPriceLimitX96: 0,
      };

      const result = await quoter.callStatic.quoteExactInputSingle(params);
      const amountOut = ethers.utils.formatUnits(result.amountOut, decimalsOut);

      // Calculate price impact (simplified)
      const priceImpact = Math.abs(parseFloat(amountIn) - parseFloat(amountOut)) / parseFloat(amountIn) * 100;

      const swapQuote: SwapQuote = {
        amountOut,
        priceImpact: Math.min(priceImpact, 100),
        route: `${tokenInSymbol} → ${tokenOutSymbol}`,
        gasEstimate: result.gasEstimate?.toString() || '200000',
      };

      setQuote(swapQuote);
      setStatus('idle');
      return swapQuote;
    } catch (err: any) {
      logger.error('Quote error:', err);
      setError('Failed to get quote. Pool may not have enough liquidity.');
      setStatus('error');
      return null;
    }
  }, []);

  // Check and approve token
  const checkAndApprove = useCallback(async (
    tokenSymbol: string,
    amount: string,
    spender: string
  ): Promise<boolean> => {
    if (!address) return false;

    const provider = new ethers.providers.Web3Provider((window as any).ethereum);
    const signer = provider.getSigner();
    
    const tokenAddress = getTokenAddress(tokenSymbol);
    const decimals = await getTokenDecimalsFromContract(tokenAddress, provider);
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

    const amountWei = ethers.utils.parseUnits(amount, decimals);
    const allowance = await token.allowance(address, spender);

    if (allowance.gte(amountWei)) {
      return true; // Already approved
    }

    setStatus('approving');
    
    try {
      const tx = await token.approve(spender, ethers.constants.MaxUint256);
      await tx.wait();
      return true;
    } catch (err: any) {
      logger.error('Approve error:', err);
      setError('Failed to approve token');
      return false;
    }
  }, [address]);

  // Wrap OVER to WOVER
  const wrapOver = useCallback(async (amount: string): Promise<boolean> => {
    if (!address) return false;

    setStatus('wrapping');
    setError(null);
    setTxHash(null);

    try {
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();
      const wover = new ethers.Contract(TOKEN_ADDRESSES.WOVER, WOVER_ABI, signer);
      
      const amountWei = ethers.utils.parseUnits(amount, 18);
      logger.info(`Wrapping ${amount} OVER to WOVER...`);
      
      const tx = await wover.deposit({ value: amountWei });
      setTxHash(tx.hash);
      await tx.wait();
      
      logger.info(`Successfully wrapped ${amount} OVER to WOVER`);
      setStatus('success');
      return true;
    } catch (err: any) {
      logger.error('Wrap OVER error:', err);
      setError(`Failed to wrap OVER: ${err.reason || err.message}`);
      setStatus('error');
      return false;
    }
  }, [address]);

  // Unwrap WOVER to OVER
  const unwrapWover = useCallback(async (amount: string): Promise<boolean> => {
    if (!address) return false;

    setStatus('unwrapping');
    setError(null);
    setTxHash(null);

    try {
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();
      const wover = new ethers.Contract(TOKEN_ADDRESSES.WOVER, WOVER_ABI, signer);
      
      const amountWei = ethers.utils.parseUnits(amount, 18);
      logger.info(`Unwrapping ${amount} WOVER to OVER...`);
      
      const tx = await wover.withdraw(amountWei);
      setTxHash(tx.hash);
      await tx.wait();
      
      logger.info(`Successfully unwrapped ${amount} WOVER to OVER`);
      setStatus('success');
      return true;
    } catch (err: any) {
      logger.error('Unwrap WOVER error:', err);
      setError(`Failed to unwrap WOVER: ${err.reason || err.message}`);
      setStatus('error');
      return false;
    }
  }, [address]);

  // Execute swap
  const executeSwap = useCallback(async (params: SwapParams): Promise<boolean> => {
    if (!isConnected || !isCorrectNetwork || !address) {
      setError('Please connect wallet to correct network');
      return false;
    }

    const contracts = getDeployedContracts();
    if (!contracts.router) {
      setError('Router contract not deployed');
      return false;
    }

    setStatus('idle');
    setError(null);
    setTxHash(null);

    try {
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();

      const tokenIn = getTokenAddress(params.tokenIn);
      const tokenOut = getTokenAddress(params.tokenOut);
      const decimalsIn = await getTokenDecimalsFromContract(tokenIn, provider);
      const decimalsOut = await getTokenDecimalsFromContract(tokenOut, provider);

      // Step 1: Approve token
      const approved = await checkAndApprove(params.tokenIn, params.amountIn, contracts.router);
      if (!approved) {
        setStatus('error');
        return false;
      }

      // Step 2: Execute swap
      setStatus('swapping');

      const router = new ethers.Contract(contracts.router, SwapRouterABI.abi, signer);
      const amountInWei = ethers.utils.parseUnits(params.amountIn, decimalsIn);
      
      // Calculate minimum amount out with slippage
      const currentQuote = quote || await getQuote(params.tokenIn, params.tokenOut, params.amountIn);
      if (!currentQuote) {
        setError('Could not get quote');
        setStatus('error');
        return false;
      }

      const minAmountOut = ethers.utils.parseUnits(
        (parseFloat(currentQuote.amountOut) * (1 - params.slippageTolerance / 100)).toFixed(decimalsOut),
        decimalsOut
      );

      const deadline = Math.floor(Date.now() / 1000) + params.deadline * 60;

      const swapParams = {
        tokenIn,
        tokenOut,
        fee: 3000, // 0.3%
        recipient: address,
        deadline,
        amountIn: amountInWei,
        amountOutMinimum: minAmountOut,
        sqrtPriceLimitX96: 0,
      };

      const tx = await router.exactInputSingle(swapParams);
      setTxHash(tx.hash);

      await tx.wait();
      
      setStatus('success');
      return true;
    } catch (err: any) {
      logger.error('Swap error:', err);
      setError(err.reason || err.message || 'Swap failed');
      setStatus('error');
      return false;
    }
  }, [isConnected, isCorrectNetwork, address, quote, checkAndApprove, getQuote]);

  // Get token balance (supports native OVER and ERC20 tokens with dynamic decimals)
  const getTokenBalance = useCallback(async (tokenSymbol: string): Promise<string> => {
    if (!address) return '0';

    try {
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      
      // Handle native OVER balance
      if (tokenSymbol === 'OVER') {
        const balance = await provider.getBalance(address);
        return ethers.utils.formatUnits(balance, 18);
      }
      
      const tokenAddress = getTokenAddress(tokenSymbol);
      if (!tokenAddress) return '0';
      
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      
      // Get decimals dynamically from contract
      const decimals = await token.decimals();
      const balance = await token.balanceOf(address);
      
      return ethers.utils.formatUnits(balance, decimals);
    } catch (err) {
      logger.error('Balance error:', err);
      return '0';
    }
  }, [address]);

  const reset = useCallback(() => {
    setStatus('idle');
    setQuote(null);
    setError(null);
    setTxHash(null);
  }, []);

  return {
    status,
    quote,
    error,
    txHash,
    getQuote,
    executeSwap,
    getTokenBalance,
    wrapOver,
    unwrapWover,
    reset,
  };
};
