// Swap Hook - Handles token swaps via SwapRouter
import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAccount } from 'wagmi';
import { getWalletClient } from '@wagmi/core';
import { wagmiConfig } from '@/config/web3modal';
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

// ============= MODULE-LEVEL CACHING =============
// Token decimals cache - permanent (never changes)
const decimalsCache = new Map<string, number>();

// Pool address cache - 5 minute TTL
const poolAddressCache = new Map<string, { address: string; timestamp: number }>();
const POOL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// QuoterV2 validation - once per session
let quoterValidated = false;
let cachedQuoterFactory: string | null = null;
let cachedQuoterWeth9: string | null = null;

// Get cached decimals or fetch from contract
const getCachedDecimals = async (tokenAddress: string, provider: ethers.providers.Provider): Promise<number> => {
  const cached = decimalsCache.get(tokenAddress.toLowerCase());
  if (cached !== undefined) return cached;
  
  try {
    const token = new ethers.Contract(tokenAddress, ['function decimals() view returns (uint8)'], provider);
    const decimals = await token.decimals();
    decimalsCache.set(tokenAddress.toLowerCase(), decimals);
    return decimals;
  } catch {
    return 18; // Fallback
  }
};

// Get cached pool address or fetch from factory
const getCachedPoolAddress = async (
  factory: ethers.Contract,
  token0: string,
  token1: string,
  fee: number
): Promise<string> => {
  const cacheKey = `${token0.toLowerCase()}-${token1.toLowerCase()}-${fee}`;
  const cached = poolAddressCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < POOL_CACHE_TTL) {
    return cached.address;
  }
  
  const poolAddress = await factory.getPool(token0, token1, fee);
  poolAddressCache.set(cacheKey, { address: poolAddress, timestamp: Date.now() });
  return poolAddress;
};

// Validate QuoterV2 once per session
const validateQuoter = async (quoter: ethers.Contract, expectedFactory: string): Promise<{ valid: boolean; error?: string }> => {
  if (quoterValidated && cachedQuoterFactory && cachedQuoterWeth9) {
    // Already validated this session
    if (cachedQuoterFactory.toLowerCase() !== expectedFactory.toLowerCase()) {
      return { valid: false, error: `QuoterV2 uses different Factory!` };
    }
    if (cachedQuoterWeth9.toLowerCase() !== TOKEN_ADDRESSES.WOVER.toLowerCase()) {
      return { valid: false, error: `QuoterV2 uses wrong WETH9 address!` };
    }
    return { valid: true };
  }
  
  try {
    const [quoterFactory, quoterWeth9] = await Promise.all([
      quoter.factory(),
      quoter.WETH9(),
    ]);
    
    cachedQuoterFactory = quoterFactory;
    cachedQuoterWeth9 = quoterWeth9;
    quoterValidated = true;
    
    if (quoterFactory.toLowerCase() !== expectedFactory.toLowerCase()) {
      return { valid: false, error: `QuoterV2 uses different Factory!` };
    }
    if (quoterWeth9.toLowerCase() !== TOKEN_ADDRESSES.WOVER.toLowerCase()) {
      return { valid: false, error: `QuoterV2 uses wrong WETH9 address!` };
    }
    
    return { valid: true };
  } catch (err) {
    logger.warn('Could not validate QuoterV2:', err);
    quoterValidated = true; // Don't retry on error
    return { valid: true }; // Proceed anyway
  }
};

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
  slippageTolerance: number;
  deadline: number;
}

export type SwapStatus = 'idle' | 'quoting' | 'approving' | 'swapping' | 'wrapping' | 'unwrapping' | 'success' | 'error';

const getTokenAddress = (symbol: string): string => {
  const addresses: Record<string, string> = {
    USDT: TOKEN_ADDRESSES.USDT,
    USDC: TOKEN_ADDRESSES.USDC,
    WOVER: TOKEN_ADDRESSES.WOVER,
    OVER: TOKEN_ADDRESSES.WOVER,
  };
  return addresses[symbol] || '';
};

