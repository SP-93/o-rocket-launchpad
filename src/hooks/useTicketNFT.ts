import { useState, useCallback } from 'react';
import { ethers, Contract, ContractFactory } from 'ethers';
import { toast } from 'sonner';
import { TICKET_NFT_ABI, TICKET_NFT_BYTECODE } from '@/contracts/artifacts/ticketNFT';
import { getDeployedContracts, saveDeployedContract } from '@/contracts/storage';
import { TOKEN_ADDRESSES } from '@/config/admin';
import { getUniversalSigner } from '@/lib/walletProvider';
import { getProxiedProvider } from '@/lib/rpcProvider';

// SafeWait helper - handles TRANSACTION_REPLACED errors gracefully
const safeWait = async (tx: ethers.ContractTransaction): Promise<ethers.ContractReceipt> => {
  try {
    return await tx.wait(1);
  } catch (err: any) {
    // Handle speed-up/cancel transactions - if replaced but succeeded, return the new receipt
    if (err.code === 'TRANSACTION_REPLACED') {
      if (err.cancelled === false && err.receipt) {
        console.log('[NFT] Transaction replaced but succeeded:', err.receipt.transactionHash);
        return err.receipt;
      }
      // Transaction was cancelled
      throw new Error('Transaction was cancelled');
    }
    throw err;
  }
};
interface TicketInfo {
  ticketValue: number;
  expireAt: number;
  isUsed: boolean;
  usedInRound: number;
}

interface TicketNFTState {
  totalSupply: number;
}

const FACTORY_WALLET = '0x8334966329b7f4b459633696a8ca59118253bc89';

