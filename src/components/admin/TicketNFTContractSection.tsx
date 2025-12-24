import { useState, useEffect, useCallback } from 'react';
import { ethers, providers } from 'ethers';
import { useWallet } from '@/hooks/useWallet';
import { useTicketNFT } from '@/hooks/useTicketNFT';
import { useCoinGeckoPrice } from '@/hooks/useCoinGeckoPrice';
import { getDeployedContracts, clearTicketNFTAddress } from '@/contracts/storage';
import { TOKEN_ADDRESSES, NETWORK_CONFIG } from '@/config/admin';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { 
  Ticket, ExternalLink, Copy, Trash2, Loader2, CheckCircle, 
  DollarSign, RefreshCw, TrendingUp, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

const FACTORY_WALLET = '0x8334966329b7f4b459633696a8ca59118253bc89';

const TicketNFTContractSection = () => {
  const { address, isConnected } = useWallet();
  const { 
    isDeploying, 
    deployTicketNFT, 
    fetchContractState, 
    contractState, 
    setWoverPrice,
    isLoading 
  } = useTicketNFT();
  const { price: cexPrice, loading: cexLoading, refetch: refetchCexPrice } = useCoinGeckoPrice();
  
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [gasLimit, setGasLimit] = useState<number>(8_000_000);
  const [newPriceUSD, setNewPriceUSD] = useState<string>('0.008');
  const [isSettingPrice, setIsSettingPrice] = useState(false);
  const [contractOwner, setContractOwner] = useState<string | null>(null);

  // Get signer from window.ethereum
  const getSigner = useCallback(async (): Promise<ethers.Signer | null> => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      return null;
    }
    try {
      const provider = new providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();
      return signer;
    } catch {
      return null;
    }
  }, []);

  // Load contract address
  const refreshContractAddress = useCallback(() => {
    const contracts = getDeployedContracts();
    setContractAddress(contracts.ticketNFT || null);
  }, []);

  useEffect(() => {
    refreshContractAddress();
  }, [refreshContractAddress]);

  // Fetch contract state when address is available
  useEffect(() => {
    if (contractAddress) {
      fetchContractState();
      // Fetch owner
      const fetchOwner = async () => {
        try {
          const provider = new ethers.providers.JsonRpcProvider('https://rpc.overprotocol.com');
          const contract = new ethers.Contract(
            contractAddress,
            ['function owner() view returns (address)'],
            provider
          );
          const owner = await contract.owner();
          setContractOwner(owner);
        } catch (error) {
          console.error('Failed to fetch owner:', error);
        }
      };
      fetchOwner();
    }
  }, [contractAddress, fetchContractState]);

  const handleDeploy = async () => {
    const signer = await getSigner();
    if (!signer) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      const deployedAddress = await deployTicketNFT(signer, { gasLimit });
      if (deployedAddress) {
        setContractAddress(deployedAddress);
        fetchContractState();
      }
    } catch (error) {
      console.error('Deploy failed:', error);
    }
  };

  const handleClearAddress = () => {
    if (confirm('Clear TicketNFT address? This will allow you to deploy a new contract.')) {
      clearTicketNFTAddress();
      setContractAddress(null);
      setContractOwner(null);
      toast.success('TicketNFT address cleared');
    }
  };

  const handleSetPrice = async () => {
    const signer = await getSigner();
    if (!signer) {
      toast.error('Please connect your wallet');
      return;
    }

    const priceUSD = parseFloat(newPriceUSD);
    if (isNaN(priceUSD) || priceUSD <= 0) {
      toast.error('Invalid price');
      return;
    }

    setIsSettingPrice(true);
    try {
      // Convert USD price to wei (18 decimals)
      // woverPrice is stored as the USD value per 1 WOVER in wei format
      // e.g., $0.008 = 8000000000000000 wei (0.008 * 1e18)
      const priceWei = ethers.utils.parseEther(priceUSD.toString());
      await setWoverPrice(signer, priceWei.toString());
      await fetchContractState();
    } catch (error: any) {
      console.error('Failed to set price:', error);
      toast.error('Failed to set price: ' + (error.reason || error.message));
    } finally {
      setIsSettingPrice(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const isOwner = address && contractOwner && address.toLowerCase() === contractOwner.toLowerCase();

  return (
    <GlowCard className="p-6" glowColor="pink">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Ticket className="w-5 h-5 text-pink-400" />
          RocketTicketNFT Contract
        </h3>
        {contractAddress && (
          <button 
            onClick={handleClearAddress}
            className="text-destructive hover:text-destructive/80 p-2 rounded-lg hover:bg-destructive/10 transition-colors"
            title="Clear address for redeploy"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {!contractAddress ? (
        // Not deployed - show deployment UI
        <div className="space-y-4">
          <div className="bg-background/50 rounded-lg p-4 border border-border/30">
            <h4 className="text-sm font-semibold mb-3">Constructor Arguments</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">WOVER Token:</span>
                <code className="block font-mono text-primary mt-1 truncate">{truncateAddress(TOKEN_ADDRESSES.WOVER)}</code>
              </div>
              <div>
                <span className="text-muted-foreground">USDT Token:</span>
                <code className="block font-mono text-primary mt-1 truncate">{truncateAddress(TOKEN_ADDRESSES.USDT)}</code>
              </div>
              <div>
                <span className="text-muted-foreground">Factory Wallet:</span>
                <code className="block font-mono text-primary mt-1 truncate">{truncateAddress(FACTORY_WALLET)}</code>
              </div>
              <div>
                <span className="text-muted-foreground">Price Oracle:</span>
                <code className="block font-mono text-primary mt-1 truncate">{truncateAddress(FACTORY_WALLET)}</code>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground block mb-1">Gas Limit</label>
              <input
                type="number"
                value={gasLimit}
                onChange={(e) => setGasLimit(Number(e.target.value))}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <NeonButton
              variant="primary"
              className="px-6 py-2 mt-5"
              onClick={handleDeploy}
              disabled={isDeploying || !isConnected}
            >
              {isDeploying ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deploying...</>
              ) : (
                <><Ticket className="w-4 h-4 mr-2" /> Deploy</>
              )}
            </NeonButton>
          </div>

          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-warning">Deploy Order:</strong> Deploy TicketNFT first, then CrashGame. 
                After deployment, set the WOVER price based on CoinGecko.
              </span>
            </p>
          </div>
        </div>
      ) : (
        // Deployed - show contract info and management
        <div className="space-y-4">
          {/* Contract Address */}
          <div className="flex items-center gap-2 bg-success/10 rounded-lg p-3">
            <CheckCircle className="w-4 h-4 text-success" />
            <span className="text-sm font-medium text-success">Deployed</span>
            <code className="flex-1 text-xs font-mono text-muted-foreground truncate ml-2">
              {contractAddress}
            </code>
            <button onClick={() => copyToClipboard(contractAddress)} className="text-muted-foreground hover:text-primary">
              <Copy className="w-3.5 h-3.5" />
            </button>
            <a
              href={`${NETWORK_CONFIG.blockExplorerUrls[0]}/address/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Contract Owner */}
          {contractOwner && (
            <div className="bg-background/50 rounded-lg p-3 border border-border/30">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Owner:</span>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono">{truncateAddress(contractOwner)}</code>
                  {isOwner && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">You</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Contract State */}
          <div className="bg-background/50 rounded-lg p-4 border border-border/30">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">Contract State</h4>
              <button
                onClick={() => fetchContractState()}
                className="text-muted-foreground hover:text-primary p-1"
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            {contractState ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">Total Supply:</span>
                  <p className="text-lg font-bold text-primary">{contractState.totalSupply}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">WOVER Price:</span>
                  <p className="text-lg font-bold text-primary">${contractState.woverPrice}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
          </div>

          {/* Set WOVER Price (Owner Only) */}
          {isOwner && (
            <div className="bg-primary/5 rounded-lg p-4 border border-primary/30">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                Set WOVER Price
              </h4>
              
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground block mb-1">Price (USD)</label>
                  <input
                    type="text"
                    value={newPriceUSD}
                    onChange={(e) => setNewPriceUSD(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                    placeholder="0.008"
                  />
                </div>
                <NeonButton
                  variant="secondary"
                  className="text-xs px-3 py-2 mt-5"
                  onClick={() => {
                    refetchCexPrice();
                    if (cexPrice > 0) {
                      setNewPriceUSD(cexPrice.toFixed(6));
                      toast.success(`Fetched price: $${cexPrice.toFixed(6)}`);
                    }
                  }}
                  disabled={cexLoading}
                >
                  <TrendingUp className="w-3 h-3 mr-1" /> Fetch CEX
                </NeonButton>
              </div>
              
              <NeonButton
                variant="primary"
                className="w-full py-2"
                onClick={handleSetPrice}
                disabled={isSettingPrice || !newPriceUSD}
              >
                {isSettingPrice ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Setting Price...</>
                ) : (
                  <><DollarSign className="w-4 h-4 mr-2" /> Update Price</>
                )}
              </NeonButton>
            </div>
          )}
        </div>
      )}
    </GlowCard>
  );
};

export default TicketNFTContractSection;