// Helper to decode Error(string) revert reasons
const decodeRevertReason = (errorData: string): string | null => {
  if (!errorData || typeof errorData !== 'string') return null;
  if (errorData.startsWith('0x08c379a0')) {
    try {
      const content = '0x' + errorData.substring(10);
      const decoded = ethers.utils.defaultAbiCoder.decode(['string'], content);
      return decoded[0];
    } catch { return null; }
  }
  if (errorData.startsWith('0x4e487b71')) {
    try {
      const content = '0x' + errorData.substring(10);
      const decoded = ethers.utils.defaultAbiCoder.decode(['uint256'], content);
      return `Panic code: ${decoded[0].toNumber()}`;
    } catch { return null; }
  }
  return null;
};

export const useSwap = () => {
  const { address, isConnected, chainId } = useAccount();
  const isCorrectNetwork = chainId === 54176;
  const [status, setStatus] = useState<SwapStatus>('idle');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // READ provider - uses direct RPC, no wallet needed (faster & more reliable for quotes)
  const getReadProvider = useCallback(() => {
    return new ethers.providers.JsonRpcProvider('https://rpc.overprotocol.com');
  }, []);

  // WRITE provider - uses wallet for signing transactions
  const getWriteProvider = useCallback(async (): Promise<ethers.providers.Web3Provider> => {
    // First try wagmi wallet client (works with Web3Modal + WalletConnect)
    try {
      const client = await getWalletClient(wagmiConfig);
      if (client) {
        return new ethers.providers.Web3Provider(client as any, 'any');
      }
    } catch (e) {
      logger.warn('wagmi wallet client not available:', e);
    }
    
    // Fallback to window.ethereum (direct injected wallets)
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      return new ethers.providers.Web3Provider((window as any).ethereum, 'any');
    }
    
    throw new Error('No wallet provider available. Please connect your wallet.');
  }, []);

  // Get quote for swap - OPTIMIZED with caching
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
    if (!contracts.quoter || !contracts.factory) {
      setError('Contracts not deployed');
      return null;
    }

    setStatus('quoting');
    setError(null);

    try {
      const provider = getReadProvider();
      const tokenIn = getTokenAddress(tokenInSymbol);
      const tokenOut = getTokenAddress(tokenOutSymbol);

      // Sort tokens for pool lookup
      const [token0, token1] = tokenIn.toLowerCase() < tokenOut.toLowerCase()
        ? [tokenIn, tokenOut]
        : [tokenOut, tokenIn];

      const factoryAbi = ['function getPool(address, address, uint24) view returns (address)'];
      const factory = new ethers.Contract(contracts.factory, factoryAbi, provider);
      const quoter = new ethers.Contract(contracts.quoter, QuoterV2ABI.abi, provider);

      // PARALLEL: Fetch pool address (cached), decimals (cached), and validate quoter (once per session)
      const [poolAddress, decimalsIn, decimalsOut, quoterValidation] = await Promise.all([
        getCachedPoolAddress(factory, token0, token1, fee),
        getCachedDecimals(tokenIn, provider),
        getCachedDecimals(tokenOut, provider),
        validateQuoter(quoter, contracts.factory),
      ]);

      // Check quoter validation
      if (!quoterValidation.valid) {
        setError(quoterValidation.error || 'QuoterV2 validation failed');
        setStatus('idle');
        return null;
      }

      // Check if pool exists
      if (poolAddress === ethers.constants.AddressZero) {
        setError(`Pool ${tokenInSymbol}/${tokenOutSymbol} doesn't exist`);
        setStatus('idle');
        return null;
      }

      // Quick liquidity check (single RPC call)
      const poolAbi = ['function liquidity() view returns (uint128)'];
      const pool = new ethers.Contract(poolAddress, poolAbi, provider);
      const liquidity = await pool.liquidity();
      
      if (liquidity.isZero()) {
        setError(`Pool ${tokenInSymbol}/${tokenOutSymbol} has no active liquidity`);
        setStatus('idle');
        return null;
      }

      const amountInWei = ethers.utils.parseUnits(amountIn, decimalsIn);

      // Execute quote
      const params = {
        tokenIn,
        tokenOut,
        amountIn: amountInWei,
        fee,
        sqrtPriceLimitX96: 0,
      };

      const result = await quoter.callStatic.quoteExactInputSingle(params, { gasLimit: 500000 });
      const amountOut = ethers.utils.formatUnits(result.amountOut, decimalsOut);

      // Calculate price impact from sqrtPriceX96After
      let priceImpact = 0;
      if (result.sqrtPriceX96After) {
        try {
          // Get current slot0 for price comparison
          const poolSlot0Abi = ['function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)'];
          const poolForSlot0 = new ethers.Contract(poolAddress, poolSlot0Abi, provider);
          const slot0 = await poolForSlot0.slot0();
          
          const sqrtPriceX96Before = slot0.sqrtPriceX96;
          const sqrtPriceX96After = result.sqrtPriceX96After;
          
          const priceBefore = sqrtPriceX96Before.mul(sqrtPriceX96Before);
          const priceAfter = sqrtPriceX96After.mul(sqrtPriceX96After);
          
          if (!priceBefore.isZero()) {
            const priceDiff = priceAfter.sub(priceBefore).abs();
            const impactBN = priceDiff.mul(10000).div(priceBefore);
            priceImpact = impactBN.toNumber() / 100;
          }
        } catch {
          priceImpact = 0.1; // Default minimal impact
        }
      }

      const swapQuote: SwapQuote = {
        amountOut,
        priceImpact: Math.min(Math.max(priceImpact, 0), 99.99),
        route: `${tokenInSymbol} → ${tokenOutSymbol}`,
        gasEstimate: result.gasEstimate?.toString() || '200000',
      };

      setQuote(swapQuote);
      setStatus('idle');
      return swapQuote;
    } catch (err: any) {
      // Detailed error logging for debugging
      logger.error('=== QUOTE DIAGNOSTIC END - FAILED ===');
      logger.error('Quote error full details:', {
        message: err.message,
        reason: err.reason,
        code: err.code,
        data: err.data,
        errorArgs: err.errorArgs,
        errorName: err.errorName,
        stack: err.stack?.slice(0, 500),
      });
      
      const errorMessage = (err.message || err.reason || '').toLowerCase();
      const errorReason = err.reason || '';
      const errorData = err.data || '';
      
      // === CRITICAL: Try to decode the error data ===
      const decodedReason = decodeRevertReason(errorData);
      if (decodedReason) {
        logger.error('DECODED REVERT REASON:', decodedReason);
        
        // Check for specific decoded messages
        const decodedLower = decodedReason.toLowerCase();
        if (decodedLower.includes('spl') || decodedLower.includes('insufficient')) {
          setError(`Insufficient liquidity: ${decodedReason}`);
        } else if (decodedLower.includes('stf') || decodedLower.includes('transfer failed')) {
          setError(`Token transfer failed: ${decodedReason}`);
        } else {
          setError(`Swap error: ${decodedReason}`);
        }
        setStatus('idle');
        return null;
      }
      
      // Improved error detection with more specific conditions
      const isLiquidityError = 
        errorMessage.includes('spl') ||
        errorMessage.includes('no liquidity') ||
        errorMessage.includes('stf') ||
        errorReason.toLowerCase().includes('spl');
      
      // Empty revert data (0x) often means insufficient liquidity or amount too large
      const isEmptyRevert = errorData === '0x' || 
        errorMessage.includes('transaction reverted without a reason') ||
        errorMessage.includes('missing revert data');
      
      // RPC specific errors
      const isRpcError = err.code === -32603 || errorMessage.includes('-32603');
      
      // CALL_EXCEPTION could be many things
      const isGenericCallException = err.code === 'CALL_EXCEPTION' && !err.reason && !err.errorName;
      
      if (isLiquidityError) {
        setError(`Pool ${tokenInSymbol}/${tokenOutSymbol} has insufficient liquidity. Try a smaller amount.`);
      } else if (isEmptyRevert || isGenericCallException) {
        // Most likely cause: swap amount exceeds available liquidity
        setError(`Cannot quote this amount - pool may have insufficient liquidity. Try a smaller amount (e.g., 0.1 instead of 1).`);
      } else if (isRpcError) {
        // Show decoded error if available, otherwise generic RPC error
        const hexData = errorData ? ` (error data: ${errorData.slice(0, 42)}...)` : '';
        setError(`RPC error${hexData}. Check console for decoded details.`);
      } else {
        // Show actual error message
        const actualError = err.reason || err.errorName || err.message || String(err) || 'Unknown error';
        setError(`Quote failed: ${actualError}`);
      }
      setStatus('idle');
      return null;
    }
  }, [getReadProvider, address]);

  // Check and approve token
  const checkAndApprove = useCallback(async (
    tokenSymbol: string,
    amount: string,
    spender: string
  ): Promise<boolean> => {
    if (!address) return false;

    try {
      const provider = await getWriteProvider();
      const signer = provider.getSigner();
      
      const tokenAddress = getTokenAddress(tokenSymbol);
      const decimals = await getCachedDecimals(tokenAddress, getReadProvider());
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

      const amountWei = ethers.utils.parseUnits(amount, decimals);
      const allowance = await token.allowance(address, spender);

      if (allowance.gte(amountWei)) {
        return true; // Already approved
      }

      setStatus('approving');
      
      const tx = await token.approve(spender, ethers.constants.MaxUint256);
      await tx.wait();
      return true;
    } catch (err: any) {
      logger.error('Approve error:', err);
      setError('Failed to approve token');
      return false;
    }
  }, [address, getWriteProvider, getReadProvider]);

  // Wrap OVER to WOVER with gas estimation and fallback
  const wrapOver = useCallback(async (amount: string): Promise<boolean> => {
    if (!address) return false;

    setStatus('wrapping');
    setError(null);
    setTxHash(null);

    try {
      const provider = await getWriteProvider();
      const signer = provider.getSigner();
      const wover = new ethers.Contract(TOKEN_ADDRESSES.WOVER, WOVER_ABI, signer);
      
      const amountWei = ethers.utils.parseUnits(amount, 18);
      logger.info(`Wrapping ${amount} OVER to WOVER...`);
      
      // Try to estimate gas first
      let gasLimit;
      try {
        const gasEstimate = await wover.estimateGas.deposit({ value: amountWei });
        gasLimit = gasEstimate.mul(150).div(100); // +50% buffer for safety
        logger.info(`Gas estimate for wrap: ${gasEstimate.toString()}, using: ${gasLimit.toString()}`);
      } catch (gasErr) {
        logger.warn('Gas estimation failed, using default:', gasErr);
        gasLimit = ethers.BigNumber.from(100000); // Fallback gas limit
      }
      
      // Try deposit() method first
      try {
        const tx = await wover.deposit({ value: amountWei, gasLimit });
        setTxHash(tx.hash);
        await tx.wait();
        logger.info(`Successfully wrapped ${amount} OVER to WOVER via deposit()`);
        setStatus('success');
        return true;
      } catch (depositErr: any) {
        logger.warn('deposit() failed, trying direct transfer:', depositErr);
        
        // Fallback: Send OVER directly to WOVER contract (triggers receive/fallback)
        const tx = await signer.sendTransaction({
          to: TOKEN_ADDRESSES.WOVER,
          value: amountWei,
          gasLimit: ethers.BigNumber.from(100000),
        });
        setTxHash(tx.hash);
        await tx.wait();
        logger.info(`Successfully wrapped ${amount} OVER to WOVER via direct transfer`);
        setStatus('success');
        return true;
      }
    } catch (err: any) {
      logger.error('Wrap OVER error:', err);
      setError(`Failed to wrap OVER: ${err.reason || err.message}`);
      setStatus('error');
      return false;
    }
  }, [address, getWriteProvider]);

  // Unwrap WOVER to OVER
  const unwrapWover = useCallback(async (amount: string): Promise<boolean> => {
    if (!address) return false;

    setStatus('unwrapping');
    setError(null);
    setTxHash(null);

    try {
      const provider = await getWriteProvider();
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
  }, [address, getWriteProvider]);

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
      const provider = await getWriteProvider();
      const signer = provider.getSigner();
      const readProvider = getReadProvider();

      const tokenIn = getTokenAddress(params.tokenIn);
      const tokenOut = getTokenAddress(params.tokenOut);
      const decimalsIn = await getCachedDecimals(tokenIn, readProvider);
      const decimalsOut = await getCachedDecimals(tokenOut, readProvider);

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
  }, [isConnected, isCorrectNetwork, address, quote, checkAndApprove, getQuote, getWriteProvider, getReadProvider]);

  // Get token balance (supports native OVER and ERC20 tokens with dynamic decimals)
  const getTokenBalance = useCallback(async (tokenSymbol: string): Promise<string> => {
    if (!address) return '0';

    try {
      const provider = getReadProvider();
      
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
  }, [address, getReadProvider]);

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
