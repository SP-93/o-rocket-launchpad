import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '@/hooks/useWallet';
import { useCoinGeckoPrice } from '@/hooks/useCoinGeckoPrice';
import { getDeployedContracts, getDeployedPools } from '@/contracts/storage';
import { TOKEN_ADDRESSES, NETWORK_CONFIG, FEE_TIERS } from '@/config/admin';
import { sqrtPriceX96ToPrice, getTokenDecimals } from '@/lib/priceUtils';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { 
  CheckCircle, XCircle, AlertTriangle, ExternalLink, RefreshCw, 
  Loader2, Copy, TrendingUp, TrendingDown, ShieldCheck, Info
} from 'lucide-react';
import { toast } from 'sonner';

// Minimal Pool ABI for slot0 and tokens
const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function fee() view returns (uint24)',
  'function liquidity() view returns (uint128)',
];

interface PoolData {
  name: string;
  address: string;
  token0: string;
  token1: string;
  fee: number;
  sqrtPriceX96: string;
  price: number;
  liquidity: string;
  loading: boolean;
  error: string | null;
}

const PRICE_DEVIATION_THRESHOLD = 5; // 5% deviation warning

// Get ethers provider from window.ethereum
const getProvider = () => {
  const win = window as any;
  if (typeof window !== 'undefined' && win.ethereum) {
    return new ethers.providers.Web3Provider(win.ethereum);
  }
  return null;
};

