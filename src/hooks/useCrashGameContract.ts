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

    // Read-only provider
    const provider = new ethers.providers.JsonRpcProvider('https://rpc.over.network');
    return new Contract(crashGameAddress, CRASH_GAME_ABI, provider);
  }, []);

  const deployCrashGame = useCallback(async (
    signer: ethers.Signer,
    woverToken: string,
    usdtToken: string,
    treasuryWallet: string,
    factoryDeployerWallet: string
  ) => {
    setIsDeploying(true);
    try {
      toast.info('Deploying CrashGame contract...');
      
      const factory = new ContractFactory(CRASH_GAME_ABI, CRASH_GAME_BYTECODE, signer);
      
      const contract = await factory.deploy(
        woverToken,
        usdtToken,
        treasuryWallet,
        factoryDeployerWallet
      );
      
      toast.info('Waiting for confirmation...');
      await contract.deployed();
      
      // Save deployment address
      saveDeployedContract('crashGame', contract.address);
      
      toast.success(`CrashGame deployed at ${contract.address}`);
      return contract.address;
    } catch (error: any) {
      console.error('CrashGame deployment failed:', error);
      toast.error('Deployment failed: ' + (error.reason || error.message));
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
    await tx.wait();
    
    return { seedHash, seedBytes32 };
  }, [getContract]);

  const startFlying = useCallback(async (signer: ethers.Signer) => {
    const contract = await getContract(signer);
    if (!contract) throw new Error('Contract not deployed');

    const tx = await contract.startFlying();
    await tx.wait();
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
    await tx.wait();
  }, [getContract]);

  const refillPrizePool = useCallback(async (
    signer: ethers.Signer,
    amount: string,
    isWover: boolean
  ) => {
    const contract = await getContract(signer);
    if (!contract) throw new Error('Contract not deployed');

    const amountWei = ethers.utils.parseEther(amount);
    
    // First approve the token transfer
    const tokenAddress = isWover ? await contract.woverToken() : await contract.usdtToken();
    const tokenContract = new Contract(
      tokenAddress,
      ['function approve(address spender, uint256 amount) returns (bool)'],
      signer
    );
    
    const approveTx = await tokenContract.approve(contract.address, amountWei);
    await approveTx.wait();
    
    // Then refill
    const tx = await contract.refillPrizePool(amountWei, isWover);
    await tx.wait();
    
    toast.success(`Prize pool refilled with ${amount} ${isWover ? 'WOVER' : 'USDT'}`);
  }, [getContract]);

  const distributeWoverRevenue = useCallback(async (signer: ethers.Signer) => {
    const contract = await getContract(signer);
    if (!contract) throw new Error('Contract not deployed');

    const tx = await contract.distributeWoverRevenue();
    await tx.wait();
    
    toast.success('WOVER revenue distributed');
  }, [getContract]);

  const distributeUsdtRevenue = useCallback(async (signer: ethers.Signer) => {
    const contract = await getContract(signer);
    if (!contract) throw new Error('Contract not deployed');

    const tx = await contract.distributeUsdtRevenue();
    await tx.wait();
    
    toast.success('USDT revenue distributed');
  }, [getContract]);

  const setPrizePoolPercentage = useCallback(async (signer: ethers.Signer, percentage: number) => {
    const contract = await getContract(signer);
    if (!contract) throw new Error('Contract not deployed');

    const tx = await contract.setPrizePoolPercentage(percentage);
    await tx.wait();
    
    toast.success(`Prize pool percentage set to ${percentage}%`);
  }, [getContract]);

  const pauseGame = useCallback(async (signer: ethers.Signer) => {
    const contract = await getContract(signer);
    if (!contract) throw new Error('Contract not deployed');

    const tx = await contract.pause();
    await tx.wait();
    
    toast.success('Game paused');
  }, [getContract]);

  const unpauseGame = useCallback(async (signer: ethers.Signer) => {
    const contract = await getContract(signer);
    if (!contract) throw new Error('Contract not deployed');

    const tx = await contract.unpause();
    await tx.wait();
    
    toast.success('Game unpaused');
  }, [getContract]);

  return {
    isDeploying,
    isLoading,
    contractState,
    deployCrashGame,
    fetchContractState,
    getContract,
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
