import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  ];

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2 gradient-text">Liquidity Pools</h1>
              <p className="text-muted-foreground">Provide liquidity and earn trading fees</p>
            </div>
            <Button className="btn-primary" onClick={() => navigate("/add-liquidity")}>
              <Plus className="w-4 h-4 mr-2" />
              New Position
            </Button>
          </div>

          {/* Stats Card */}
          <div className="glass-card p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Value Locked</p>
                <p className="text-3xl font-bold">$2,090,987</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">24h Volume</p>
                <p className="text-3xl font-bold">$453,280</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">24h Fees</p>
                <p className="text-3xl font-bold text-success">$1,359</p>
              </div>
            </div>
          </div>

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pools.map((pool, index) => (
            <div
              key={pool.pair}
              className="pool-card animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold mb-2">{pool.pair}</h3>
                  <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                    {pool.fee} Fee Tier
                  </span>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-success mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-2xl font-bold">{pool.apr}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">APR</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-primary/10">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">TVL</p>
                  <p className="text-lg font-semibold">{pool.tvl}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Volume 24h</p>
                  <p className="text-lg font-semibold">{pool.volume24h}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Volume 7d</p>
                  <p className="text-lg font-semibold">{pool.volume7d}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button className="flex-1 btn-primary" onClick={() => navigate("/add-liquidity")}>
                  Add Liquidity
                </Button>
                <Button variant="outline" className="flex-1 border-primary/30">
                  Details
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Pools;
