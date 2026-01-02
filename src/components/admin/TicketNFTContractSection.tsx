import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '@/hooks/useWallet';
import { useTicketNFT } from '@/hooks/useTicketNFT';
import { useCoinGeckoPrice } from '@/hooks/useCoinGeckoPrice';
import { useDexPrice } from '@/hooks/useDexPrice';
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
  DollarSign, RefreshCw, TrendingUp, AlertTriangle, AlertCircle,
  Cloud, HardDrive, Download, Upload, Coins
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
  const { dexPrice, isLoading: dexLoading, error: dexError, refetch: refetchDexPrice } = useDexPrice();
  
  const [localAddress, setLocalAddress] = useState<string | null>(null);
  const [backendAddress, setBackendAddress] = useState<string | null>(null);
  const [gasLimit, setGasLimit] = useState<number>(8_000_000);
  const [newPriceUSD, setNewPriceUSD] = useState<string>('0.008');
  const [isSettingPrice, setIsSettingPrice] = useState(false);
  const [contractOwner, setContractOwner] = useState<string | null>(null);
  const [isSyncingBackend, setIsSyncingBackend] = useState(false);
  const [isSyncingDex, setIsSyncingDex] = useState(false);
  const [isSyncingCex, setIsSyncingCex] = useState(false);

  // Use DEX price as primary, CEX as fallback
  const primaryPrice = dexPrice || cexPrice || 0;
  const primaryPriceSource = dexPrice ? 'DEX' : 'CEX';
  
  // Calculate price deviation from contract
  const contractPriceNum = contractState?.woverPrice ? parseFloat(contractState.woverPrice) : 0;
  const priceDeviation = contractPriceNum > 0 && primaryPrice > 0 
    ? ((primaryPrice - contractPriceNum) / contractPriceNum) * 100 
    : 0;
  const isPriceOutdated = Math.abs(priceDeviation) > 5; // 5% threshold
  const isPriceZero = contractPriceNum === 0;

  // Sync to DEX price (primary - on-chain)
  const handleSyncToDex = async () => {
    if (!dexPrice || dexPrice <= 0) {
      toast.error('DEX price not available');
      return;
    }
    
    let signer: ethers.Signer;
    try {
      signer = await getUniversalSigner();
    } catch {
      toast.error('Please connect your wallet');
      return;
    }

    setIsSyncingDex(true);
    try {
      const priceWei = ethers.utils.parseEther(dexPrice.toFixed(8));
      await setWoverPrice(signer, priceWei.toString());
      await fetchContractState();
      toast.success(`Price synced to DEX: $${dexPrice.toFixed(6)}`);
    } catch (error: any) {
      console.error('Failed to sync to DEX:', error);
      toast.error('Failed to sync: ' + (error.reason || error.message));
    } finally {
      setIsSyncingDex(false);
    }
  };

  // Sync to CEX price (secondary - CoinGecko)
  const handleSyncToCex = async () => {
    if (!cexPrice || cexPrice <= 0) {
      toast.error('CEX price not available');
      return;
    }
    
    let signer: ethers.Signer;
    try {
      signer = await getUniversalSigner();
    } catch {
      toast.error('Please connect your wallet');
      return;
    }

    setIsSyncingCex(true);
    try {
      const priceWei = ethers.utils.parseEther(cexPrice.toFixed(6));
      await setWoverPrice(signer, priceWei.toString());
      await fetchContractState();
      toast.success(`Price synced to CEX: $${cexPrice.toFixed(6)}`);
    } catch (error: any) {
      console.error('Failed to sync to CEX:', error);
      toast.error('Failed to sync: ' + (error.reason || error.message));
    } finally {
      setIsSyncingCex(false);
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

                {/* CRITICAL WARNING: Price is Zero */}
                {isPriceZero && (
                  <div className="rounded-lg p-4 bg-destructive/20 border-2 border-destructive animate-pulse">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-6 h-6 text-destructive flex-shrink-0" />
                      <div>
                        <h5 className="font-bold text-destructive">CRITICAL: NFT Tickets DISABLED!</h5>
                        <p className="text-xs text-muted-foreground mt-1">
                          WOVER price is $0.00 - NFT ticket purchases will NOT work until you set a price.
                          Click "Sync to DEX" below to enable NFT tickets.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* DEX Price (On-chain) - PRIMARY */}
                <div className={`rounded-lg p-3 border ${dexPrice && dexPrice > 0 ? 'bg-success/10 border-success/30' : 'bg-muted/20 border-border/30'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-success" />
                      <span className="text-xs text-muted-foreground">DEX Price (On-chain):</span>
                      <span className="text-sm font-bold text-success">
                        {dexLoading ? '...' : dexPrice ? `$${dexPrice.toFixed(8)}` : 'N/A'}
                      </span>
                      {dexError && <span className="text-xs text-destructive">(Error)</span>}
                    </div>
                    <NeonButton
                      variant="primary"
                      size="sm"
                      className="text-xs px-3 py-1"
                      onClick={handleSyncToDex}
                      disabled={isSyncingDex || dexLoading || !dexPrice || !isOwner}
                    >
                      {isSyncingDex ? (
                        <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Syncing...</>
                      ) : (
                        <><RefreshCw className="w-3 h-3 mr-1" /> Sync to DEX</>
                      )}
                    </NeonButton>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Recommended - Uses WOVER/USDT pool on Over Protocol</p>
                </div>

                {/* CEX Price (CoinGecko) - SECONDARY */}
                <div className="rounded-lg p-3 border bg-muted/10 border-border/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">CEX Price (CoinGecko):</span>
                      <span className="text-sm font-semibold">
                        {cexLoading ? '...' : cexPrice ? `$${cexPrice.toFixed(6)}` : 'N/A'}
                      </span>
                    </div>
                    <NeonButton
                      variant="secondary"
                      size="sm"
                      className="text-xs px-3 py-1"
                      onClick={handleSyncToCex}
                      disabled={isSyncingCex || cexLoading || !cexPrice || !isOwner}
                    >
                      {isSyncingCex ? (
                        <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Syncing...</>
                      ) : (
                        <><RefreshCw className="w-3 h-3 mr-1" /> Sync to CEX</>
                      )}
                    </NeonButton>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Alternative - Uses OVER price from CoinGecko API</p>
                </div>

                {/* Price Deviation Warning */}
                {isPriceOutdated && contractPriceNum > 0 && (
                  <div className="rounded-lg p-3 bg-warning/10 border border-warning/30">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-warning" />
                      <span className="text-xs text-warning font-medium">
                        Contract price outdated by {priceDeviation >= 0 ? '+' : ''}{priceDeviation.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
          </div>

          {/* Set WOVER Price Manually (Owner Only) */}
          {isOwner && (
            <div className="bg-primary/5 rounded-lg p-4 border border-primary/30">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                Set WOVER Price Manually
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
                    refetchDexPrice();
                    refetchCexPrice();
                    if (dexPrice && dexPrice > 0) {
                      setNewPriceUSD(dexPrice.toFixed(8));
                      toast.success(`Fetched DEX price: $${dexPrice.toFixed(8)}`);
                    } else if (cexPrice && cexPrice > 0) {
                      setNewPriceUSD(cexPrice.toFixed(6));
                      toast.success(`Fetched CEX price: $${cexPrice.toFixed(6)}`);
                    }
                  }}
                  disabled={dexLoading && cexLoading}
                >
                  <TrendingUp className="w-3 h-3 mr-1" /> Fetch Prices
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