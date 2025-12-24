import { useState, useCallback } from 'react';
import { ethers, Contract, ContractFactory } from 'ethers';
import { toast } from 'sonner';
import { CRASH_GAME_ABI, CRASH_GAME_BYTECODE, CLAIM_SIGNER_ADDRESS } from '@/contracts/artifacts/crashGame';
import { getDeployedContracts, saveDeployedContract } from '@/contracts/storage';
import { saveCrashGameAddressToBackend } from '@/lib/contractConfigSync';
import { TOKEN_ADDRESSES } from '@/config/admin';

interface CrashGameState {
  prizePool: string;
  totalDeposited: string;
  totalClaimed: string;
  isPoolLow: boolean;
  claimSigner: string;
}

// Helper to handle TRANSACTION_REPLACED errors
const waitForTransaction = async (tx: ethers.ContractTransaction): Promise<void> => {
  try {
    await tx.wait();
  } catch (error: any) {
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

    const provider = new ethers.providers.JsonRpcProvider('https://rpc.overprotocol.com');
    return new Contract(crashGameAddress, CRASH_GAME_ABI, provider);
  }, []);

  const deployCrashGame = useCallback(async (
    signer: ethers.Signer,
    woverToken: string,
    claimSigner: string = CLAIM_SIGNER_ADDRESS,
    options?: { gasLimit?: number }
  ) => {
    setIsDeploying(true);
    try {
      const gasLimit = options?.gasLimit ?? 5_000_000;

      toast.info('Deploying CrashGame contract...');

      const factory = new ContractFactory(CRASH_GAME_ABI, CRASH_GAME_BYTECODE, signer);

      // New contract only takes 2 args: (_woverToken, _claimSigner)
      const contract = await factory.deploy(
        woverToken,
        claimSigner,
        { gasLimit }
      );

      const tx = contract.deployTransaction;
      toast.info(`Deploy tx sent: ${tx.hash}`);
      console.info('[CrashGame deploy] tx hash:', tx.hash);
      console.info('[CrashGame deploy] args:', { woverToken, claimSigner });

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

      await contract.deployed();

      // Save deployment address to localStorage AND backend
      saveDeployedContract('crashGame', contract.address);
      await saveCrashGameAddressToBackend(contract.address);

      toast.success(`CrashGame deployed at ${contract.address}`);
      return contract.address;
    } catch (error: any) {
      console.error('CrashGame deployment failed:', error);
      
      const errorMsg = error.reason || error.message || 'Unknown error';
      const isCallException = errorMsg.includes('CALL_EXCEPTION') || error.code === 'CALL_EXCEPTION';
      const isOutOfGas = errorMsg.includes('out of gas') || errorMsg.includes('gas');
      
      if (isCallException && !isOutOfGas) {
        toast.error('Deployment reverted - likely unsupported opcode (PUSH0). Recompile with EVM=Paris.');
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

      const [stats, claimSigner] = await Promise.all([
        contract.getStats(),
        contract.claimSigner(),
      ]);

      const state: CrashGameState = {
        prizePool: ethers.utils.formatEther(stats._prizePool),
        totalDeposited: ethers.utils.formatEther(stats._totalDeposited),
        totalClaimed: ethers.utils.formatEther(stats._totalClaimed),
        isPoolLow: stats._isLow,
        claimSigner,
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

  const getContractOwner = useCallback(async () => {
    const contract = await getContract();
    if (!contract) return null;
    try {
      return await contract.owner();
    } catch {
      return null;
    }
  }, [getContract]);

  const refillPrizePool = useCallback(async (
    signer: ethers.Signer,
    amount: string
  ) => {
    const contract = await getContract(signer);
    if (!contract) throw new Error('Contract not deployed');

    const signerAddress = await signer.getAddress();
    
    // Check ownership first
    const owner = await contract.owner();
    if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
      throw new Error(`Only contract owner can refill. Owner: ${owner}`);
    }

    const amountWei = ethers.utils.parseEther(amount);
    
    // Get WOVER token contract
    const woverAddress = await contract.woverToken();
    const tokenContract = new Contract(
      woverAddress,
      [
        'function approve(address spender, uint256 amount) returns (bool)',
        'function balanceOf(address account) view returns (uint256)',
        'function allowance(address owner, address spender) view returns (uint256)',
      ],
      signer
    );
    
    // Check token balance
    const tokenBalance = await tokenContract.balanceOf(signerAddress);
    if (tokenBalance.lt(amountWei)) {
      throw new Error(`Insufficient WOVER balance. You have: ${ethers.utils.formatEther(tokenBalance)}, Need: ${amount}`);
    }

    // Check/set allowance
    const currentAllowance = await tokenContract.allowance(signerAddress, contract.address);
    if (currentAllowance.lt(amountWei)) {
      toast.info('Approving WOVER transfer...');
      const approveTx = await tokenContract.approve(contract.address, ethers.constants.MaxUint256);
      await waitForTransaction(approveTx);
    }
    
    // Execute refill
    toast.info('Refilling prize pool...');
    const tx = await contract.refillPrizePool(amountWei, { gasLimit: 300000 });
    await waitForTransaction(tx);
    
    toast.success(`Prize pool refilled with ${amount} WOVER`);
  }, [getContract]);

  const emergencyWithdraw = useCallback(async (signer: ethers.Signer, amount: string) => {
    const contract = await getContract(signer);
    if (!contract) throw new Error('Contract not deployed');

    const amountWei = ethers.utils.parseEther(amount);
    const tx = await contract.emergencyWithdraw(amountWei);
    await waitForTransaction(tx);
    
    toast.success(`Withdrew ${amount} WOVER`);
  }, [getContract]);

  const setClaimSigner = useCallback(async (signer: ethers.Signer, newSignerAddress: string) => {
    const contract = await getContract(signer);
    if (!contract) throw new Error('Contract not deployed');

    const tx = await contract.setClaimSigner(newSignerAddress);
    await waitForTransaction(tx);
    
    toast.success('Claim signer updated');
  }, [getContract]);

  const verifyClaimSignature = useCallback(async (
    player: string,
    amount: string,
    roundId: string,
    nonce: number,
    signature: string
  ): Promise<{ isValid: boolean; isUsed: boolean }> => {
    const contract = await getContract();
    if (!contract) throw new Error('Contract not deployed');

    const amountWei = ethers.utils.parseEther(amount);
    const roundIdBytes32 = ethers.utils.id(roundId); // Convert round UUID to bytes32
    
    const [isValid, isUsed] = await contract.verifyClaimSignature(
      player,
      amountWei,
      roundIdBytes32,
      nonce,
      signature
    );

    return { isValid, isUsed };
  }, [getContract]);

  return {
    isDeploying,
    isLoading,
    contractState,
    deployCrashGame,
    fetchContractState,
    getContract,
    getContractOwner,
    refillPrizePool,
    emergencyWithdraw,
    setClaimSigner,
    verifyClaimSignature,
  };
};
