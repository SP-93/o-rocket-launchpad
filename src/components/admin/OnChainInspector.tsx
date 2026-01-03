import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { getProxiedProvider, getRpcStatus } from '@/lib/rpcProvider';
import { getDeployedContracts } from '@/contracts/storage';
import { TICKET_NFT_ABI } from '@/contracts/artifacts/ticketNFT';
import GlowCard from '@/components/ui/GlowCard';
import { Button } from '@/components/ui/button';
import { Database, RefreshCw, Copy, ExternalLink, AlertTriangle, CheckCircle, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { NETWORK_CONFIG } from '@/config/admin';

interface OnChainState {
  address: string;
  totalSupply: number;
  chainId: number;
  blockNumber: number;
  owner: string;
  lastFetchedAt: string;
  rpcEndpoint: string;
  bytecodeLength: number;
  bytecodeHash: string;
}

const OnChainInspector = () => {
  const [state, setState] = useState<OnChainState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const fetchOnChainState = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorDetails(null);

    try {
      const contracts = getDeployedContracts();
      const ticketNFTAddress = (contracts as any).ticketNFT;
      
      if (!ticketNFTAddress) {
        setError('TicketNFT address not configured');
        setIsLoading(false);
        return;
      }

      console.log('[OnChainInspector] Fetching for address:', ticketNFTAddress);

      // Use proxied provider to bypass CORS
      const provider = getProxiedProvider();
      const rpcStatus = getRpcStatus();
      console.log('[OnChainInspector] Using RPC proxy, last direct RPC:', rpcStatus.endpoint);

      // First, get bytecode to verify contract exists
      const bytecode = await provider.getCode(ticketNFTAddress);
      if (bytecode === '0x' || bytecode.length < 10) {
        throw new Error(`No contract deployed at ${ticketNFTAddress}`);
      }

      const bytecodeLength = (bytecode.length - 2) / 2; // hex chars to bytes
      const bytecodeHash = ethers.utils.keccak256(bytecode).slice(0, 18) + '...';

      const contract = new ethers.Contract(ticketNFTAddress, TICKET_NFT_ABI, provider);
      
      // Only fetch totalSupply and owner - woverPrice removed (fixed 1 WOVER = 1 ticket)
      let totalSupply, owner;
      
      try {
        totalSupply = await contract.totalSupply();
      } catch (e: any) {
        console.error('[OnChainInspector] totalSupply() failed:', e);
        throw new Error(`totalSupply() reverted: ${e.reason || e.message || 'unknown'}`);
      }

      try {
        owner = await contract.owner();
      } catch (e: any) {
        console.warn('[OnChainInspector] owner() failed:', e);
        owner = 'unknown';
      }

      const [network, blockNumber] = await Promise.all([
        provider.getNetwork(),
        provider.getBlockNumber(),
      ]);

      setState({
        address: ticketNFTAddress,
        totalSupply: totalSupply.toNumber(),
        chainId: network.chainId,
        blockNumber,
        owner: typeof owner === 'string' ? owner : 'unknown',
        lastFetchedAt: new Date().toISOString().slice(11, 19),
        rpcEndpoint: 'Edge Proxy',
        bytecodeLength,
        bytecodeHash,
      });
      toast.success('On-chain state refreshed');
    } catch (err: any) {
      console.error('OnChainInspector error:', err);
      const rpcStatus = getRpcStatus();
      setError(err.message || 'Failed to fetch on-chain state');
      setErrorDetails(`Last RPC: ${rpcStatus.endpoint || 'none'} | Code: ${err.code || 'N/A'}`);
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
          On-Chain Inspector (RPC Proxy)
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
        <div className="space-y-1 mb-3">
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          {errorDetails && (
            <div className="text-[10px] text-muted-foreground font-mono px-2">
              {errorDetails}
            </div>
          )}
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

          {/* Pricing Info */}
          <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg">
            <span className="text-muted-foreground">Pricing:</span>
            <span className="font-bold text-primary">1 WOVER = 1 Ticket Value</span>
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

          {/* Bytecode Verification */}
          <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <span className="text-muted-foreground">Bytecode:</span>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px]">{state.bytecodeHash}</div>
              <div className="text-[9px] text-muted-foreground">{state.bytecodeLength} bytes</div>
            </div>
          </div>

          {/* RPC Info */}
          <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
            <span className="text-muted-foreground text-[10px]">Via:</span>
            <code className="font-mono text-[10px] text-muted-foreground truncate max-w-[200px]">
              {state.rpcEndpoint}
            </code>
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
          Click "Fetch" to read on-chain state via RPC Proxy (no wallet needed)
        </div>
      )}
    </GlowCard>
  );
};

export default OnChainInspector;