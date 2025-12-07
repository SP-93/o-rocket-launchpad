import { useNavigate } from "react-router-dom";
import GlowCard from "@/components/ui/GlowCard";
import NeonButton from "@/components/ui/NeonButton";
import { TokenPairIcon } from "@/components/TokenIcon";
import { ArrowRight } from "lucide-react";

const FeaturedPools = () => {
  const navigate = useNavigate();

  const pools = [
    {
      pair: "USDT / USDC",
      token0: "USDT",
      token1: "USDC",
      fee: "0.3%",
      feeValue: 3000,
      type: "Stable",
      description: "Low volatility stable pair",
      glowColor: "cyan" as const,
    },
    {
      pair: "WOVER / USDC",
      token0: "WOVER",
      token1: "USDC",
      fee: "0.3%",
      feeValue: 3000,
      type: "Main",
      description: "Primary OVER trading pair",
      glowColor: "purple" as const,
    },
    {
      pair: "WOVER / USDT",
      token0: "WOVER",
      token1: "USDT",
      fee: "0.3%",
      feeValue: 3000,
      type: "Alternative",
      description: "Alternative OVER pair",
      glowColor: "pink" as const,
    },
  ];

  const handleAddLiquidity = (token0: string, token1: string, fee: number) => {
    navigate(`/add-liquidity?token0=${token0}&token1=${token1}&fee=${fee}`);
  };

  return (
    <section className="py-16 md:py-20 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 gradient-text">
            Liquidity Pools
          </h2>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
            Provide liquidity and earn trading fees on OverProtocol
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {pools.map((pool, index) => (
            <GlowCard 
              key={pool.pair}
              glowColor={pool.glowColor}
              className="p-6 md:p-8 animate-slide-up cursor-pointer group"
              style={{ animationDelay: `${index * 0.15}s` } as React.CSSProperties}
              onClick={() => handleAddLiquidity(pool.token0, pool.token1, pool.feeValue)}
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <TokenPairIcon token0={pool.token0} token1={pool.token1} size="md" />
                    <h3 className="text-xl md:text-2xl font-bold group-hover:text-primary transition-colors">{pool.pair}</h3>
                  </div>
                  <span className="inline-block px-3 py-1 bg-primary/20 text-primary rounded-full text-xs font-medium border border-primary/30">
                    {pool.type}
                  </span>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-muted-foreground text-sm mb-3">{pool.description}</p>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <span className="text-muted-foreground text-sm">Fee Tier</span>
                  <span className="text-lg font-bold text-foreground">{pool.fee}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-border/30 mb-6">
                <p className="text-xs text-muted-foreground">TVL & APR data coming after launch</p>
              </div>

              <NeonButton 
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddLiquidity(pool.token0, pool.token1, pool.feeValue);
                }}
                className="w-full"
              >
                Add Liquidity
                <ArrowRight className="w-4 h-4" />
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
            <ArrowRight className="w-4 h-4" />
          </NeonButton>
        </div>
      </div>
    </section>
  );
};

export default FeaturedPools;