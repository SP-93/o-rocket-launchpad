import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '@/hooks/useWallet';
import { useTicketNFT } from '@/hooks/useTicketNFT';
import { getDeployedContracts, clearTicketNFTAddress, saveDeployedContract } from '@/contracts/storage';
import { TOKEN_ADDRESSES, NETWORK_CONFIG } from '@/config/admin';
import { 
  fetchTicketNFTAddressFromBackend, 
  saveTicketNFTAddressToBackend, 
  clearTicketNFTAddressFromBackend 
} from '@/lib/contractConfigSync';
import { getUniversalSigner } from '@/lib/walletProvider';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { 
  Ticket, ExternalLink, Copy, Trash2, Loader2, CheckCircle, 
  RefreshCw, AlertTriangle,
  Cloud, HardDrive, Download, Upload
} from 'lucide-react';
import { toast } from 'sonner';
import OnChainInspector from './OnChainInspector';

const FACTORY_WALLET = '0x8334966329b7f4b459633696a8ca59118253bc89';

const TicketNFTContractSection = () => {
  const { address, isConnected } = useWallet();
  const { 
    isDeploying, 
    deployTicketNFT, 
    fetchContractState, 
    contractState, 
    isLoading 
  } = useTicketNFT();
  
  const [localAddress, setLocalAddress] = useState<string | null>(null);
  const [backendAddress, setBackendAddress] = useState<string | null>(null);
  const [gasLimit, setGasLimit] = useState<number>(8_000_000);
  const [contractOwner, setContractOwner] = useState<string | null>(null);
  const [isSyncingBackend, setIsSyncingBackend] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [isRefreshingState, setIsRefreshingState] = useState(false);

  const addressMismatch = localAddress && backendAddress && 
    localAddress.toLowerCase() !== backendAddress.toLowerCase();

  // Get signer using universal method
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

  useEffect(() => {
    refreshAddresses();
  }, [refreshAddresses]);

  // Auto-pull from backend if local is missing but backend exists
  useEffect(() => {
    if (!localAddress && backendAddress) {
      saveDeployedContract('ticketNFT', backendAddress);
      setLocalAddress(backendAddress);
      toast.info('Contract address loaded from backend');
    }
  }, [localAddress, backendAddress]);

  // Fetch contract state when effective address is available (with retry)
  useEffect(() => {
    if (effectiveAddress) {
      // Fetch with retry logic
      const fetchWithRetry = async () => {
        for (let i = 0; i < 3; i++) {
          const state = await fetchContractState();
          if (state) {
            console.log('[TicketNFT] State loaded on attempt', i + 1);
            break;
          }
          if (i < 2) {
            console.log('[TicketNFT] Retry fetch in 1s...');
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      };
      fetchWithRetry();
      
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

          <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-primary">Fixed Pricing:</strong> 1 WOVER = 1 Ticket Value. 
                No price configuration needed.
              </span>
            </p>
          </div>
        </div>
      ) : (
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

          {/* Last TX Hash */}
          {lastTxHash && (
            <div className="flex items-center gap-2 text-xs bg-background/30 rounded p-2">
              <span className="text-muted-foreground">Last TX:</span>
              <code className="font-mono text-primary">{truncateAddress(lastTxHash)}</code>
              <a
                href={`${NETWORK_CONFIG.blockExplorerUrls[0]}/tx/${lastTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Contract State - Simplified */}
          <div className="bg-background/50 rounded-lg p-4 border border-border/30">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">Contract State</h4>
              <button
                onClick={() => fetchContractState()}
                className="text-muted-foreground hover:text-primary p-1"
                disabled={isLoading || isRefreshingState}
              >
                <RefreshCw className={`w-4 h-4 ${(isLoading || isRefreshingState) ? 'animate-spin' : ''}`} />
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
                    <span className="text-xs text-muted-foreground">Ticket Pricing:</span>
                    <p className="text-lg font-bold text-primary">1 WOVER = 1 Value</p>
                  </div>
                </div>

                {/* Fixed Pricing Info */}
                <div className="rounded-lg p-3 bg-primary/10 border border-primary/30">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-xs text-primary font-medium">
                      Fixed pricing: Ticket value 5 = 5 WOVER
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
          </div>

          {/* On-Chain Inspector - Independent RPC Read */}
          <OnChainInspector />
        </div>
      )}
    </GlowCard>
  );
};

export default TicketNFTContractSection;