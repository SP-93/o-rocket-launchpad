// Liquidity Hook - Handles adding and removing liquidity via PositionManager
import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAccount } from 'wagmi';
import { getWalletClient } from '@wagmi/core';
import { wagmiConfig } from '@/config/web3modal';
import { getDeployedContracts, getDeployedPools } from '@/contracts/storage';
import { TOKEN_ADDRESSES } from '@/config/admin';
import NonfungiblePositionManagerABI from '@/contracts/abis/NonfungiblePositionManager.json';
import UniswapV3FactoryABI from '@/contracts/abis/UniswapV3Factory.json';
import logger from '@/lib/logger';

// MaxUint128 constant
const MAX_UINT128 = ethers.BigNumber.from(2).pow(128).sub(1);

// Standard ERC20 ABI
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

// WOVER (Wrapped OVER) ABI - for wrapping native OVER
const WOVER_ABI = [
  'function deposit() external payable',
  'function withdraw(uint256 amount) external',
  'function balanceOf(address account) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
];

// Pool ABI for reading price
const POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)',
];

export interface Position {
  tokenId: string;
  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  token0Amount: string;
  token1Amount: string;
  feeGrowth0: string;
  feeGrowth1: string;
  tokensOwed0: string;
  tokensOwed1: string;
}

export interface AddLiquidityParams {
  token0Symbol: string;
  token1Symbol: string;
  fee: number;
  amount0: string;
  amount1: string;
  tickLower: number;
  tickUpper: number;
  slippageTolerance: number;
  deadline: number;
}

export interface RemoveLiquidityParams {
  tokenId: string;
  liquidity: string;
  amount0Min: string;
  amount1Min: string;
  deadline: number;
}

export type LiquidityStatus = 'idle' | 'wrapping' | 'approving' | 'adding' | 'removing' | 'collecting' | 'success' | 'error';

const getTokenAddress = (symbol: string): string => {
  const addresses: Record<string, string> = {
    USDT: TOKEN_ADDRESSES.USDT,
    USDC: TOKEN_ADDRESSES.USDC,
    WOVER: TOKEN_ADDRESSES.WOVER,
    OVER: TOKEN_ADDRESSES.WOVER, // OVER uses WOVER address (will be wrapped)
  };
  return addresses[symbol] || '';
};

