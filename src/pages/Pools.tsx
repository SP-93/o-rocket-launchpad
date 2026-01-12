import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SpaceBackground from "@/components/backgrounds/SpaceBackground";
import GlowCard from "@/components/ui/GlowCard";
import { TokenPairIcon } from "@/components/TokenIcon";
import { useLiquidity } from "@/hooks/useLiquidity";
import { useCoinGeckoPrice } from "@/hooks/useCoinGeckoPrice";
import { useDexPrice } from "@/hooks/useDexPrice";
import { PoolDetailsModal } from "@/components/PoolDetailsModal";

interface PoolTVLData {
  token0Balance: string;
  token1Balance: string;
  tvlUSD: number;
  tvlDEX?: number;
  tvlCEX?: number;
  dexPrice?: number;
  loading: boolean;
}

interface Pool {
  pair: string;
  token0: string;
  token1: string;
  fee: string;
  feeValue: number;
  type: string;
  description: string;
}

const Pools = () => {
  const navigate = useNavigate();
  const { getPoolTVL, getPoolPrice } = useLiquidity();
  const { price: cexPrice, change24h, loading: cexPriceLoading } = useCoinGeckoPrice();
  const { dexPrice, isLoading: dexPriceLoading } = useDexPrice();
  const [poolTVLs, setPoolTVLs] = useState<Record<string, PoolTVLData>>({});
  const [poolPrices, setPoolPrices] = useState<Record<string, number>>({});
  const [isLoadingTVL, setIsLoadingTVL] = useState(true);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);

  const pools = [
    {
      pair: "USDT / USDC",
      token0: "USDT",
      token1: "USDC",
      fee: "0.3%",
      feeValue: 3000,
      type: "Stable",
      description: "Low volatility stable pair",
    },
    {
      pair: "WOVER / USDC",
      token0: "WOVER",
      token1: "USDC",
      fee: "0.3%",
      feeValue: 3000,
      type: "Main",
      description: "Primary OVER trading pair",
    },
    {
      pair: "WOVER / USDT",
      token0: "WOVER",
      token1: "USDT",
      fee: "0.3%",
      feeValue: 3000,
      type: "Alternative",
      description: "Alternative OVER pair",
    },
  ];

  // Fetch TVL and prices for all pools
  useEffect(() => {
    const fetchAllPoolData = async () => {
      if (cexPriceLoading || dexPriceLoading) return;
      
      setIsLoadingTVL(true);
      const tvlData: Record<string, PoolTVLData> = {};
      const priceData: Record<string, number> = {};

      await Promise.all(
        pools.map(async (pool) => {
          const [tvl, price] = await Promise.all([
            getPoolTVL(pool.token0, pool.token1, pool.feeValue, cexPrice, true),
            getPoolPrice(pool.token0, pool.token1, pool.feeValue),
          ]);
          
          tvlData[pool.pair] = {
            token0Balance: tvl?.token0Balance || "0",
            token1Balance: tvl?.token1Balance || "0",
            tvlUSD: tvl?.tvlDEX || 0, // Use DEX TVL as primary
            tvlDEX: tvl?.tvlDEX,
            tvlCEX: tvl?.tvlCEX,
            dexPrice: tvl?.dexPrice,
            loading: false,
          };
          priceData[pool.pair] = price || 0;
        })
      );

      setPoolTVLs(tvlData);
      setPoolPrices(priceData);
      setIsLoadingTVL(false);
    };

    fetchAllPoolData();
  }, [cexPrice, cexPriceLoading, dexPrice, dexPriceLoading, getPoolTVL, getPoolPrice]);

  // Calculate total TVL (using DEX prices)
  const totalTVLDex = Object.values(poolTVLs).reduce((sum, tvl) => sum + (tvl.tvlDEX || 0), 0);
  const totalTVLCex = Object.values(poolTVLs).reduce((sum, tvl) => sum + (tvl.tvlCEX || 0), 0);
  const activePoolsCount = Object.values(poolTVLs).filter(tvl => tvl.tvlUSD > 0).length;


  const handleAddLiquidity = (token0: string, token1: string, fee: number) => {
    navigate(`/add-liquidity?token0=${token0}&token1=${token1}&fee=${fee}`);
  };

  const handleOpenDetails = (pool: Pool) => {
    setSelectedPool(pool);
    setDetailsModalOpen(true);
  };

  const formatTVL = (tvl: number): string => {
    if (tvl >= 1000000) return `$${(tvl / 1000000).toFixed(2)}M`;
    if (tvl >= 1000) return `$${(tvl / 1000).toFixed(2)}K`;
    if (tvl > 0) return `$${tvl.toFixed(2)}`;
    return "$0.00";
  };

  return (
    <SpaceBackground>
      <div className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2 gradient-text">Liquidity Pools</h1>
                <p className="text-muted-foreground text-sm md:text-base">Provide liquidity and earn trading fees</p>
              </div>
              <Button className="btn-primary w-full md:w-auto" onClick={() => navigate("/add-liquidity")}>
                <Plus className="w-4 h-4 mr-2" />
                New Position
              </Button>
            </div>

            {/* Stats Card with DEX/CEX prices */}
            <GlowCard className="p-4 md:p-6 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {/* Total DEX TVL */}
                <div className="text-center sm:text-left">
                  <p className="text-sm text-muted-foreground mb-1">DEX TVL</p>
                  {isLoadingTVL ? (
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  ) : (
                    <p className="text-2xl md:text-3xl font-bold text-primary">{formatTVL(totalTVLDex)}</p>
                  )}
                </div>
                
                {/* DEX Price */}
                <div className="text-center sm:text-left">
                  <p className="text-sm text-muted-foreground mb-1">DEX Price</p>
                  {dexPriceLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  ) : (
                    <div>
                      <p className="text-2xl md:text-3xl font-bold text-primary">${dexPrice?.toFixed(6) || '0.00'}</p>
                      <p className="text-xs text-muted-foreground">Pool price</p>
                    </div>
                  )}
                </div>
                
                {/* CEX Price */}
                <div className="text-center sm:text-left">
                  <p className="text-sm text-muted-foreground mb-1">CEX Price</p>
                  {cexPriceLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  ) : (
                    <div>
                      <p className="text-2xl md:text-3xl font-bold">${cexPrice?.toFixed(6) || '0.00'}</p>
                      <div className="flex items-center gap-1 text-xs">
                        {change24h >= 0 ? (
                          <>
                            <TrendingUp className="w-3 h-3 text-success" />
                            <span className="text-success">+{change24h.toFixed(1)}% (24h)</span>
                          </>
                        ) : (
                          <>
                            <TrendingDown className="w-3 h-3 text-destructive" />
                            <span className="text-destructive">{change24h.toFixed(1)}% (24h)</span>
                          </>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">CoinGecko</span>
                    </div>
                  )}
                </div>
                
                {/* Active Pools */}
                <div className="text-center sm:text-left">
                  <p className="text-sm text-muted-foreground mb-1">Active Pools</p>
                  <p className="text-2xl md:text-3xl font-bold text-success">{activePoolsCount}</p>
                </div>
              </div>
              
            </GlowCard>

            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                placeholder="Search pools by token name..."
                className="pl-10 glass-card border-primary/20"
              />
            </div>
          </div>

          {/* Pools Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {pools.map((pool, index) => {
              const tvlData = poolTVLs[pool.pair];
              const hasLiquidity = tvlData && tvlData.tvlUSD > 0;

              return (
                <GlowCard
                  key={pool.pair}
                  className="p-4 md:p-6 animate-slide-up group"
                  style={{ animationDelay: `${index * 0.1}s` } as React.CSSProperties}
                >
                  <div className="flex items-start justify-between mb-4 md:mb-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <TokenPairIcon token0={pool.token0} token1={pool.token1} size="md" />
                        <h3 className="text-xl md:text-2xl font-bold group-hover:text-primary transition-colors">{pool.pair}</h3>
                      </div>
                      <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        {pool.type}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-semibold text-foreground">{pool.fee}</span>
                      <p className="text-xs text-muted-foreground">Fee Tier</p>
                    </div>
                  </div>

                  <p className="text-muted-foreground text-sm mb-4">
                    {pool.description}
                  </p>

                  {/* TVL Display with DEX/CEX */}
                  <div className="pt-4 border-t border-border/30 mb-4">
                    {isLoadingTVL ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Loading TVL...</span>
                      </div>
                    ) : hasLiquidity ? (
                      <div className="space-y-2">
                        {/* DEX TVL - Primary */}
                        <div className="flex items-baseline justify-between">
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-bold text-primary">{formatTVL(tvlData.tvlDEX || tvlData.tvlUSD)}</span>
                            <span className="text-xs text-muted-foreground">DEX TVL</span>
                          </div>
                          {tvlData.dexPrice && (pool.token0 === 'WOVER' || pool.token1 === 'WOVER') && (
                            <span className="text-xs text-muted-foreground">
                              @ ${tvlData.dexPrice.toFixed(6)}
                            </span>
                          )}
                        </div>
                        
                        
                        {/* Token balances */}
                        <p className="text-xs text-muted-foreground">
                          {tvlData.token0Balance} {pool.token0} + {tvlData.token1Balance} {pool.token1}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No liquidity yet</p>
                    )}
                  </div>

                  <div className="flex gap-2 md:gap-3">
                    <Button 
                      className="flex-1 btn-primary text-sm" 
                      onClick={() => handleAddLiquidity(pool.token0, pool.token1, pool.feeValue)}
                    >
                      Add Liquidity
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 border-primary/30 text-sm"
                      onClick={() => handleOpenDetails(pool)}
                    >
                      Details
                    </Button>
                  </div>
                </GlowCard>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pool Details Modal */}
      <PoolDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        pool={selectedPool}
        tvlData={selectedPool ? poolTVLs[selectedPool.pair] : null}
        currentPrice={selectedPool ? poolPrices[selectedPool.pair] : undefined}
      />
    </SpaceBackground>
  );
};

export default Pools;