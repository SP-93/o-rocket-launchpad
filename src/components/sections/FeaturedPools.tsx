import { useNavigate } from "react-router-dom";
import GlowCard from "@/components/ui/GlowCard";
import NeonButton from "@/components/ui/NeonButton";
import { TrendingUp, Droplet } from "lucide-react";

const FeaturedPools = () => {
  const navigate = useNavigate();

  const pools = [
    {
      pair: "USDT/USDC",
      fee: "0.3%",
      tvl: "$12.5M",
      volume24h: "$3.2M",
      apr: "18.5%",
    },
    {
      pair: "WOVER/USDC",
      fee: "0.3%",
      tvl: "$8.7M",
      volume24h: "$2.1M",
      apr: "24.3%",
    },
  ];

  return (
    <section className="py-20 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 gradient-text">
            Featured Liquidity Pools
          </h2>
          <p className="text-muted-foreground text-lg">
            Earn fees by providing liquidity to our most popular trading pairs
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {pools.map((pool, index) => (
            <GlowCard 
              key={pool.pair}
              className="p-8 animate-slide-up"
              style={{ animationDelay: `${index * 0.15}s` } as React.CSSProperties}
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold mb-2">{pool.pair}</h3>
                  <span className="inline-block px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-semibold border border-primary/30">
                    {pool.fee} Fee Tier
                  </span>
                </div>
                <Droplet className="w-8 h-8 text-primary glow-effect" />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">TVL</p>
                  <p className="text-xl font-bold">{pool.tvl}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm mb-1">24h Volume</p>
                  <p className="text-xl font-bold">{pool.volume24h}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-success/10 border border-success/30 rounded-lg mb-6">
                <span className="text-muted-foreground">APR</span>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-success" />
                  <span className="text-2xl font-bold text-success">{pool.apr}</span>
                </div>
              </div>

              <NeonButton 
                onClick={() => navigate('/add-liquidity')}
                className="w-full"
              >
                Add Liquidity
              </NeonButton>
            </GlowCard>
          ))}
        </div>

        <div className="text-center mt-12">
          <NeonButton 
            onClick={() => navigate('/pools')}
            variant="secondary"
          >
            View All Pools
          </NeonButton>
        </div>
      </div>
    </section>
  );
};

export default FeaturedPools;