// Check if token is native OVER (needs wrapping)
const isNativeToken = (symbol: string): boolean => {
  return symbol === 'OVER';
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

const getTokenDecimals = (symbol: string): number => {
  return 18; // Fallback, actual value fetched from contract
};

const getTokenSymbol = (address: string): string => {
  const addressLower = address.toLowerCase();
  if (addressLower === TOKEN_ADDRESSES.USDT.toLowerCase()) return 'USDT';
  if (addressLower === TOKEN_ADDRESSES.USDC.toLowerCase()) return 'USDC';
  if (addressLower === TOKEN_ADDRESSES.WOVER.toLowerCase()) return 'WOVER';
  return 'UNKNOWN';
};

// Sort tokens (Uniswap V3 requires token0 < token1)
const sortTokens = (tokenA: string, tokenB: string): [string, string] => {
  return tokenA.toLowerCase() < tokenB.toLowerCase() 
    ? [tokenA, tokenB] 
    : [tokenB, tokenA];
};

export const useLiquidity = () => {
  const { address, isConnected, chainId } = useAccount();
  const isCorrectNetwork = chainId === 54176;
  const [status, setStatus] = useState<LiquidityStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);

  // READ provider - uses direct RPC, no wallet needed (faster & more reliable)
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

  // Check and approve token
  const checkAndApprove = useCallback(async (
    tokenAddress: string,
    amount: string,
    spender: string,
    decimals: number = 18
  ): Promise<boolean> => {
    if (!address) return false;

    try {
      const provider = await getWriteProvider();
      const signer = provider.getSigner();
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

      const amountWei = ethers.utils.parseUnits(amount, decimals);
      const allowance = await token.allowance(address, spender);

      if (allowance.gte(amountWei)) {
        return true;
      }

      const tx = await token.approve(spender, ethers.constants.MaxUint256);
      await tx.wait();
      return true;
    } catch (err: any) {
      logger.error('Approve error:', err);
      setError(`Failed to approve token: ${err.reason || err.message}`);
      return false;
    }
  }, [address, getWriteProvider]);

  // Wrap native OVER to WOVER
  const wrapOver = useCallback(async (amount: string): Promise<boolean> => {
    if (!address) return false;

    try {
      const provider = await getWriteProvider();
      const signer = provider.getSigner();
      const wover = new ethers.Contract(TOKEN_ADDRESSES.WOVER, WOVER_ABI, signer);
      
      const amountWei = ethers.utils.parseUnits(amount, 18);
      logger.info(`Wrapping ${amount} OVER to WOVER...`);
      
      const tx = await wover.deposit({ value: amountWei });
      await tx.wait();
      
      logger.info(`Successfully wrapped ${amount} OVER to WOVER`);
      return true;
    } catch (err: any) {
      logger.error('Wrap OVER error:', err);
      setError(`Failed to wrap OVER: ${err.reason || err.message}`);
      return false;
    }
  }, [address, getWriteProvider]);

  // Add liquidity (mint new position)
  const addLiquidity = useCallback(async (params: AddLiquidityParams): Promise<string | null> => {
    if (!isConnected || !isCorrectNetwork || !address) {
      setError('Please connect wallet to correct network');
      return null;
    }

    const contracts = getDeployedContracts();
    if (!contracts.positionManager) {
      setError('Position Manager contract not deployed');
      return null;
    }

    setStatus('idle');
    setError(null);
    setTxHash(null);

    try {
      const provider = await getWriteProvider();
      const signer = provider.getSigner();
      const readProvider = getReadProvider();
      // Check if we need to wrap OVER to WOVER
      const needsWrap0 = isNativeToken(params.token0Symbol);
      const needsWrap1 = isNativeToken(params.token1Symbol);

      // Step 0: Wrap OVER if needed
      if (needsWrap0 || needsWrap1) {
        setStatus('wrapping');
        
        if (needsWrap0) {
          const wrapped = await wrapOver(params.amount0);
          if (!wrapped) {
            setStatus('error');
            return null;
          }
        }
        
        if (needsWrap1) {
          const wrapped = await wrapOver(params.amount1);
          if (!wrapped) {
            setStatus('error');
            return null;
          }
        }
      }

      // Use WOVER address for OVER tokens (they've been wrapped now)
      const token0Address = getTokenAddress(params.token0Symbol);
      const token1Address = getTokenAddress(params.token1Symbol);
      
      // Sort tokens
      const [sortedToken0, sortedToken1] = sortTokens(token0Address, token1Address);
      const tokensSwapped = sortedToken0 !== token0Address;
      const [sortedAmount0, sortedAmount1] = tokensSwapped 
        ? [params.amount1, params.amount0]
        : [params.amount0, params.amount1];
      const [sortedSymbol0, sortedSymbol1] = tokensSwapped
        ? [params.token1Symbol, params.token0Symbol]
        : [params.token0Symbol, params.token1Symbol];
      
      // Fix tick bounds when tokens are swapped - negate and swap ticks
      const [sortedTickLower, sortedTickUpper] = tokensSwapped
        ? [-params.tickUpper, -params.tickLower]
        : [params.tickLower, params.tickUpper];
      
      logger.info(`AddLiquidity: tokensSwapped=${tokensSwapped}, tickLower=${sortedTickLower}, tickUpper=${sortedTickUpper}`);

      // Dynamically fetch decimals from contracts
      const decimals0 = await getTokenDecimalsFromContract(sortedToken0, readProvider);
      const decimals1 = await getTokenDecimalsFromContract(sortedToken1, readProvider);
      
      logger.info(`AddLiquidity: ${sortedSymbol0} (${decimals0} decimals) amount=${sortedAmount0}`);
      logger.info(`AddLiquidity: ${sortedSymbol1} (${decimals1} decimals) amount=${sortedAmount1}`);

      // Step 1: Approve token0
      setStatus('approving');
      const approved0 = await checkAndApprove(
        sortedToken0, 
        sortedAmount0, 
        contracts.positionManager,
        decimals0
      );
      if (!approved0) {
        setStatus('error');
        return null;
      }

      // Step 2: Approve token1
      const approved1 = await checkAndApprove(
        sortedToken1, 
        sortedAmount1, 
        contracts.positionManager,
        decimals1
      );
      if (!approved1) {
        setStatus('error');
        return null;
      }

      // Step 3: Verify pool exists before minting
      setStatus('adding');
      
      // Check if pool exists
      const factory = new ethers.Contract(contracts.factory!, UniswapV3FactoryABI.abi, provider);
      const poolAddress = await factory.getPool(sortedToken0, sortedToken1, params.fee);
      
      if (poolAddress === ethers.constants.AddressZero) {
        setError(`Pool does not exist for ${params.token0Symbol}/${params.token1Symbol} with fee ${params.fee / 10000}%. Admin must create the pool first.`);
        setStatus('error');
        return null;
      }
      
      logger.info(`AddLiquidity: Pool found at ${poolAddress}`);
      
      const positionManager = new ethers.Contract(
        contracts.positionManager, 
        NonfungiblePositionManagerABI.abi, 
        signer
      );

      const amount0Wei = ethers.utils.parseUnits(sortedAmount0, decimals0);
      const amount1Wei = ethers.utils.parseUnits(sortedAmount1, decimals1);
      
      logger.info(`AddLiquidity: amount0Wei=${amount0Wei.toString()}, amount1Wei=${amount1Wei.toString()}`);
      
      // Calculate minimum amounts with slippage (e.g., 0.5% slippage = 99.5% of original)
      const slippageBps = Math.floor(params.slippageTolerance * 100); // 0.5% = 50 bps
      const amount0Min = amount0Wei.mul(10000 - slippageBps).div(10000);
      const amount1Min = amount1Wei.mul(10000 - slippageBps).div(10000);
      
      logger.info(`AddLiquidity: slippage=${params.slippageTolerance}%, amount0Min=${amount0Min.toString()}, amount1Min=${amount1Min.toString()}`);

      const deadline = Math.floor(Date.now() / 1000) + params.deadline * 60;

      const mintParams = {
        token0: sortedToken0,
        token1: sortedToken1,
        fee: params.fee,
        tickLower: sortedTickLower,
        tickUpper: sortedTickUpper,
        amount0Desired: amount0Wei,
        amount1Desired: amount1Wei,
        amount0Min,
        amount1Min,
        recipient: address,
        deadline,
      };

      const tx = await positionManager.mint(mintParams);
      setTxHash(tx.hash);

      const receipt = await tx.wait();
      
      // Get tokenId from event
      const mintEvent = receipt.events?.find((e: any) => e.event === 'IncreaseLiquidity');
      const tokenId = mintEvent?.args?.tokenId?.toString();

      setStatus('success');
      return tokenId || null;
    } catch (err: any) {
      logger.error('Add liquidity error:', err);
      setError(err.reason || err.message || 'Failed to add liquidity');
      setStatus('error');
      return null;
    }
  }, [isConnected, isCorrectNetwork, address, checkAndApprove, getWriteProvider, getReadProvider, wrapOver]);

  // Remove liquidity using multicall (decrease + collect + burn in 1 transaction = 1 signature!)
  const removeLiquidity = useCallback(async (
    tokenId: string,
    percentageToRemove: number = 100
  ): Promise<boolean> => {
    if (!isConnected || !isCorrectNetwork || !address) {
      setError('Please connect wallet to correct network');
      return false;
    }

    const contracts = getDeployedContracts();
    if (!contracts.positionManager) {
      setError('Position Manager contract not deployed');
      return false;
    }

    setStatus('removing');
    setError(null);
    setTxHash(null);

    try {
      const provider = await getWriteProvider();
      const signer = provider.getSigner();
      
      const positionManager = new ethers.Contract(
        contracts.positionManager,
        NonfungiblePositionManagerABI.abi,
        signer
      );

      // Get position info
      const position = await positionManager.positions(tokenId);
      const liquidity = position.liquidity;
      
      if (liquidity.isZero()) {
        setError('Position has no liquidity');
        setStatus('error');
        return false;
      }

      const liquidityToRemove = liquidity.mul(percentageToRemove).div(100);
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60; // 20 minutes

      // Encode all operations for multicall
      const decreaseData = positionManager.interface.encodeFunctionData('decreaseLiquidity', [{
        tokenId,
        liquidity: liquidityToRemove,
        amount0Min: 0,
        amount1Min: 0,
        deadline,
      }]);

      const collectData = positionManager.interface.encodeFunctionData('collect', [{
        tokenId,
        recipient: address,
        amount0Max: MAX_UINT128,
        amount1Max: MAX_UINT128,
      }]);

      // Build multicall array
      const multicallData = [decreaseData, collectData];

      // Only burn if removing 100%
      if (percentageToRemove === 100) {
        const burnData = positionManager.interface.encodeFunctionData('burn', [tokenId]);
        multicallData.push(burnData);
      }

      logger.info(`Remove liquidity: Using multicall with ${multicallData.length} operations (1 signature)`);

      // Execute ALL in single multicall transaction (1 signature!)
      const tx = await positionManager.multicall(multicallData);
      setTxHash(tx.hash);
      await tx.wait();

      setStatus('success');
      return true;
    } catch (err: any) {
      logger.error('Remove liquidity error:', err);
      setError(err.reason || err.message || 'Failed to remove liquidity');
      setStatus('error');
      return false;
    }
  }, [isConnected, isCorrectNetwork, address, getWriteProvider]);

  // Collect fees only (without removing liquidity)
  const collectFees = useCallback(async (tokenId: string): Promise<boolean> => {
    if (!isConnected || !isCorrectNetwork || !address) {
      setError('Please connect wallet to correct network');
      return false;
    }

    const contracts = getDeployedContracts();
    if (!contracts.positionManager) {
      setError('Position Manager contract not deployed');
      return false;
    }

    setStatus('collecting');
    setError(null);
    setTxHash(null);

    try {
      const provider = await getWriteProvider();
      const signer = provider.getSigner();
      
      const positionManager = new ethers.Contract(
        contracts.positionManager,
        NonfungiblePositionManagerABI.abi,
        signer
      );

      const collectParams = {
        tokenId,
        recipient: address,
        amount0Max: MAX_UINT128,
        amount1Max: MAX_UINT128,
      };

      const tx = await positionManager.collect(collectParams);
      setTxHash(tx.hash);
      await tx.wait();

      setStatus('success');
      return true;
    } catch (err: any) {
      logger.error('Collect fees error:', err);
      setError(err.reason || err.message || 'Failed to collect fees');
      setStatus('error');
      return false;
    }
  }, [isConnected, isCorrectNetwork, address, getWriteProvider]);


  // Fetch user positions
  const fetchPositions = useCallback(async (): Promise<Position[]> => {
    if (!isConnected || !address) {
      setPositions([]);
      return [];
    }

    const contracts = getDeployedContracts();

    if (!contracts.positionManager) {
      logger.error('No PositionManager address configured');
      return [];
    }

    const provider = getReadProvider();
    const positionManager = new ethers.Contract(
      contracts.positionManager,
      NonfungiblePositionManagerABI.abi,
      provider
    );

    // Get balance
    let positionCount = 0;
    try {
      const balance = await positionManager.balanceOf(address);
      positionCount = balance.toNumber();
    } catch (err: any) {
      logger.error('Failed to get position balance:', err.message);
      return [];
    }

    if (positionCount === 0) {
      setPositions([]);
      return [];
    }

    // Fetch each position
    const userPositions: Position[] = [];

    for (let i = 0; i < positionCount; i++) {
      // Get tokenId
      let tokenId: ethers.BigNumber;
      try {
        tokenId = await positionManager.tokenOfOwnerByIndex(address, i);
      } catch (err: any) {
        logger.error(`tokenOfOwnerByIndex(${i}) failed:`, err.message);
        continue;
      }

      // Get position details
      let position: any;
      try {
        position = await positionManager.positions(tokenId);
      } catch (err: any) {
        logger.error(`positions(${tokenId}) failed:`, err.message);
        continue;
      }

      // Get decimals
      let decimals0 = 18, decimals1 = 18;
      try {
        decimals0 = await getTokenDecimalsFromContract(position.token0, provider);
        decimals1 = await getTokenDecimalsFromContract(position.token1, provider);
      } catch {
        // Use defaults
      }

      userPositions.push({
        tokenId: tokenId.toString(),
        token0: getTokenSymbol(position.token0),
        token1: getTokenSymbol(position.token1),
        fee: position.fee,
        tickLower: position.tickLower,
        tickUpper: position.tickUpper,
        liquidity: position.liquidity.toString(),
        token0Amount: '0',
        token1Amount: '0',
        feeGrowth0: position.feeGrowthInside0LastX128.toString(),
        feeGrowth1: position.feeGrowthInside1LastX128.toString(),
        tokensOwed0: ethers.utils.formatUnits(position.tokensOwed0, decimals0),
        tokensOwed1: ethers.utils.formatUnits(position.tokensOwed1, decimals1),
      });
    }

    setPositions(userPositions);
    setPositions(userPositions);
    return userPositions;
  }, [isConnected, address, getReadProvider]);

  // Get token balance (supports both ERC20 and native OVER with dynamic decimals)
  const getTokenBalance = useCallback(async (tokenSymbol: string): Promise<string> => {
    if (!address) {
      logger.info(`getTokenBalance: No address connected`);
      return '0';
    }

    try {
      const provider = getReadProvider();
      
      // Handle native OVER balance
      if (tokenSymbol === 'OVER') {
        const balance = await provider.getBalance(address);
        const formatted = ethers.utils.formatUnits(balance, 18);
        logger.info(`getTokenBalance: OVER (native) balance = ${formatted}`);
        return formatted;
      }
      
      const tokenAddress = getTokenAddress(tokenSymbol);
      
      // Validate token address exists
      if (!tokenAddress) {
        logger.error(`getTokenBalance: Token address not found for symbol: ${tokenSymbol}`);
        logger.info(`Available tokens: USDT, USDC, WOVER, OVER`);
        return '0';
      }
      
      logger.info(`getTokenBalance: Fetching ${tokenSymbol} balance at ${tokenAddress} for ${address}`);
      
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      
      // Get decimals dynamically from contract
      const decimals = await token.decimals();
      const balance = await token.balanceOf(address);
      const formatted = ethers.utils.formatUnits(balance, decimals);
      
      logger.info(`getTokenBalance: ${tokenSymbol} balance = ${formatted} (${decimals} decimals)`);
      return formatted;
    } catch (err: any) {
      logger.error(`getTokenBalance error for ${tokenSymbol}:`, err?.message || err);
      return '0';
    }
  }, [address, getReadProvider]);

  // Get current pool price (adjusted for token decimals)
  const getPoolPrice = useCallback(async (
    token0Symbol: string,
    token1Symbol: string,
    fee: number = 3000
  ): Promise<number | null> => {
    const contracts = getDeployedContracts();
    if (!contracts.factory) return null;

    try {
      const provider = getReadProvider();
      const factory = new ethers.Contract(contracts.factory, UniswapV3FactoryABI.abi, provider);

      const token0Address = getTokenAddress(token0Symbol === 'OVER' ? 'WOVER' : token0Symbol);
      const token1Address = getTokenAddress(token1Symbol === 'OVER' ? 'WOVER' : token1Symbol);
      const [sortedToken0, sortedToken1] = sortTokens(token0Address, token1Address);

      const poolAddress = await factory.getPool(sortedToken0, sortedToken1, fee);
      
      if (poolAddress === ethers.constants.AddressZero) {
        logger.info(`Pool does not exist for ${token0Symbol}/${token1Symbol} with fee ${fee}`);
        return null;
      }

      const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
      const slot0 = await pool.slot0();
      
      const sqrtPriceX96 = slot0.sqrtPriceX96;
      
      // Fetch decimals for both tokens
      const decimals0 = await getTokenDecimalsFromContract(sortedToken0, provider);
      const decimals1 = await getTokenDecimalsFromContract(sortedToken1, provider);
      
      // Calculate raw price from sqrtPriceX96
      const rawPrice = (Number(sqrtPriceX96) / (2 ** 96)) ** 2;
      
      // Adjust for decimal difference between tokens
      // rawPrice = token1/token0 in raw units, need to adjust for decimals
      const decimalAdjustment = Math.pow(10, decimals0 - decimals1);
      const adjustedPrice = rawPrice * decimalAdjustment;
      
      logger.info(`Pool price: raw=${rawPrice}, decimals0=${decimals0}, decimals1=${decimals1}, adjusted=${adjustedPrice}`);

      // Adjust if input token order was swapped during sorting
      const finalPrice = sortedToken0 === token0Address ? adjustedPrice : 1 / adjustedPrice;
      logger.info(`Final price for ${token0Symbol}/${token1Symbol}: ${finalPrice}`);
      
      return finalPrice;
    } catch (err) {
      logger.error('Pool price error:', err);
      return null;
    }
  }, [getReadProvider]);

  // Get Pool TVL (Total Value Locked) in USD
  const getPoolTVL = useCallback(async (
    token0Symbol: string,
    token1Symbol: string,
    fee: number = 3000,
    overPriceUSD: number = 0
  ): Promise<{
    token0Balance: string;
    token1Balance: string;
    tvlUSD: number;
    poolAddress: string;
  } | null> => {
    const contracts = getDeployedContracts();
    if (!contracts.factory) return null;

    try {
      const provider = getReadProvider();
      const factory = new ethers.Contract(contracts.factory, UniswapV3FactoryABI.abi, provider);

      const token0Address = getTokenAddress(token0Symbol === 'OVER' ? 'WOVER' : token0Symbol);
      const token1Address = getTokenAddress(token1Symbol === 'OVER' ? 'WOVER' : token1Symbol);
      const [sortedToken0, sortedToken1] = sortTokens(token0Address, token1Address);

      const poolAddress = await factory.getPool(sortedToken0, sortedToken1, fee);
      
      if (poolAddress === ethers.constants.AddressZero) {
        return null;
      }

      // Get token balances in pool
      const token0Contract = new ethers.Contract(sortedToken0, ERC20_ABI, provider);
      const token1Contract = new ethers.Contract(sortedToken1, ERC20_ABI, provider);

      const [balance0, balance1, decimals0, decimals1] = await Promise.all([
        token0Contract.balanceOf(poolAddress),
        token1Contract.balanceOf(poolAddress),
        getTokenDecimalsFromContract(sortedToken0, provider),
        getTokenDecimalsFromContract(sortedToken1, provider),
      ]);

      const formattedBalance0 = parseFloat(ethers.utils.formatUnits(balance0, decimals0));
      const formattedBalance1 = parseFloat(ethers.utils.formatUnits(balance1, decimals1));

      // Get token symbols for sorted addresses
      const sortedSymbol0 = getTokenSymbol(sortedToken0);
      const sortedSymbol1 = getTokenSymbol(sortedToken1);

      // Calculate USD value
      // USDT/USDC = $1.00, WOVER = CoinGecko price
      const getTokenPriceUSD = (symbol: string): number => {
        if (symbol === 'USDT' || symbol === 'USDC') return 1;
        if (symbol === 'WOVER') return overPriceUSD;
        return 0;
      };

      const value0USD = formattedBalance0 * getTokenPriceUSD(sortedSymbol0);
      const value1USD = formattedBalance1 * getTokenPriceUSD(sortedSymbol1);
      const tvlUSD = value0USD + value1USD;

      // Return in original token order
      const tokensSwapped = sortedToken0 !== token0Address;
      
      return {
        token0Balance: tokensSwapped ? formattedBalance1.toFixed(4) : formattedBalance0.toFixed(4),
        token1Balance: tokensSwapped ? formattedBalance0.toFixed(4) : formattedBalance1.toFixed(4),
        tvlUSD,
        poolAddress,
      };
    } catch (err) {
      logger.error('Pool TVL error:', err);
      return null;
    }
  }, [getReadProvider]);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setTxHash(null);
  }, []);

  return {
    status,
    error,
    txHash,
    positions,
    addLiquidity,
    removeLiquidity,
    collectFees,
    fetchPositions,
    getTokenBalance,
    getPoolPrice,
    getPoolTVL,
    reset,
  };
};
