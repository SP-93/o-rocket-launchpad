import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SpaceBackground from "@/components/backgrounds/SpaceBackground";
import GlowCard from "@/components/ui/GlowCard";

const Pools = () => {
  const navigate = useNavigate();

  const pools = [
    {
      pair: "USDT / USDC",
      fee: "0.3%",
      type: "Stable",
      description: "Low volatility stable pair",
    },
    {
      pair: "WOVER / USDC",
      fee: "0.3%",
      type: "Main",
      description: "Primary OVER trading pair",
    },
    {
      pair: "WOVER / USDT",
      fee: "0.3%",
      type: "Alternative",
      description: "Alternative OVER pair",
    },
  ];

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
                  <p className="text-2xl md:text-3xl font-bold">--</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-sm text-muted-foreground mb-1">24h Volume</p>
                  <p className="text-2xl md:text-3xl font-bold">--</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-sm text-muted-foreground mb-1">Active Pools</p>
                  <p className="text-2xl md:text-3xl font-bold text-success">3</p>
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
                className="p-4 md:p-6 animate-slide-up group"
                style={{ animationDelay: `${index * 0.1}s` } as React.CSSProperties}
              >
                <div className="flex items-start justify-between mb-4 md:mb-6">
                  <div>
                    <h3 className="text-xl md:text-2xl font-bold mb-2 group-hover:text-primary transition-colors">{pool.pair}</h3>
                    <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {pool.type}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-semibold text-foreground">{pool.fee}</span>
                    <p className="text-xs text-muted-foreground">Fee Tier</p>
                  </div>
                </div>

                <p className="text-muted-foreground text-sm mb-6">
                  {pool.description}
                </p>

                <div className="pt-4 border-t border-border/30 mb-4">
                  <p className="text-xs text-muted-foreground">TVL & volume data coming soon</p>
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