export const useTicketNFT = () => {
  const [isDeploying, setIsDeploying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [contractState, setContractState] = useState<TicketNFTState | null>(null);

  const getContract = useCallback((signerOrProvider?: ethers.Signer | ethers.providers.Provider) => {
    const contracts = getDeployedContracts();
    const ticketNFTAddress = (contracts as any).ticketNFT;
    
    if (!ticketNFTAddress) {
      return null;
    }

    if (signerOrProvider) {
      return new Contract(ticketNFTAddress, TICKET_NFT_ABI, signerOrProvider);
    }

    // Use proxied provider for queries (CORS-safe)
    return new Contract(ticketNFTAddress, TICKET_NFT_ABI, getProxiedProvider());
  }, []);

  // Deploy requires explicit signer (admin action)
  const deployTicketNFT = useCallback(async (
    signer: ethers.Signer,
    options?: { gasLimit?: number }
  ) => {
    setIsDeploying(true);
    try {
      const gasLimit = options?.gasLimit ?? 8_000_000;

      toast.info('Deploying RocketTicketNFT contract...');

      const factory = new ContractFactory(TICKET_NFT_ABI, TICKET_NFT_BYTECODE, signer);

      // Constructor: (_woverToken, _usdtToken, _factoryWallet, _priceOracle)
      const contract = await factory.deploy(
        TOKEN_ADDRESSES.WOVER,
        TOKEN_ADDRESSES.USDT,
        FACTORY_WALLET,
        FACTORY_WALLET,
        { gasLimit }
      );

      const tx = contract.deployTransaction;
      toast.info(`Deploy tx sent: ${tx.hash}`);
      console.info('[TicketNFT deploy] tx hash:', tx.hash);

      const receipt = await tx.wait();
      console.info('[TicketNFT deploy] receipt:', {
        status: receipt.status,
        gasUsed: receipt.gasUsed?.toString(),
        contractAddress: receipt.contractAddress,
      });

      if (receipt.status !== 1) {
        throw new Error('Deployment reverted');
      }

      await contract.deployed();

      saveDeployedContract('ticketNFT' as any, contract.address);

      toast.success(`RocketTicketNFT deployed at ${contract.address}`);
      return contract.address;
    } catch (error: any) {
      console.error('TicketNFT deployment failed:', error);
      toast.error('Deployment failed: ' + (error.reason || error.message));
      throw error;
    } finally {
      setIsDeploying(false);
    }
  }, []);

  const fetchContractState = useCallback(async () => {
    setIsLoading(true);
    try {
      const contract = getContract();
      if (!contract) {
        console.warn('[TicketNFT] No contract address configured');
        setContractState(null);
        return null;
      }

      console.log('[TicketNFT] Fetching state from:', contract.address);

      // Only fetch totalSupply - woverPrice is not needed (1 WOVER = 1 ticket value)
      const totalSupply = await contract.totalSupply();

      console.log('[TicketNFT] State fetched:', { 
        totalSupply: totalSupply.toString()
      });

      const state: TicketNFTState = {
        totalSupply: totalSupply.toNumber(),
      };

      setContractState(state);
      return state;
    } catch (error: any) {
      console.error('[TicketNFT] Failed to fetch state:', error.message || error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getContract]);

  /**
   * Buy ticket with WOVER - uses universal signer (works with all wallet types)
   * Fixed pricing: 1 WOVER = 1 ticket value (hardcoded)
   */
  const buyWithWover = useCallback(async (
    ticketValue: number
  ): Promise<{ tokenId: number; txHash: string }> => {
    // Get signer via universal method (handles WalletConnect, MetaMask, etc.)
    const signer = await getUniversalSigner();
    
    const contract = getContract(signer);
    if (!contract) throw new Error('TicketNFT not deployed');

    // HARDCODED: 1 WOVER = 1 ticket value unit
    // ticketValue 1 = 1 WOVER, ticketValue 5 = 5 WOVER
    const woverPricePerUnit = ethers.utils.parseEther('1');
    const requiredAmount = woverPricePerUnit.mul(ticketValue);
    
    console.log('[NFT] buyWithWover - ticketValue:', ticketValue, 'requiredAmount:', ethers.utils.formatEther(requiredAmount), 'WOVER');
    
    
    
    // Approve WOVER transfer
    const woverContract = new Contract(
      TOKEN_ADDRESSES.WOVER,
      ['function approve(address,uint256) returns (bool)', 'function allowance(address,address) view returns (uint256)'],
      signer
    );

    const signerAddress = await signer.getAddress();
    const allowance = await woverContract.allowance(signerAddress, contract.address);
    
    console.log('[NFT] Current allowance:', ethers.utils.formatEther(allowance), 'Required:', ethers.utils.formatEther(requiredAmount));
    
    if (allowance.lt(requiredAmount)) {
      toast.info('Approving WOVER...');
      const approveTx = await woverContract.approve(contract.address, ethers.constants.MaxUint256);
      await safeWait(approveTx);
      console.log('[NFT] WOVER approved');
    }

    toast.info('Minting ticket NFT...');
    const tx = await contract.buyWithWover(ticketValue, { gasLimit: 500000 });
    console.log('[NFT] Mint tx sent:', tx.hash);
    
    const receipt = await safeWait(tx);
    console.log('[NFT] Mint receipt status:', receipt.status, 'gasUsed:', receipt.gasUsed?.toString());

    if (receipt.status !== 1) {
      throw new Error('NFT mint transaction failed on-chain');
    }

    const mintEvent = receipt.events?.find((e: any) => e.event === 'TicketMinted');
    const tokenId = mintEvent?.args?.tokenId?.toNumber() ?? 0;

    console.log('[NFT] Ticket minted! tokenId:', tokenId, 'txHash:', tx.hash);
    toast.success(`Ticket #${tokenId} minted!`);
    return { tokenId, txHash: tx.hash };
  }, [getContract]);

  /**
   * Buy ticket with USDT - uses universal signer
   */
  const buyWithUsdt = useCallback(async (
    ticketValue: number,
    maxAmount: string
  ): Promise<{ tokenId: number; txHash: string }> => {
    const signer = await getUniversalSigner();
    
    const contract = getContract(signer);
    if (!contract) throw new Error('TicketNFT not deployed');

    const usdtPrice = await contract.getUsdtPrice(ticketValue);
    const maxAmountWei = usdtPrice.mul(105).div(100); // 5% slippage
    
    console.log('[NFT] buyWithUsdt - ticketValue:', ticketValue, 'usdtPrice:', ethers.utils.formatEther(usdtPrice), 'maxAmount:', ethers.utils.formatEther(maxAmountWei));
    
    const usdtContract = new Contract(
      TOKEN_ADDRESSES.USDT,
      ['function approve(address,uint256) returns (bool)', 'function allowance(address,address) view returns (uint256)'],
      signer
    );

    const signerAddress = await signer.getAddress();
    const allowance = await usdtContract.allowance(signerAddress, contract.address);
    
    if (allowance.lt(maxAmountWei)) {
      toast.info('Approving USDT...');
      const approveTx = await usdtContract.approve(contract.address, ethers.constants.MaxUint256);
      await safeWait(approveTx);
    }

    toast.info('Minting ticket NFT...');
    const tx = await contract.buyWithUsdt(ticketValue, maxAmountWei, { gasLimit: 500000 });
    console.log('[NFT] USDT Mint tx sent:', tx.hash);
    
    const receipt = await safeWait(tx);

    if (receipt.status !== 1) {
      throw new Error('NFT mint transaction failed on-chain');
    }

    const mintEvent = receipt.events?.find((e: any) => e.event === 'TicketMinted');
    const tokenId = mintEvent?.args?.tokenId?.toNumber() ?? 0;

    console.log('[NFT] USDT Ticket minted! tokenId:', tokenId, 'txHash:', tx.hash);
    toast.success(`Ticket #${tokenId} minted!`);
    return { tokenId, txHash: tx.hash };
  }, [getContract]);

  const getPlayerTickets = useCallback(async (playerAddress: string): Promise<number[]> => {
    const contract = getContract();
    if (!contract) return [];

    try {
      const tokenIds = await contract.getPlayerTickets(playerAddress);
      return tokenIds.map((id: ethers.BigNumber) => id.toNumber());
    } catch (error) {
      console.error('Error getting player tickets:', error);
      return [];
    }
  }, [getContract]);

  const getAvailableTickets = useCallback(async (playerAddress: string): Promise<{ tokenIds: number[], values: number[] }> => {
    const contract = getContract();
    if (!contract) return { tokenIds: [], values: [] };

    try {
      const [tokenIds, values] = await contract.getAvailableTickets(playerAddress);
      return {
        tokenIds: tokenIds.map((id: ethers.BigNumber) => id.toNumber()),
        values: values.map((v: ethers.BigNumber) => v.toNumber()),
      };
    } catch (error) {
      console.error('Error getting available tickets:', error);
      return { tokenIds: [], values: [] };
    }
  }, [getContract]);

  const getTicket = useCallback(async (tokenId: number): Promise<TicketInfo | null> => {
    const contract = getContract();
    if (!contract) return null;

    try {
      const ticket = await contract.getTicket(tokenId);
      return {
        ticketValue: ticket.ticketValue.toNumber(),
        expireAt: ticket.expireAt.toNumber(),
        isUsed: ticket.isUsed,
        usedInRound: ticket.usedInRound.toNumber(),
      };
    } catch (error) {
      console.error('Error getting ticket:', error);
      return null;
    }
  }, [getContract]);

  const isTicketValid = useCallback(async (tokenId: number): Promise<boolean> => {
    const contract = getContract();
    if (!contract) return false;

    try {
      return await contract.isTicketValid(tokenId);
    } catch (error) {
      console.error('Error checking ticket validity:', error);
      return false;
    }
  }, [getContract]);

  // setWoverPrice requires explicit signer (admin action)
  // Returns transaction receipt for caller to use
  const setWoverPrice = useCallback(async (signer: ethers.Signer, priceInWei: string): Promise<ethers.providers.TransactionReceipt | null> => {
    const contract = getContract(signer);
    if (!contract) throw new Error('TicketNFT not deployed');

    toast.info('Setting WOVER price...');
    const tx = await contract.setWoverPrice(priceInWei);
    const receipt = await safeWait(tx);
    toast.success('WOVER price updated');
    return receipt;
  }, [getContract]);

  return {
    isDeploying,
    isLoading,
    contractState,
    deployTicketNFT,
    fetchContractState,
    getContract,
    buyWithWover,
    buyWithUsdt,
    getPlayerTickets,
    getAvailableTickets,
    getTicket,
    isTicketValid,
    setWoverPrice,
  };
};