export const PoolVerification = () => {
  const { isConnected } = useWallet();
  const { price: cexPrice, change24h: cexChange, loading: cexLoading, refetch: refetchCex } = useCoinGeckoPrice();
  const [poolsData, setPoolsData] = useState<Record<string, PoolData>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const provider = isConnected ? getProvider() : null;

  const deployedContracts = getDeployedContracts();
  const deployedPools = getDeployedPools();

  const getTokenSymbol = (address: string): string => {
    const normalizedAddress = address.toLowerCase();
    for (const [symbol, addr] of Object.entries(TOKEN_ADDRESSES)) {
      if (addr.toLowerCase() === normalizedAddress) return symbol;
    }
    return address.slice(0, 6) + '...' + address.slice(-4);
  };

  const fetchPoolData = useCallback(async (poolName: string, poolAddress: string) => {
    if (!provider) return;

    setPoolsData(prev => ({
      ...prev,
      [poolName]: { ...prev[poolName], loading: true, error: null }
    }));

    try {
      const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
      
      const [slot0, token0, token1, fee, liquidity] = await Promise.all([
        pool.slot0(),
        pool.token0(),
        pool.token1(),
        pool.fee(),
        pool.liquidity(),
      ]);

      const token0Symbol = getTokenSymbol(token0);
      const token1Symbol = getTokenSymbol(token1);
      const token0Decimals = getTokenDecimals(token0Symbol);
      const token1Decimals = getTokenDecimals(token1Symbol);
      
      const price = sqrtPriceX96ToPrice(slot0.sqrtPriceX96.toString(), token0Decimals, token1Decimals);

      setPoolsData(prev => ({
        ...prev,
        [poolName]: {
          name: poolName,
          address: poolAddress,
          token0: token0Symbol,
          token1: token1Symbol,
          fee: fee.toNumber(),
          sqrtPriceX96: slot0.sqrtPriceX96.toString(),
          price,
          liquidity: liquidity.toString(),
          loading: false,
          error: null,
        }
      }));
    } catch (error: any) {
      setPoolsData(prev => ({
        ...prev,
        [poolName]: {
          ...prev[poolName],
          name: poolName,
          address: poolAddress,
          loading: false,
          error: error.message || 'Failed to fetch pool data',
        } as PoolData
      }));
    }
  }, [provider]);

  const refreshAllPools = useCallback(async () => {
    setIsRefreshing(true);
    const promises = Object.entries(deployedPools).map(([name, address]) => 
      fetchPoolData(name, address)
    );
    await Promise.all(promises);
    await refetchCex();
    setIsRefreshing(false);
    toast.success('Pool data refreshed');
  }, [deployedPools, fetchPoolData, refetchCex]);

  useEffect(() => {
    if (provider && Object.keys(deployedPools).length > 0) {
      refreshAllPools();
    }
  }, [provider]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const getPriceDeviation = (poolData: PoolData): { deviation: number; status: 'ok' | 'warning' | 'error' } => {
    // Only check deviation for WOVER pools against CEX
    if (!poolData.token0.includes('WOVER') && !poolData.token1.includes('WOVER')) {
      return { deviation: 0, status: 'ok' }; // Stable pairs don't need CEX comparison
    }
    
    if (!cexPrice || cexPrice === 0) return { deviation: 0, status: 'ok' };
    
    // Determine pool price in USD terms
    let poolPriceUsd: number;
    if (poolData.token0 === 'WOVER') {
      // Price is token1/token0, so if WOVER is token0, price = USDT per WOVER
      poolPriceUsd = poolData.price;
    } else {
      // WOVER is token1, price = WOVER per USDT, so invert
      poolPriceUsd = 1 / poolData.price;
    }
    
    const deviation = ((poolPriceUsd - cexPrice) / cexPrice) * 100;
    
    if (Math.abs(deviation) > PRICE_DEVIATION_THRESHOLD * 2) {
      return { deviation, status: 'error' };
    }
    if (Math.abs(deviation) > PRICE_DEVIATION_THRESHOLD) {
      return { deviation, status: 'warning' };
    }
    return { deviation, status: 'ok' };
  };

  const poolCount = Object.keys(deployedPools).length;

  if (poolCount === 0) {
    return (
      <GlowCard className="p-6" glowColor="cyan">
        <div className="text-center py-8">
          <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Pools Created</h3>
          <p className="text-muted-foreground text-sm">
            Create pools in the "Create Pools" tab first, then verify them here.
          </p>
        </div>
      </GlowCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <GlowCard className="p-6" glowColor="cyan">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Pool Verification
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Verify on-chain pool parameters and compare prices with CEX
            </p>
          </div>
          <NeonButton 
            variant="secondary" 
            onClick={refreshAllPools}
            disabled={isRefreshing}
            className="text-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh All
          </NeonButton>
        </div>

        {/* CEX Reference Price */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">CEX Reference (CoinGecko)</p>
                {cexLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold gradient-text">${cexPrice.toFixed(5)}</span>
                    <span className={`text-sm flex items-center gap-1 ${cexChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {cexChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {cexChange >= 0 ? '+' : ''}{cexChange.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              <p>Warning threshold: ±{PRICE_DEVIATION_THRESHOLD}%</p>
              <p>Critical threshold: ±{PRICE_DEVIATION_THRESHOLD * 2}%</p>
            </div>
          </div>
        </div>

        {/* Factory Info */}
        {deployedContracts.factory && (
          <div className="bg-background/50 border border-border/30 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span className="text-sm font-medium">Factory Contract</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-muted-foreground">
                  {deployedContracts.factory.slice(0, 10)}...{deployedContracts.factory.slice(-8)}
                </code>
                <button onClick={() => copyToClipboard(deployedContracts.factory!)} className="text-muted-foreground hover:text-primary">
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <a 
                  href={`${NETWORK_CONFIG.blockExplorerUrls[0]}/address/${deployedContracts.factory}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}
      </GlowCard>

      {/* Pool Cards */}
      {Object.entries(deployedPools).map(([poolName, poolAddress]) => {
        const data = poolsData[poolName];
        const priceCheck = data ? getPriceDeviation(data) : null;
        const feeLabel = data ? `${(data.fee / 10000).toFixed(2)}%` : '—';
        const isWoverPool = poolName.includes('WOVER');
        // Map status to available glow colors
        const glowColor = priceCheck?.status === 'error' ? 'pink' : priceCheck?.status === 'warning' ? 'purple' : 'cyan';

        return (
          <GlowCard 
            key={poolName} 
            className="p-5" 
            glowColor={glowColor}
          >
            {/* Pool Header */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold">{poolName}</h3>
                  {data && !data.loading && !data.error && (
                    <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      priceCheck?.status === 'error' 
                        ? 'bg-destructive/20 text-destructive' 
                        : priceCheck?.status === 'warning'
                        ? 'bg-warning/20 text-warning'
                        : 'bg-success/20 text-success'
                    }`}>
                      {priceCheck?.status === 'error' ? <XCircle className="w-3 h-3" /> : 
                       priceCheck?.status === 'warning' ? <AlertTriangle className="w-3 h-3" /> :
                       <CheckCircle className="w-3 h-3" />}
                      {priceCheck?.status === 'error' ? 'Price Mismatch' : 
                       priceCheck?.status === 'warning' ? 'Price Warning' : 'Verified'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono">{poolAddress}</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => fetchPoolData(poolName, poolAddress)}
                  disabled={data?.loading}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${data?.loading ? 'animate-spin' : ''}`} />
                </button>
                <a 
                  href={`${NETWORK_CONFIG.blockExplorerUrls[0]}/address/${poolAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Pool Data */}
            {data?.loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading pool data...</span>
              </div>
            ) : data?.error ? (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="w-5 h-5" />
                  <span className="font-medium">Error loading pool</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{data.error}</p>
              </div>
            ) : data ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Tokens */}
                <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Token Pair</p>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{data.token0}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="font-semibold">{data.token1}</span>
                  </div>
                </div>

                {/* Fee Tier */}
                <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Fee Tier</p>
                  <span className="font-semibold text-primary">{feeLabel}</span>
                </div>

                {/* On-chain Price */}
                <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">On-chain Price</p>
                  <span className="font-semibold font-mono">
                    {data.price < 0.0001 ? data.price.toExponential(4) : data.price.toFixed(6)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">
                    {data.token1}/{data.token0}
                  </span>
                </div>

                {/* Liquidity */}
                <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Liquidity</p>
                  <span className="font-semibold font-mono">
                    {BigInt(data.liquidity) > 0n ? 
                      (BigInt(data.liquidity) > 1000000000n ? 
                        (Number(BigInt(data.liquidity) / 1000000n) / 1000).toFixed(2) + 'B' :
                        Number(data.liquidity).toLocaleString()) 
                      : '0'}
                  </span>
                </div>

                {/* CEX Comparison (for WOVER pools) */}
                {isWoverPool && priceCheck && (
                  <div className={`md:col-span-2 lg:col-span-4 rounded-lg p-3 border ${
                    priceCheck.status === 'error' 
                      ? 'bg-destructive/10 border-destructive/30' 
                      : priceCheck.status === 'warning'
                      ? 'bg-warning/10 border-warning/30'
                      : 'bg-success/10 border-success/30'
                  }`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        {priceCheck.status === 'error' ? <XCircle className="w-4 h-4 text-destructive" /> : 
                         priceCheck.status === 'warning' ? <AlertTriangle className="w-4 h-4 text-warning" /> :
                         <CheckCircle className="w-4 h-4 text-success" />}
                        <span className="text-sm font-medium">
                          CEX Price Comparison
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          CEX: <span className="font-mono font-semibold text-foreground">${cexPrice.toFixed(5)}</span>
                        </span>
                        <span className={`font-semibold ${
                          priceCheck.status === 'error' ? 'text-destructive' : 
                          priceCheck.status === 'warning' ? 'text-warning' : 'text-success'
                        }`}>
                          {priceCheck.deviation >= 0 ? '+' : ''}{priceCheck.deviation.toFixed(2)}% deviation
                        </span>
                      </div>
                    </div>
                    {priceCheck.status !== 'ok' && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {priceCheck.status === 'error' 
                          ? 'Pool price significantly differs from CEX. This may attract arbitrage bots.' 
                          : 'Pool price slightly differs from CEX. Monitor for arbitrage activity.'}
                      </p>
                    )}
                  </div>
                )}

                {/* sqrtPriceX96 */}
                <div className="md:col-span-2 lg:col-span-4 bg-background/30 rounded-lg p-3 border border-border/20">
                  <p className="text-xs text-muted-foreground mb-1">sqrtPriceX96 (raw)</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-muted-foreground truncate flex-1">
                      {data.sqrtPriceX96}
                    </code>
                    <button onClick={() => copyToClipboard(data.sqrtPriceX96)} className="text-muted-foreground hover:text-primary">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                Click refresh to load pool data
              </div>
            )}
          </GlowCard>
        );
      })}
    </div>
  );
};

export default PoolVerification;
