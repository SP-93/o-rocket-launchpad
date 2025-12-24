import { useState, useCallback } from 'react';
import { ethers, Contract, ContractFactory } from 'ethers';
import { toast } from 'sonner';
import { TICKET_NFT_ABI, TICKET_NFT_BYTECODE } from '@/contracts/artifacts/ticketNFT';
import { getDeployedContracts, saveDeployedContract } from '@/contracts/storage';
import { TOKEN_ADDRESSES } from '@/config/admin';

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

    const provider = new ethers.providers.JsonRpcProvider('https://rpc.overprotocol.com');
    return new Contract(ticketNFTAddress, TICKET_NFT_ABI, provider);
  }, []);

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
      // Using factory wallet as price oracle for manual price mode
      const contract = await factory.deploy(
        TOKEN_ADDRESSES.WOVER,
        TOKEN_ADDRESSES.USDT,
        FACTORY_WALLET,
        FACTORY_WALLET, // priceOracle = factory wallet for manual price
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

      // Save to storage (extend DeployedContracts type)
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

  const buyWithWover = useCallback(async (
    signer: ethers.Signer,
    ticketValue: number
  ): Promise<number> => {
    const contract = getContract(signer);
    if (!contract) throw new Error('TicketNFT not deployed');

    const amountWei = ethers.utils.parseEther(ticketValue.toString());
    
    // First approve WOVER transfer
    const woverContract = new Contract(
      TOKEN_ADDRESSES.WOVER,
      ['function approve(address,uint256) returns (bool)', 'function allowance(address,address) view returns (uint256)'],
      signer
    );

    const signerAddress = await signer.getAddress();
    const allowance = await woverContract.allowance(signerAddress, contract.address);
    
    if (allowance.lt(amountWei)) {
      toast.info('Approving WOVER...');
      const approveTx = await woverContract.approve(contract.address, ethers.constants.MaxUint256);
      await approveTx.wait();
    }

    toast.info('Minting ticket NFT...');
    const tx = await contract.buyWithWover(ticketValue, { gasLimit: 500000 });
    const receipt = await tx.wait();

    // Find TicketMinted event to get tokenId
    const mintEvent = receipt.events?.find((e: any) => e.event === 'TicketMinted');
    const tokenId = mintEvent?.args?.tokenId?.toNumber() ?? 0;

    toast.success(`Ticket #${tokenId} minted!`);
    return tokenId;
  }, [getContract]);

  const buyWithUsdt = useCallback(async (
    signer: ethers.Signer,
    ticketValue: number,
    maxAmount: string
  ): Promise<number> => {
    const contract = getContract(signer);
    if (!contract) throw new Error('TicketNFT not deployed');

    const maxAmountWei = ethers.utils.parseEther(maxAmount);
    
    // First approve USDT transfer
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
    const receipt = await tx.wait();

    const mintEvent = receipt.events?.find((e: any) => e.event === 'TicketMinted');
    const tokenId = mintEvent?.args?.tokenId?.toNumber() ?? 0;

    toast.success(`Ticket #${tokenId} minted!`);
    return tokenId;
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
