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
      tvl: "$1.2M",
      volume24h: "$280K",
      apr: "12.5%",
      glowColor: "cyan" as const,
    },
    {
      pair: "WOVER/USDC",
      fee: "0.3%",
      tvl: "$856K",
      volume24h: "$172K",
      apr: "18.2%",
      glowColor: "purple" as const,
    },
    {
      pair: "WOVER/USDT",
      fee: "0.3%",
      tvl: "$642K",
      volume24h: "$145K",
      apr: "21.5%",
      glowColor: "pink" as const,
    },
  ];

  return (
    <section className="py-16 md:py-20 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 gradient-text">
            Featured Liquidity Pools
          </h2>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
            Earn fees by providing liquidity to our most popular trading pairs
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {pools.map((pool, index) => (
            <GlowCard 
              key={pool.pair}
              glowColor={pool.glowColor}
              className="p-6 md:p-8 animate-slide-up"
              style={{ animationDelay: `${index * 0.15}s` } as React.CSSProperties}
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-xl md:text-2xl font-bold mb-2">{pool.pair}</h3>
                  <span className="inline-block px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-semibold border border-primary/30">
                    {pool.fee} Fee Tier
                  </span>
                </div>
                <Droplet className="w-6 h-6 md:w-8 md:h-8 text-primary glow-effect" />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">TVL</p>
                  <p className="text-lg md:text-xl font-bold">{pool.tvl}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm mb-1">24h Volume</p>
                  <p className="text-lg md:text-xl font-bold">{pool.volume24h}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-success/10 border border-success/30 rounded-lg mb-6">
                <span className="text-muted-foreground">APR</span>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-success" />
                  <span className="text-xl md:text-2xl font-bold text-success">{pool.apr}</span>
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

        <div className="text-center mt-8 md:mt-12">
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
