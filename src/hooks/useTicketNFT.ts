import { useState, useCallback } from 'react';
import { ethers, Contract, ContractFactory } from 'ethers';
import { toast } from 'sonner';
import { TICKET_NFT_ABI, TICKET_NFT_BYTECODE } from '@/contracts/artifacts/ticketNFT';
import { getDeployedContracts, saveDeployedContract } from '@/contracts/storage';
import { TOKEN_ADDRESSES } from '@/config/admin';
import { getUniversalSigner, getReadProvider } from '@/lib/walletProvider';

interface TicketInfo {
  ticketValue: number;
  expireAt: number;
  isUsed: boolean;
  usedInRound: number;
}

interface TicketNFTState {
  totalSupply: number;
  woverPrice: string;
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

    // Use read-only provider for queries
    return new Contract(ticketNFTAddress, TICKET_NFT_ABI, getReadProvider());
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
        setContractState(null);
        return null;
      }

      const [totalSupply, woverPrice] = await Promise.all([
        contract.totalSupply(),
        contract.woverPrice(),
      ]);

      const state: TicketNFTState = {
        totalSupply: totalSupply.toNumber(),
        woverPrice: ethers.utils.formatEther(woverPrice),
      };

      setContractState(state);
      return state;
    } catch (error) {
      console.error('Failed to fetch TicketNFT state:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getContract]);

  /**
   * Buy ticket with WOVER - uses universal signer (works with all wallet types)
   */
  const buyWithWover = useCallback(async (
    ticketValue: number
  ): Promise<{ tokenId: number; txHash: string }> => {
    // Get signer via universal method (handles WalletConnect, MetaMask, etc.)
    const signer = await getUniversalSigner();
    
    const contract = getContract(signer);
    if (!contract) throw new Error('TicketNFT not deployed');

    const woverPrice = await contract.woverPrice();
    
    console.log('[NFT DEBUG] woverPrice raw:', woverPrice.toString());
    console.log('[NFT DEBUG] woverPrice formatted:', ethers.utils.formatEther(woverPrice));
    
    if (woverPrice.isZero()) {
      console.error('[NFT ERROR] woverPrice is 0 - contract not configured!');
      throw new Error('NFT contract woverPrice is 0. Admin must set price first via Admin Panel.');
    }
    
    const requiredAmount = woverPrice.mul(ticketValue);
    
    console.log('[NFT] buyWithWover - ticketValue:', ticketValue, 'woverPrice:', ethers.utils.formatEther(woverPrice), 'requiredAmount:', ethers.utils.formatEther(requiredAmount));
    
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
      await approveTx.wait();
      console.log('[NFT] WOVER approved');
    }

    toast.info('Minting ticket NFT...');
    const tx = await contract.buyWithWover(ticketValue, { gasLimit: 500000 });
    console.log('[NFT] Mint tx sent:', tx.hash);
    
    const receipt = await tx.wait();
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
      await approveTx.wait();
    }

    toast.info('Minting ticket NFT...');
    const tx = await contract.buyWithUsdt(ticketValue, maxAmountWei, { gasLimit: 500000 });
    console.log('[NFT] USDT Mint tx sent:', tx.hash);
    
    const receipt = await tx.wait();
    
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
  const setWoverPrice = useCallback(async (signer: ethers.Signer, priceInWei: string) => {
    const contract = getContract(signer);
    if (!contract) throw new Error('TicketNFT not deployed');

    toast.info('Setting WOVER price...');
    const tx = await contract.setWoverPrice(priceInWei);
    await tx.wait();
    toast.success('WOVER price updated');
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
