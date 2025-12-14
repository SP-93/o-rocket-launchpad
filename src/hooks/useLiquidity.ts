// Liquidity Hook - Handles adding and removing liquidity via PositionManager
import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './useWallet';
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

export type LiquidityStatus = 'idle' | 'approving' | 'adding' | 'removing' | 'collecting' | 'success' | 'error';

const getTokenAddress = (symbol: string): string => {
  const addresses: Record<string, string> = {
    USDT: TOKEN_ADDRESSES.USDT,
    USDC: TOKEN_ADDRESSES.USDC,
    WOVER: TOKEN_ADDRESSES.WOVER,
  };
  return addresses[symbol] || '';
};

const getTokenDecimals = (symbol: string): number => {
  return 18; // All tokens on OverProtocol use 18 decimals
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
  const { address, isConnected, isCorrectNetwork } = useWallet();
  const [status, setStatus] = useState<LiquidityStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);

  // Check and approve token
  const checkAndApprove = useCallback(async (
    tokenAddress: string,
    amount: string,
    spender: string,
    decimals: number = 18
  ): Promise<boolean> => {
    if (!address) return false;

    const provider = new ethers.providers.Web3Provider((window as any).ethereum);
    const signer = provider.getSigner();
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

    const amountWei = ethers.utils.parseUnits(amount, decimals);
    const allowance = await token.allowance(address, spender);

    if (allowance.gte(amountWei)) {
      return true;
    }

    try {
      const tx = await token.approve(spender, ethers.constants.MaxUint256);
      await tx.wait();
      return true;
    } catch (err: any) {
      logger.error('Approve error:', err);
      setError(`Failed to approve token: ${err.reason || err.message}`);
      return false;
    }
  }, [address]);

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
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();

      const token0Address = getTokenAddress(params.token0Symbol);
      const token1Address = getTokenAddress(params.token1Symbol);
      
      // Sort tokens
      const [sortedToken0, sortedToken1] = sortTokens(token0Address, token1Address);
      const [sortedAmount0, sortedAmount1] = sortedToken0 === token0Address 
        ? [params.amount0, params.amount1]
        : [params.amount1, params.amount0];

      const decimals0 = getTokenDecimals(params.token0Symbol);
      const decimals1 = getTokenDecimals(params.token1Symbol);

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

      // Step 3: Mint position
      setStatus('adding');
      
      const positionManager = new ethers.Contract(
        contracts.positionManager, 
        NonfungiblePositionManagerABI.abi, 
        signer
      );

      const amount0Wei = ethers.utils.parseUnits(sortedAmount0, decimals0);
      const amount1Wei = ethers.utils.parseUnits(sortedAmount1, decimals1);
      
      // Calculate minimum amounts with slippage
      const amount0Min = amount0Wei.mul(100 - Math.floor(params.slippageTolerance * 100)).div(10000);
      const amount1Min = amount1Wei.mul(100 - Math.floor(params.slippageTolerance * 100)).div(10000);

      const deadline = Math.floor(Date.now() / 1000) + params.deadline * 60;

      const mintParams = {
        token0: sortedToken0,
        token1: sortedToken1,
        fee: params.fee,
        tickLower: params.tickLower,
        tickUpper: params.tickUpper,
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
  }, [isConnected, isCorrectNetwork, address, checkAndApprove]);

  // Remove liquidity (decrease + collect)
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
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
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

      // Step 1: Decrease liquidity
      const decreaseParams = {
        tokenId,
        liquidity: liquidityToRemove,
        amount0Min: 0,
        amount1Min: 0,
        deadline,
      };

      const decreaseTx = await positionManager.decreaseLiquidity(decreaseParams);
      setTxHash(decreaseTx.hash);
      await decreaseTx.wait();

      // Step 2: Collect tokens
      setStatus('collecting');
      
      const collectParams = {
        tokenId,
        recipient: address,
        amount0Max: MAX_UINT128,
        amount1Max: MAX_UINT128,
      };

      const collectTx = await positionManager.collect(collectParams);
      await collectTx.wait();

      // Step 3: Burn NFT if all liquidity removed
      if (percentageToRemove === 100) {
        try {
          const burnTx = await positionManager.burn(tokenId);
          await burnTx.wait();
        } catch (burnErr) {
          // Burn might fail if there are still uncollected fees
          logger.warn('Could not burn NFT:', burnErr);
        }
      }

      setStatus('success');
      return true;
    } catch (err: any) {
      logger.error('Remove liquidity error:', err);
      setError(err.reason || err.message || 'Failed to remove liquidity');
      setStatus('error');
      return false;
    }
  }, [isConnected, isCorrectNetwork, address]);

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
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
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
  }, [isConnected, isCorrectNetwork, address]);

  // Fetch user positions
  const fetchPositions = useCallback(async (): Promise<Position[]> => {
    if (!isConnected || !address) {
      setPositions([]);
      return [];
    }

    const contracts = getDeployedContracts();
    if (!contracts.positionManager) {
      return [];
    }

    try {
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const positionManager = new ethers.Contract(
        contracts.positionManager,
        NonfungiblePositionManagerABI.abi,
        provider
      );

      // Get number of positions
      const balance = await positionManager.balanceOf(address);
      const positionCount = balance.toNumber();

      const userPositions: Position[] = [];

      for (let i = 0; i < positionCount; i++) {
        const tokenId = await positionManager.tokenOfOwnerByIndex(address, i);
        const position = await positionManager.positions(tokenId);

        // Only include positions with liquidity
        if (!position.liquidity.isZero()) {
          userPositions.push({
            tokenId: tokenId.toString(),
            token0: getTokenSymbol(position.token0),
            token1: getTokenSymbol(position.token1),
            fee: position.fee,
            tickLower: position.tickLower,
            tickUpper: position.tickUpper,
            liquidity: position.liquidity.toString(),
            token0Amount: '0', // Would need pool state to calculate
            token1Amount: '0',
            feeGrowth0: position.feeGrowthInside0LastX128.toString(),
            feeGrowth1: position.feeGrowthInside1LastX128.toString(),
            tokensOwed0: ethers.utils.formatUnits(position.tokensOwed0, 18),
            tokensOwed1: ethers.utils.formatUnits(position.tokensOwed1, 18),
          });
        }
      }

      setPositions(userPositions);
      return userPositions;
    } catch (err: any) {
      logger.error('Fetch positions error:', err);
      return [];
    }
  }, [isConnected, address]);

  // Get token balance
  const getTokenBalance = useCallback(async (tokenSymbol: string): Promise<string> => {
    if (!address) {
      logger.info(`getTokenBalance: No address connected`);
      return '0';
    }

    try {
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const tokenAddress = getTokenAddress(tokenSymbol);
      
      // Validate token address exists
      if (!tokenAddress) {
        logger.error(`getTokenBalance: Token address not found for symbol: ${tokenSymbol}`);
        logger.info(`Available tokens: USDT, USDC, WOVER`);
        return '0';
      }
      
      logger.info(`getTokenBalance: Fetching ${tokenSymbol} balance at ${tokenAddress} for ${address}`);
      
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const balance = await token.balanceOf(address);
      const formatted = ethers.utils.formatUnits(balance, 18);
      
      logger.info(`getTokenBalance: ${tokenSymbol} balance = ${formatted}`);
      return formatted;
    } catch (err: any) {
      logger.error(`getTokenBalance error for ${tokenSymbol}:`, err?.message || err);
      return '0';
    }
  }, [address]);

  // Get current pool price
  const getPoolPrice = useCallback(async (
    token0Symbol: string,
    token1Symbol: string,
    fee: number = 3000
  ): Promise<number | null> => {
    const contracts = getDeployedContracts();
    if (!contracts.factory) return null;

    try {
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      const factory = new ethers.Contract(contracts.factory, UniswapV3FactoryABI.abi, provider);

      const token0Address = getTokenAddress(token0Symbol);
      const token1Address = getTokenAddress(token1Symbol);
      const [sortedToken0, sortedToken1] = sortTokens(token0Address, token1Address);

      const poolAddress = await factory.getPool(sortedToken0, sortedToken1, fee);
      
      if (poolAddress === ethers.constants.AddressZero) {
        return null;
      }

      const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
      const slot0 = await pool.slot0();
      
      const sqrtPriceX96 = slot0.sqrtPriceX96;
      const price = (Number(sqrtPriceX96) / (2 ** 96)) ** 2;

      // Adjust if tokens were swapped
      return sortedToken0 === token0Address ? price : 1 / price;
    } catch (err) {
      logger.error('Pool price error:', err);
      return null;
    }
  }, []);

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
    reset,
  };
};
