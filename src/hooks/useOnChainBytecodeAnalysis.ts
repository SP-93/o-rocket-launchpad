import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { analyzeBytecode, BytecodeAnalysis } from '@/lib/bytecodeAnalyzer';
import { getDeployedContracts } from '@/contracts/storage';

interface OnChainAnalysis {
  address: string;
  bytecodeLength: number;
  bytecodeHash: string;
  bytecodeAnalysis: BytecodeAnalysis;
  tokenBalances: {
    wover: string;
    usdt: string;
  } | null;
  fetchedAt: Date;
}

const ERC20_BALANCE_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function symbol() view returns (string)'
];

export const useOnChainBytecodeAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<OnChainAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeOnChain = useCallback(async (
    woverTokenAddress?: string,
    usdtTokenAddress?: string
  ): Promise<OnChainAnalysis | null> => {
    const contracts = getDeployedContracts();
    const contractAddress = contracts.crashGame;

    if (!contractAddress) {
      setError('No CrashGame contract address found in storage');
      return null;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const provider = new ethers.providers.JsonRpcProvider('https://rpc.overprotocol.com');
      
      // Fetch runtime bytecode from chain
      console.log('[OnChainAnalysis] Fetching bytecode for:', contractAddress);
      const runtimeBytecode = await provider.getCode(contractAddress);
      
      if (runtimeBytecode === '0x' || runtimeBytecode.length <= 2) {
        setError('No bytecode found at this address - contract may not be deployed');
        setIsAnalyzing(false);
        return null;
      }

      // Analyze the runtime bytecode
      const bytecodeAnalysis = analyzeBytecode(runtimeBytecode);
      
      // Calculate bytecode hash
      const bytecodeHash = ethers.utils.keccak256(runtimeBytecode);
      
      console.log('[OnChainAnalysis] Runtime bytecode analysis:', {
        length: runtimeBytecode.length,
        hash: bytecodeHash.slice(0, 18) + '...',
        hasPush0: bytecodeAnalysis.hasPush0,
        evmVersion: bytecodeAnalysis.evmVersion
      });

      // Fetch token balances if addresses provided
      let tokenBalances: { wover: string; usdt: string } | null = null;
      
      if (woverTokenAddress && usdtTokenAddress) {
        try {
          const woverContract = new ethers.Contract(woverTokenAddress, ERC20_BALANCE_ABI, provider);
          const usdtContract = new ethers.Contract(usdtTokenAddress, ERC20_BALANCE_ABI, provider);
          
          const [woverBalance, usdtBalance] = await Promise.all([
            woverContract.balanceOf(contractAddress),
            usdtContract.balanceOf(contractAddress)
          ]);

          tokenBalances = {
            wover: ethers.utils.formatEther(woverBalance),
            usdt: ethers.utils.formatEther(usdtBalance)
          };

          console.log('[OnChainAnalysis] Token balances in contract:', tokenBalances);
        } catch (tokenError) {
          console.warn('[OnChainAnalysis] Failed to fetch token balances:', tokenError);
        }
      }

      const result: OnChainAnalysis = {
        address: contractAddress,
        bytecodeLength: (runtimeBytecode.length - 2) / 2, // Remove 0x and convert hex pairs to bytes
        bytecodeHash,
        bytecodeAnalysis,
        tokenBalances,
        fetchedAt: new Date()
      };

      setAnalysis(result);
      setIsAnalyzing(false);
      return result;

    } catch (err: any) {
      console.error('[OnChainAnalysis] Error:', err);
      setError(err.message || 'Failed to analyze on-chain bytecode');
      setIsAnalyzing(false);
      return null;
    }
  }, []);

  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    setError(null);
  }, []);

  return {
    isAnalyzing,
    analysis,
    error,
    analyzeOnChain,
    clearAnalysis
  };
};
