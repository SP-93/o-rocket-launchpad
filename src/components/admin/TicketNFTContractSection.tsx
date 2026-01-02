import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '@/hooks/useWallet';
import { useTicketNFT } from '@/hooks/useTicketNFT';
import { useCoinGeckoPrice } from '@/hooks/useCoinGeckoPrice';
import { getDeployedContracts, clearTicketNFTAddress, saveDeployedContract } from '@/contracts/storage';
import { TOKEN_ADDRESSES, NETWORK_CONFIG } from '@/config/admin';
import { 
  fetchTicketNFTAddressFromBackend, 
  saveTicketNFTAddressToBackend, 
  clearTicketNFTAddressFromBackend 
} from '@/lib/contractConfigSync';
import { getUniversalSigner, getReadProvider } from '@/lib/walletProvider';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { 
  Ticket, ExternalLink, Copy, Trash2, Loader2, CheckCircle, 
  DollarSign, RefreshCw, TrendingUp, AlertTriangle,
  Cloud, HardDrive, Download, Upload
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
  const { price: marketPrice, loading: marketLoading, refetch: refetchMarketPrice } = useCoinGeckoPrice();
  
  const [localAddress, setLocalAddress] = useState<string | null>(null);
  const [backendAddress, setBackendAddress] = useState<string | null>(null);
  const [gasLimit, setGasLimit] = useState<number>(8_000_000);
  const [newPriceUSD, setNewPriceUSD] = useState<string>('0.008');
  const [isSettingPrice, setIsSettingPrice] = useState(false);
  const [contractOwner, setContractOwner] = useState<string | null>(null);
  const [isSyncingBackend, setIsSyncingBackend] = useState(false);
  const [isSyncingMarket, setIsSyncingMarket] = useState(false);

  // Calculate price deviation
  const contractPriceNum = contractState?.woverPrice ? parseFloat(contractState.woverPrice) : 0;
  const priceDeviation = contractPriceNum > 0 && marketPrice > 0 
    ? ((marketPrice - contractPriceNum) / contractPriceNum) * 100 
    : 0;
  const isPriceOutdated = Math.abs(priceDeviation) > 5; // 5% threshold

  // One-click sync to market price
  const handleSyncToMarket = async () => {
    if (!marketPrice || marketPrice <= 0) {
      toast.error('Market price not available');
      return;
    }
    
    let signer: ethers.Signer;
    try {
      signer = await getUniversalSigner();
    } catch {
      toast.error('Please connect your wallet');
      return;
    }

    setIsSyncingMarket(true);
    try {
      const priceWei = ethers.utils.parseEther(marketPrice.toFixed(6));
      await setWoverPrice(signer, priceWei.toString());
      await fetchContractState();
      toast.success(`Price synced to $${marketPrice.toFixed(6)}`);
    } catch (error: any) {
      console.error('Failed to sync price:', error);
      toast.error('Failed to sync: ' + (error.reason || error.message));
    } finally {
      setIsSyncingMarket(false);
    }
  };

  const addressMismatch = localAddress && backendAddress && 
    localAddress.toLowerCase() !== backendAddress.toLowerCase();

  // Get signer using universal method (works with WalletConnect, MetaMask, etc.)
  const getSigner = useCallback(async (): Promise<ethers.Signer | null> => {
    try {
      return await getUniversalSigner();
    } catch {
      return null;
    }
  }, []);

  // Load addresses
  const refreshAddresses = useCallback(async () => {
    const contracts = getDeployedContracts();
    setLocalAddress(contracts.ticketNFT || null);
    
    const backend = await fetchTicketNFTAddressFromBackend();
    setBackendAddress(backend);
  }, []);

  // Effective address: prefer local, fallback to backend
  const effectiveAddress = localAddress || backendAddress;
  const usingBackendOnly = !localAddress && !!backendAddress;

  useEffect(() => {
    refreshAddresses();
  }, [refreshAddresses]);

  // Auto-pull from backend if local is missing but backend exists
  useEffect(() => {
    if (!localAddress && backendAddress) {
      // Auto-set local from backend for seamless experience
      saveDeployedContract('ticketNFT', backendAddress);
      setLocalAddress(backendAddress);
      toast.info('Contract address loaded from backend');
    }
  }, [localAddress, backendAddress]);

  // Fetch contract state when effective address is available
  useEffect(() => {
    if (effectiveAddress) {
      fetchContractState();
      // Fetch owner
      const fetchOwner = async () => {
        try {
          const provider = new ethers.providers.JsonRpcProvider('https://rpc.overprotocol.com');
          const contract = new ethers.Contract(
            effectiveAddress,
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
  }, [effectiveAddress, fetchContractState]);

  const handleDeploy = async () => {
    const signer = await getSigner();
    if (!signer) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      const deployedAddress = await deployTicketNFT(signer, { gasLimit });
      if (deployedAddress) {
        setLocalAddress(deployedAddress);
        fetchContractState();
        
        // Auto-save to backend
        await saveTicketNFTAddressToBackend(deployedAddress);
        setBackendAddress(deployedAddress);
        toast.success('Contract synced to backend');
      }
    } catch (error) {
      console.error('Deploy failed:', error);
    }
  };

  const handleClearLocal = () => {
    if (confirm('Clear local TicketNFT address?')) {
      clearTicketNFTAddress();
      setLocalAddress(null);
      setContractOwner(null);
      toast.success('Local address cleared');
    }
  };

  const handleClearBackend = async () => {
    if (confirm('Clear TicketNFT address from backend?')) {
      setIsSyncingBackend(true);
      try {
        await clearTicketNFTAddressFromBackend();
        setBackendAddress(null);
        toast.success('Backend address cleared');
      } catch (error) {
        toast.error('Failed to clear backend');
      } finally {
        setIsSyncingBackend(false);
      }
    }
  };

  const handlePushToBackend = async () => {
    if (!localAddress) return;
    setIsSyncingBackend(true);
    try {
      await saveTicketNFTAddressToBackend(localAddress);
      setBackendAddress(localAddress);
      toast.success('Pushed to backend');
    } catch (error) {
      toast.error('Failed to push');
    } finally {
      setIsSyncingBackend(false);
    }
  };

  const handlePullFromBackend = () => {
    if (!backendAddress) return;
    if (confirm('Use backend address for local?')) {
      saveDeployedContract('ticketNFT', backendAddress);
      setLocalAddress(backendAddress);
      toast.success('Pulled from backend');
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
          {addressMismatch && (
            <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full">
              Mismatch
            </span>
          )}
        </h3>
      </div>

      {/* Address Sync Panel */}
      <div className="mb-4 space-y-2">
        {/* Local Address */}
        <div className="flex items-center gap-2 text-xs bg-background/50 rounded-lg p-2 border border-border/30">
          <HardDrive className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground w-20">Local:</span>
          <code className="flex-1 font-mono truncate">
            {localAddress || <span className="text-muted-foreground">Not set</span>}
          </code>
          {localAddress && (
            <button onClick={handleClearLocal} className="text-destructive hover:text-destructive/80 p-1">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
        
        {/* Backend Address */}
        <div className="flex items-center gap-2 text-xs bg-background/50 rounded-lg p-2 border border-border/30">
          <Cloud className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground w-20">Backend:</span>
          <code className="flex-1 font-mono truncate">
            {backendAddress || <span className="text-muted-foreground">Not set</span>}
          </code>
          {backendAddress && (
            <button onClick={handleClearBackend} disabled={isSyncingBackend} className="text-destructive hover:text-destructive/80 p-1">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Sync Buttons */}
        {(localAddress || backendAddress) && (
          <div className="flex gap-2">
            {localAddress && !backendAddress && (
              <NeonButton variant="secondary" size="sm" onClick={handlePushToBackend} disabled={isSyncingBackend} className="text-xs flex-1">
                <Upload className="w-3 h-3 mr-1" /> Push to Backend
              </NeonButton>
            )}
            {backendAddress && !localAddress && (
              <NeonButton variant="secondary" size="sm" onClick={handlePullFromBackend} disabled={isSyncingBackend} className="text-xs flex-1">
                <Download className="w-3 h-3 mr-1" /> Pull from Backend
              </NeonButton>
            )}
            {addressMismatch && (
              <>
                <NeonButton variant="secondary" size="sm" onClick={handlePushToBackend} disabled={isSyncingBackend} className="text-xs flex-1">
                  <Upload className="w-3 h-3 mr-1" /> Push Local
                </NeonButton>
                <NeonButton variant="secondary" size="sm" onClick={handlePullFromBackend} disabled={isSyncingBackend} className="text-xs flex-1">
                  <Download className="w-3 h-3 mr-1" /> Use Backend
                </NeonButton>
              </>
            )}
          </div>
        )}
      </div>

      {!localAddress ? (
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
              {localAddress}
            </code>
            <button onClick={() => copyToClipboard(localAddress)} className="text-muted-foreground hover:text-primary">
              <Copy className="w-3.5 h-3.5" />
            </button>
            <a
              href={`${NETWORK_CONFIG.blockExplorerUrls[0]}/address/${localAddress}`}
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
              <div className="space-y-3">
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

                {/* Market Price Comparison */}
                <div className={`rounded-lg p-3 border ${isPriceOutdated ? 'bg-warning/10 border-warning/30' : 'bg-success/10 border-success/30'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className={`w-4 h-4 ${isPriceOutdated ? 'text-warning' : 'text-success'}`} />
                      <span className="text-xs text-muted-foreground">Market Price:</span>
                      <span className="text-sm font-semibold">
                        {marketLoading ? '...' : `$${marketPrice.toFixed(6)}`}
                      </span>
                      {!marketLoading && contractPriceNum > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          isPriceOutdated 
                            ? 'bg-warning/20 text-warning' 
                            : 'bg-success/20 text-success'
                        }`}>
                          {priceDeviation >= 0 ? '+' : ''}{priceDeviation.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    
                    {isPriceOutdated && isOwner && (
                      <NeonButton
                        variant="primary"
                        size="sm"
                        className="text-xs px-3 py-1"
                        onClick={handleSyncToMarket}
                        disabled={isSyncingMarket || marketLoading}
                      >
                        {isSyncingMarket ? (
                          <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Syncing...</>
                        ) : (
                          <><RefreshCw className="w-3 h-3 mr-1" /> Sync to Market</>
                        )}
                      </NeonButton>
                    )}
                  </div>
                  
                  {isPriceOutdated && (
                    <p className="text-xs text-warning mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Price outdated by more than 5%
                    </p>
                  )}
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
                    refetchMarketPrice();
                    if (marketPrice > 0) {
                      setNewPriceUSD(marketPrice.toFixed(6));
                      toast.success(`Fetched price: $${marketPrice.toFixed(6)}`);
                    }
                  }}
                  disabled={marketLoading}
                >
                  <TrendingUp className="w-3 h-3 mr-1" /> Fetch Market
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