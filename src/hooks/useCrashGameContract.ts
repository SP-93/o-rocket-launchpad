import { useState, useCallback } from 'react';
import { ethers, Contract, ContractFactory } from 'ethers';
import { toast } from 'sonner';
import { CRASH_GAME_ABI, CRASH_GAME_BYTECODE } from '@/contracts/artifacts/crashGame';
import { getDeployedContracts, saveDeployedContract } from '@/contracts/storage';

interface CrashGameState {
  currentRoundId: number;
  prizePoolWover: string;
  prizePoolUsdt: string;
  pendingRevenueWover: string;
  pendingRevenueUsdt: string;
  prizePoolPercentage: number;
  minBet: string;
  maxBet: string;
  maxMultiplier: number;
  bettingDuration: number;
  isPaused: boolean;
}

// Helper to handle TRANSACTION_REPLACED errors
const waitForTransaction = async (tx: ethers.ContractTransaction): Promise<void> => {
  try {
    await tx.wait();
  } catch (error: any) {
    // If transaction was replaced but the replacement succeeded, continue
    if (error.code === 'TRANSACTION_REPLACED') {
      if (error.receipt?.status === 1 || error.replacement) {
        console.log('Transaction was replaced but succeeded');
        return;
      }
    }
    throw error;
  }
};

