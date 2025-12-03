import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SpaceBackground from "@/components/backgrounds/SpaceBackground";
import GlowCard from "@/components/ui/GlowCard";

const Pools = () => {
  const navigate = useNavigate();

  const pools = [
    {
      pair: "USDT/USDC",
      fee: "0.3%",
      tvl: "$1,234,567",
      volume24h: "$280,450",
      volume7d: "$1,890,200",
      apr: "12.5%",
    },
    {
      pair: "WOVER/USDC",
      fee: "0.3%",
      tvl: "$856,420",
      volume24h: "$172,830",
      volume7d: "$1,205,800",
      apr: "18.2%",
    },
    {
      pair: "WOVER/USDT",
      fee: "0.3%",
      tvl: "$642,310",
      volume24h: "$145,620",
      volume7d: "$982,400",
      apr: "21.5%",
    },
  ];

  const totalTVL = pools.reduce((acc, pool) => acc + parseFloat(pool.tvl.replace(/[$,]/g, '')), 0);
  const totalVolume24h = pools.reduce((acc, pool) => acc + parseFloat(pool.volume24h.replace(/[$,]/g, '')), 0);
  const totalFees24h = totalVolume24h * 0.003;

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

            {/* Stats Card */}
            <GlowCard className="p-4 md:p-6 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                <div className="text-center sm:text-left">
                  <p className="text-sm text-muted-foreground mb-1">Total Value Locked</p>
                  <p className="text-2xl md:text-3xl font-bold">${(totalTVL / 1000000).toFixed(2)}M</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-sm text-muted-foreground mb-1">24h Volume</p>
                  <p className="text-2xl md:text-3xl font-bold">${(totalVolume24h / 1000).toFixed(0)}K</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-sm text-muted-foreground mb-1">24h Fees</p>
                  <p className="text-2xl md:text-3xl font-bold text-success">${totalFees24h.toFixed(0)}</p>
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
            {pools.map((pool, index) => (
              <GlowCard
                key={pool.pair}
                className="p-4 md:p-6 animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` } as React.CSSProperties}
              >
                <div className="flex items-start justify-between mb-4 md:mb-6">
                  <div>
                    <h3 className="text-xl md:text-2xl font-bold mb-2">{pool.pair}</h3>
                    <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                      {pool.fee} Fee Tier
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-success mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xl md:text-2xl font-bold">{pool.apr}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">APR</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4 md:mb-6 pb-4 md:pb-6 border-b border-primary/10">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">TVL</p>
                    <p className="text-sm md:text-lg font-semibold">{pool.tvl}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Vol 24h</p>
                    <p className="text-sm md:text-lg font-semibold">{pool.volume24h}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Vol 7d</p>
                    <p className="text-sm md:text-lg font-semibold">{pool.volume7d}</p>
                  </div>
                </div>

                <div className="flex gap-2 md:gap-3">
                  <Button className="flex-1 btn-primary text-sm" onClick={() => navigate("/add-liquidity")}>
                    Add Liquidity
                  </Button>
                  <Button variant="outline" className="flex-1 border-primary/30 text-sm">
                    Details
                  </Button>
                </div>
              </GlowCard>
            ))}
          </div>
        </div>
      </div>
    </SpaceBackground>
  );
};

export default Pools;
