import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { getProviderSync } from '@/lib/rpcProvider';
import { getDeployedContracts } from '@/contracts/storage';
import { TICKET_NFT_ABI } from '@/contracts/artifacts/ticketNFT';
import GlowCard from '@/components/ui/GlowCard';
import { Button } from '@/components/ui/button';
import { Database, RefreshCw, Copy, ExternalLink, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { NETWORK_CONFIG } from '@/config/admin';

interface OnChainState {
  address: string;
  woverPrice: string;
  woverPriceFormatted: string;
  totalSupply: number;
  chainId: number;
  blockNumber: number;
  owner: string;
  lastFetchedAt: string;
}

const OnChainInspector = () => {
  const [state, setState] = useState<OnChainState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOnChainState = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const contracts = getDeployedContracts();
      const ticketNFTAddress = (contracts as any).ticketNFT;
      
      if (!ticketNFTAddress) {
        setError('TicketNFT address not configured');
        return;
      }

      // Use stable RPC provider (no MetaMask dependency)
      const provider = getProviderSync();
      const contract = new ethers.Contract(ticketNFTAddress, TICKET_NFT_ABI, provider);
      
      // Fetch all data in parallel
      const [woverPrice, totalSupply, owner, network, blockNumber] = await Promise.all([
        contract.woverPrice(),
        contract.totalSupply(),
        contract.owner().catch(() => 'unknown'),
        provider.getNetwork(),
        provider.getBlockNumber(),
      ]);

      setState({
        address: ticketNFTAddress,
        woverPrice: woverPrice.toString(),
        woverPriceFormatted: ethers.utils.formatEther(woverPrice),
        totalSupply: totalSupply.toNumber(),
        chainId: network.chainId,
        blockNumber,
        owner: typeof owner === 'string' ? owner : 'unknown',
        lastFetchedAt: new Date().toISOString().slice(11, 19),
      });

      toast.success('On-chain state refreshed');
    } catch (err: any) {
      console.error('OnChainInspector error:', err);
      setError(err.message || 'Failed to fetch on-chain state');
      toast.error('Failed to fetch on-chain state');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied');
  };

  const truncateAddress = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-6)}`;

  return (
    <GlowCard className="p-4" glowColor="cyan">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold flex items-center gap-2 text-sm">
          <Database className="w-4 h-4 text-cyan-400" />
          On-Chain Inspector (RPC Read)
        </h4>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchOnChainState}
          disabled={isLoading}
          className="h-7 text-xs"
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Fetch
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-lg mb-3">
          <AlertTriangle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {state ? (
        <div className="space-y-2 text-xs">
          {/* Contract Address */}
          <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
            <span className="text-muted-foreground">Contract:</span>
            <div className="flex items-center gap-1">
              <code className="font-mono">{truncateAddress(state.address)}</code>
              <button onClick={() => copyToClipboard(state.address)} className="p-0.5 hover:text-primary">
                <Copy className="w-3 h-3" />
              </button>
              <a 
                href={`${NETWORK_CONFIG.blockExplorerUrls[0]}/address/${state.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-0.5 hover:text-primary"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* WOVER Price */}
          <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
            <span className="text-muted-foreground">woverPrice():</span>
            <div className="flex items-center gap-2">
              <code className="font-mono text-primary font-bold">${state.woverPriceFormatted}</code>
              {parseFloat(state.woverPriceFormatted) === 0 && (
                <AlertTriangle className="w-3.5 h-3.5 text-warning" />
              )}
            </div>
          </div>

          {/* Raw Price */}
          <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
            <span className="text-muted-foreground">Raw (wei):</span>
            <code className="font-mono text-[10px] text-muted-foreground">{state.woverPrice}</code>
          </div>

          {/* Total Supply */}
          <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
            <span className="text-muted-foreground">totalSupply():</span>
            <span className="font-bold">{state.totalSupply}</span>
          </div>

          {/* Owner */}
          <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
            <span className="text-muted-foreground">owner():</span>
            <code className="font-mono">{truncateAddress(state.owner)}</code>
          </div>

          {/* Chain Info */}
          <div className="flex items-center justify-between p-2 bg-success/10 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-success" />
              <span className="text-muted-foreground">Chain {state.chainId}</span>
            </div>
            <span className="text-muted-foreground">Block #{state.blockNumber} @ {state.lastFetchedAt}</span>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-xs text-muted-foreground">
          Click "Fetch" to read on-chain state via RPC (no wallet needed)
        </div>
      )}
    </GlowCard>
  );
};

export default OnChainInspector;