export const useCrashGameContract = () => {
  const [isDeploying, setIsDeploying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [contractState, setContractState] = useState<CrashGameState | null>(null);

  const getContract = useCallback(async (signer?: ethers.Signer) => {
    const deployedContracts = getDeployedContracts();
    const crashGameAddress = deployedContracts.crashGame;
    
    if (!crashGameAddress) {
      return null;
    }

    if (signer) {
      return new Contract(crashGameAddress, CRASH_GAME_ABI, signer);
    }

    // Read-only provider - use correct Over Protocol mainnet RPC
    const provider = new ethers.providers.JsonRpcProvider('https://rpc.overprotocol.com');
    return new Contract(crashGameAddress, CRASH_GAME_ABI, provider);
  }, []);

  const deployCrashGame = useCallback(async (
    signer: ethers.Signer,
    woverToken: string,
    usdtToken: string,
    treasuryWallet: string,
    factoryDeployerWallet: string,
    options?: {
      gasLimit?: number;
    }
  ) => {
    setIsDeploying(true);
    try {
      const gasLimit = options?.gasLimit ?? 12_000_000;

      toast.info('Deploying CrashGame contract...');

      const factory = new ContractFactory(CRASH_GAME_ABI, CRASH_GAME_BYTECODE, signer);

      const contract = await factory.deploy(
        woverToken,
        usdtToken,
        treasuryWallet,
        factoryDeployerWallet,
        {
          gasLimit,
        }
      );

      const tx = contract.deployTransaction;
      toast.info(`Deploy tx sent: ${tx.hash}`);
      console.info('[CrashGame deploy] tx hash:', tx.hash);
      console.info('[CrashGame deploy] gasLimit:', gasLimit);

      const receipt = await tx.wait();
      console.info('[CrashGame deploy] receipt:', {
        status: receipt.status,
        gasUsed: receipt.gasUsed?.toString?.() ?? String(receipt.gasUsed),
        blockNumber: receipt.blockNumber,
        contractAddress: receipt.contractAddress,
      });

      if (receipt.status !== 1) {
        throw new Error('Deployment reverted (receipt.status != 1)');
      }

      // Ensure ethers has the final address
      await contract.deployed();

      // Save deployment address
      saveDeployedContract('crashGame', contract.address);

      toast.success(`CrashGame deployed at ${contract.address}`);
      return contract.address;
    } catch (error: any) {
      console.error('CrashGame deployment failed:', error);
      
      // Enhanced error messaging
      const errorMsg = error.reason || error.message || 'Unknown error';
      const isCallException = errorMsg.includes('CALL_EXCEPTION') || error.code === 'CALL_EXCEPTION';
      const isOutOfGas = errorMsg.includes('out of gas') || errorMsg.includes('gas');
      
      if (isCallException && !isOutOfGas) {
        toast.error('Deployment reverted - likely unsupported opcode (PUSH0). Recompile with EVM=Paris.');
        console.error('[CrashGame] CALL_EXCEPTION without gas issue - suspected PUSH0 incompatibility');
      } else {
        toast.error('Deployment failed: ' + errorMsg);
      }
      
      throw error;
    } finally {
      setIsDeploying(false);
    }
  }, []);

  const fetchContractState = useCallback(async () => {
    setIsLoading(true);
    try {
      const contract = await getContract();
      if (!contract) {
        setContractState(null);
        return null;
      }

      const [
        currentRoundId,
        prizePoolWover,
        prizePoolUsdt,
        pendingRevenueWover,
        pendingRevenueUsdt,
        prizePoolPercentage,
        minBet,
        maxBet,
        maxMultiplier,
        bettingDuration,
        isPaused,
      ] = await Promise.all([
        contract.currentRoundId(),
        contract.prizePoolWover(),
        contract.prizePoolUsdt(),
        contract.pendingRevenueWover(),
        contract.pendingRevenueUsdt(),
        contract.prizePoolPercentage(),
        contract.minBet(),
        contract.maxBet(),
        contract.maxMultiplier(),
        contract.bettingDuration(),
        contract.paused(),
      ]);

      const state: CrashGameState = {
        currentRoundId: currentRoundId.toNumber(),
        prizePoolWover: ethers.utils.formatEther(prizePoolWover),
        prizePoolUsdt: ethers.utils.formatEther(prizePoolUsdt),
        pendingRevenueWover: ethers.utils.formatEther(pendingRevenueWover),
        pendingRevenueUsdt: ethers.utils.formatEther(pendingRevenueUsdt),
        prizePoolPercentage: prizePoolPercentage.toNumber(),
        minBet: ethers.utils.formatEther(minBet),
        maxBet: ethers.utils.formatEther(maxBet),
        maxMultiplier: maxMultiplier.toNumber(),
        bettingDuration: bettingDuration.toNumber(),
        isPaused,
      };

      setContractState(state);
      return state;
    } catch (error) {
      console.error('Failed to fetch contract state:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getContract]);

  // Fetch contract owner - placed here for stable hook order
  const getContractOwner = useCallback(async () => {
    const contract = await getContract();
    if (!contract) return null;
    try {
      return await contract.owner();
    } catch {
      return null;
    }
  }, [getContract]);

  const startRound = useCallback(async (signer: ethers.Signer, serverSeed: string) => {
    const contract = await getContract(signer);
    if (!contract) throw new Error('Contract not deployed');

    // Convert to bytes32 format (matching crashRound)
    const seedBytes32 = ethers.utils.formatBytes32String(serverSeed.slice(0, 31));
    
    // Hash the server seed for pre-commitment using abi.encodePacked like contract does
    const seedHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(['bytes32'], [seedBytes32])
    );
    
    const tx = await contract.startRound(seedHash);
    await waitForTransaction(tx);
    
    return { seedHash, seedBytes32 };
  }, [getContract]);

  const startFlying = useCallback(async (signer: ethers.Signer) => {
    const contract = await getContract(signer);
    if (!contract) throw new Error('Contract not deployed');

    const tx = await contract.startFlying();
    await waitForTransaction(tx);
  }, [getContract]);

  const crashRound = useCallback(async (
    signer: ethers.Signer, 
    serverSeed: string, 
    crashPoint: number
  ) => {
    const contract = await getContract(signer);
    if (!contract) throw new Error('Contract not deployed');

    // Convert serverSeed string to bytes32 format
    // The contract expects the RAW serverSeed, not the hash!
    // Contract verifies: keccak256(abi.encodePacked(_serverSeed)) == seedHash
    const seedBytes32 = ethers.utils.formatBytes32String(serverSeed.slice(0, 31));
    
    // crashPoint is multiplier * 100 (e.g., 250 = 2.50x)
    const tx = await contract.crashRound(seedBytes32, crashPoint);
    await waitForTransaction(tx);
  }, [getContract]);

  const refillPrizePool = useCallback(async (
    signer: ethers.Signer,
    amount: string,
    isWover: boolean
  ) => {
    const contract = await getContract(signer);
    if (!contract) throw new Error('Contract not deployed');

    const signerAddress = await signer.getAddress();
    
    // Check ownership first
    const owner = await contract.owner();
    if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
      throw new Error(`Only contract owner can refill. Owner: ${owner}, Your wallet: ${signerAddress}`);
    }

    const amountWei = ethers.utils.parseEther(amount);
    
    // Get token addresses from contract and verify
    const woverInContract = await contract.woverToken();
    const usdtInContract = await contract.usdtToken();
    console.log('[refillPrizePool] Token addresses in contract:', {
      wover: woverInContract,
      usdt: usdtInContract,
    });
    
    const tokenAddress = isWover ? woverInContract : usdtInContract;
    const tokenContract = new Contract(
      tokenAddress,
      [
        'function approve(address spender, uint256 amount) returns (bool)',
        'function balanceOf(address account) view returns (uint256)',
        'function allowance(address owner, address spender) view returns (uint256)',
        'function symbol() view returns (string)'
      ],
      signer
    );
    
    // Check token balance
    const tokenBalance = await tokenContract.balanceOf(signerAddress);
    if (tokenBalance.lt(amountWei)) {
      const balanceFormatted = ethers.utils.formatEther(tokenBalance);
      throw new Error(`Insufficient ${isWover ? 'WOVER' : 'USDT'} balance. You have: ${balanceFormatted}, Need: ${amount}`);
    }

    // Check current allowance
    const currentAllowance = await tokenContract.allowance(signerAddress, contract.address);
    console.log('[refillPrizePool] Starting refill...', {
      owner,
      signerAddress,
      amount,
      tokenAddress,
      tokenBalance: ethers.utils.formatEther(tokenBalance),
      currentAllowance: ethers.utils.formatEther(currentAllowance)
    });
    
    try {
      // Only approve if needed - use MaxUint256 for infinite approval
      if (currentAllowance.lt(amountWei)) {
        toast.info('Approving token transfer...');
        const approveTx = await tokenContract.approve(
          contract.address, 
          ethers.constants.MaxUint256, // Infinite approval
          { 
            gasLimit: 150000,
            gasPrice: ethers.utils.parseUnits('100', 'gwei')
          }
        );
        await waitForTransaction(approveTx);
        
        // Verify allowance after approve
        const allowanceAfter = await tokenContract.allowance(signerAddress, contract.address);
        console.log('[refillPrizePool] Allowance after approve:', ethers.utils.formatEther(allowanceAfter));
        
        if (allowanceAfter.isZero()) {
          throw new Error('Approve transaction completed but allowance is still 0');
        }
      } else {
        console.log('[refillPrizePool] Sufficient allowance exists, skipping approve');
      }
      
      // STEP 1: Static call to get exact revert reason before sending tx
      toast.info('Validating transaction...');
      try {
        await contract.callStatic.refillPrizePool(amountWei, isWover);
        console.log('[refillPrizePool] Static call succeeded - transaction should work');
      } catch (staticError: any) {
        console.error('[refillPrizePool] Static call failed:', staticError);
        const reason = staticError.reason || staticError.error?.message || staticError.message;
        throw new Error(`Contract would revert: ${reason}`);
      }
      
      // STEP 2: Estimate gas with fallback
      toast.info('Estimating gas...');
      let gasLimit: number = 800000; // Fallback default
      try {
        const estimatedGas = await contract.estimateGas.refillPrizePool(amountWei, isWover);
        gasLimit = Math.ceil(estimatedGas.toNumber() * 1.3); // 30% buffer
        console.log('[refillPrizePool] Estimated gas:', estimatedGas.toString(), 'Using:', gasLimit);
      } catch (estimateError: any) {
        console.warn('[refillPrizePool] Gas estimation failed, using fallback:', gasLimit);
        // Continue with fallback gas limit instead of throwing
      }
      
      // STEP 3: Execute refill
      toast.info('Refilling prize pool...');
      const tx = await contract.refillPrizePool(amountWei, isWover, { 
        gasLimit,
        gasPrice: ethers.utils.parseUnits('100', 'gwei')
      });
      await waitForTransaction(tx);
      console.log('[refillPrizePool] Refill successful, tx:', tx.hash);
      
      toast.success(`Prize pool refilled with ${amount} ${isWover ? 'WOVER' : 'USDT'}`);
    } catch (error: any) {
      console.error('[refillPrizePool] Error:', error);
      
      // Decode JSON-RPC errors
      if (error.code === -32603 || error.message?.includes('Internal JSON-RPC error')) {
        const innerError = error.data?.message || error.error?.message || 'Unknown contract error';
        throw new Error(`Contract call failed: ${innerError}`);
      }
      
      // Handle CALL_EXCEPTION
      if (error.code === 'CALL_EXCEPTION') {
        throw new Error(`Transaction reverted on-chain. Possible causes: insufficient token balance in contract, or contract logic error.`);
      }
      
      // Re-throw with better message
      throw new Error(error.reason || error.message || 'Refill failed');
    }
  }, [getContract]);


  const distributeWoverRevenue = useCallback(async (signer: ethers.Signer) => {
    const contract = await getContract(signer);
    if (!contract) throw new Error('Contract not deployed');

    const tx = await contract.distributeWoverRevenue();
    await waitForTransaction(tx);
    
    toast.success('WOVER revenue distributed');
  }, [getContract]);

  const distributeUsdtRevenue = useCallback(async (signer: ethers.Signer) => {
    const contract = await getContract(signer);
    if (!contract) throw new Error('Contract not deployed');

    const tx = await contract.distributeUsdtRevenue();
    await waitForTransaction(tx);
    
    toast.success('USDT revenue distributed');
  }, [getContract]);

  const setPrizePoolPercentage = useCallback(async (signer: ethers.Signer, percentage: number) => {
    const contract = await getContract(signer);
    if (!contract) throw new Error('Contract not deployed');

    const tx = await contract.setPrizePoolPercentage(percentage);
    await waitForTransaction(tx);
    
    toast.success(`Prize pool percentage set to ${percentage}%`);
  }, [getContract]);

  const pauseGame = useCallback(async (signer: ethers.Signer) => {
    const contract = await getContract(signer);
    if (!contract) throw new Error('Contract not deployed');

    const tx = await contract.pause();
    await waitForTransaction(tx);
    
    toast.success('Game paused');
  }, [getContract]);

  const unpauseGame = useCallback(async (signer: ethers.Signer) => {
    const contract = await getContract(signer);
    if (!contract) throw new Error('Contract not deployed');

    const tx = await contract.unpause();
    await waitForTransaction(tx);
    
    toast.success('Game unpaused');
  }, [getContract]);

  return {
    isDeploying,
    isLoading,
    contractState,
    deployCrashGame,
    fetchContractState,
    getContract,
    getContractOwner,
    startRound,
    startFlying,
    crashRound,
    refillPrizePool,
    distributeWoverRevenue,
    distributeUsdtRevenue,
    setPrizePoolPercentage,
    pauseGame,
    unpauseGame,
  };
};
