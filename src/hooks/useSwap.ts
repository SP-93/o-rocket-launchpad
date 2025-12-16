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
const getTokenDecimalsFromContract = async (tokenAddress: string, provider: ethers.providers.Provider): Promise<number> => {
  try {
    const token = new ethers.Contract(tokenAddress, ['function decimals() view returns (uint8)'], provider);
    const decimals = await token.decimals();
    return decimals;
  } catch {
    return 18; // Fallback
  }
};

// Helper to decode Error(string) revert reasons from 0x08c379a0 data
const decodeRevertReason = (errorData: string): string | null => {
  if (!errorData || typeof errorData !== 'string') return null;
  
  // 0x08c379a0 is the signature for Error(string)
  if (errorData.startsWith('0x08c379a0')) {
    try {
      // Remove the 0x08c379a0 prefix (10 chars) to get just the encoded string
      const content = '0x' + errorData.substring(10);
      const decoded = ethers.utils.defaultAbiCoder.decode(['string'], content);
      return decoded[0];
    } catch (decodeErr) {
      logger.warn('Failed to decode revert reason:', decodeErr);
      return null;
    }
  }
  
  // 0x4e487b71 is Panic(uint256) - arithmetic errors
  if (errorData.startsWith('0x4e487b71')) {
    try {
      const content = '0x' + errorData.substring(10);
      const decoded = ethers.utils.defaultAbiCoder.decode(['uint256'], content);
      const panicCode = decoded[0].toNumber();
      const panicMessages: Record<number, string> = {
        0x00: 'Generic panic',
        0x01: 'Assertion failed',
        0x11: 'Arithmetic overflow/underflow',
        0x12: 'Division by zero',
        0x21: 'Invalid enum value',
        0x22: 'Storage byte array encoding',
        0x31: 'Empty array pop',
        0x32: 'Array out of bounds',
        0x41: 'Memory allocation failure',
        0x51: 'Zero-initialized function pointer',
      };
      return panicMessages[panicCode] || `Panic code: ${panicCode}`;
    } catch {
      return 'Panic error (decode failed)';
    }
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

  // Get quote for swap with pool existence validation
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

    if (!contracts.factory) {
      setError('Factory contract not deployed');
      return null;
    }

    setStatus('quoting');
    setError(null);

    try {
      // Use READ provider for quotes (no wallet needed!)
      const provider = getReadProvider();

      const tokenIn = getTokenAddress(tokenInSymbol);
      const tokenOut = getTokenAddress(tokenOutSymbol);

      // Factory.getPool expects token0 < token1 (sorted)
      const [token0, token1] = tokenIn.toLowerCase() < tokenOut.toLowerCase()
        ? [tokenIn, tokenOut]
        : [tokenOut, tokenIn];

      // Check if pool exists first
      const factoryAbi = ['function getPool(address, address, uint24) view returns (address)'];
      const factory = new ethers.Contract(contracts.factory, factoryAbi, provider);
      const poolAddress = await factory.getPool(token0, token1, fee);
      
      if (poolAddress === ethers.constants.AddressZero) {
        // Build list of available pools
        const availablePools: string[] = [];
        const tokenPairs = [
          ['WOVER', 'USDT'],
          ['WOVER', 'USDC'],
          ['USDT', 'USDC'],
        ];
        
        for (const [t0, t1] of tokenPairs) {
          const addr0 = getTokenAddress(t0);
          const addr1 = getTokenAddress(t1);
          const [p0, p1] = addr0.toLowerCase() < addr1.toLowerCase() ? [addr0, addr1] : [addr1, addr0];
          const pool = await factory.getPool(p0, p1, fee);
          if (pool !== ethers.constants.AddressZero) {
            availablePools.push(`${t0}/${t1}`);
          }
        }
        
        const availableMsg = availablePools.length > 0 
          ? `Available pools: ${availablePools.join(', ')}`
          : 'No pools available yet';
          
        setError(`Pool ${tokenInSymbol}/${tokenOutSymbol} doesn't exist. ${availableMsg}`);
        setStatus('idle');
        return null;
      }

      const quoter = new ethers.Contract(contracts.quoter, QuoterV2ABI.abi, provider);
      
      // === DIAGNOSTIC LOGGING START ===
      logger.info('=== QUOTE DIAGNOSTIC START ===');
      logger.info('Contract addresses:', {
        quoter: contracts.quoter,
        factory: contracts.factory,
        router: contracts.router,
      });
      logger.info('Token info:', {
        tokenIn,
        tokenOut,
        tokenInSymbol,
        tokenOutSymbol,
      });
      logger.info('Pool found:', {
        poolAddress,
        fee,
      });

      // Check if QuoterV2 points to correct Factory
      const quoterFactory = await quoter.factory();
      logger.info('QuoterV2 Factory validation:', {
        quoterPointsTo: quoterFactory,
        ourFactory: contracts.factory,
        match: quoterFactory.toLowerCase() === contracts.factory.toLowerCase(),
      });

      // Validate Factory match - this is critical!
      if (quoterFactory.toLowerCase() !== contracts.factory.toLowerCase()) {
        const errorMsg = `QuoterV2 uses different Factory! QuoterV2 → ${quoterFactory.slice(0, 10)}... but our Factory is ${contracts.factory.slice(0, 10)}...`;
        logger.error(errorMsg);
        setError(errorMsg);
        setStatus('idle');
        return null;
      }

      // === CRITICAL: Check QuoterV2.WETH9() address ===
      let quoterWeth9: string;
      try {
        quoterWeth9 = await quoter.WETH9();
        logger.info('QuoterV2 WETH9 validation:', {
          quoterWeth9,
          expectedWeth9: TOKEN_ADDRESSES.WOVER,
          match: quoterWeth9.toLowerCase() === TOKEN_ADDRESSES.WOVER.toLowerCase(),
        });

        if (quoterWeth9.toLowerCase() !== TOKEN_ADDRESSES.WOVER.toLowerCase()) {
          logger.error('CRITICAL: QuoterV2 WETH9 mismatch!', {
            quoterWeth9,
            expectedWover: TOKEN_ADDRESSES.WOVER,
          });
          setError(`QuoterV2 uses wrong WETH9 address! Expected WOVER (${TOKEN_ADDRESSES.WOVER.slice(0, 10)}...) but got ${quoterWeth9.slice(0, 10)}... - Contract may need redeployment.`);
          setStatus('idle');
          return null;
        }
      } catch (weth9Err) {
        logger.warn('Could not verify QuoterV2.WETH9() - proceeding anyway:', weth9Err);
      }

      // Verify pool data from slot0
      const poolAbi = [
        'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
        'function token0() view returns (address)',
        'function token1() view returns (address)',
        'function fee() view returns (uint24)',
        'function liquidity() view returns (uint128)',
      ];
      const pool = new ethers.Contract(poolAddress, poolAbi, provider);
      
      let poolLiquidity: ethers.BigNumber | null = null;
      try {
        const [slot0, poolToken0, poolToken1, poolFee, liquidity] = await Promise.all([
          pool.slot0(),
          pool.token0(),
          pool.token1(),
          pool.fee(),
          pool.liquidity(),
        ]);
        
        poolLiquidity = liquidity;
        
        logger.info('Pool slot0 data:', {
          sqrtPriceX96: slot0.sqrtPriceX96.toString(),
          tick: slot0.tick,
          unlocked: slot0.unlocked,
        });
        logger.info('Pool tokens and fee:', {
          token0: poolToken0,
          token1: poolToken1,
          fee: poolFee,
          liquidity: liquidity.toString(),
        });
        
        // Verify token order matches expectation
        const tokenInIsToken0 = tokenIn.toLowerCase() === poolToken0.toLowerCase();
        const tokenInIsToken1 = tokenIn.toLowerCase() === poolToken1.toLowerCase();
        logger.info('Token direction:', {
          tokenInIsToken0,
          tokenInIsToken1,
          swapDirection: tokenInIsToken0 ? 'token0 → token1' : 'token1 → token0',
        });
        
        // Check for zero or very low liquidity
        if (liquidity.isZero()) {
          logger.error('Pool has ZERO active liquidity at current tick!');
          setError(`Pool ${tokenInSymbol}/${tokenOutSymbol} has no active liquidity at current price. The pool may exist but liquidity is out of range.`);
          setStatus('idle');
          return null;
        }
      } catch (poolErr) {
        logger.error('Failed to read pool data:', poolErr);
      }
      // === DIAGNOSTIC LOGGING END ===

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

      logger.info('Calling quoteExactInputSingle with params:', {
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn.toString(),
        fee: params.fee,
        sqrtPriceLimitX96: params.sqrtPriceLimitX96,
      });

      // Wrap quote call in detailed try-catch with explicit gas limit
      let result;
      try {
        // CRITICAL: Add explicit gasLimit - OverProtocol RPC requires this for callStatic
        result = await quoter.callStatic.quoteExactInputSingle(params, {
          gasLimit: 500000,
        });
        logger.info('Quote SUCCESS:', {
          amountOut: result.amountOut.toString(),
          sqrtPriceX96After: result.sqrtPriceX96After?.toString(),
          initializedTicksCrossed: result.initializedTicksCrossed?.toString(),
          gasEstimate: result.gasEstimate?.toString(),
        });
      } catch (quoteErr: any) {
        logger.error('quoteExactInputSingle FAILED:', {
          error: quoteErr,
          errorString: String(quoteErr),
          reason: quoteErr.reason,
          code: quoteErr.code,
          data: quoteErr.data,
          errorArgs: quoteErr.errorArgs,
          errorName: quoteErr.errorName,
        });
        throw quoteErr; // Re-throw for outer catch
      }

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
      logger.info('=== QUOTE DIAGNOSTIC END - SUCCESS ===');
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
      const decimals = await getTokenDecimalsFromContract(tokenAddress, getReadProvider());
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
      const decimalsIn = await getTokenDecimalsFromContract(tokenIn, readProvider);
      const decimalsOut = await getTokenDecimalsFromContract(tokenOut, readProvider);

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
