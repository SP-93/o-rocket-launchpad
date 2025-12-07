import SpaceBackground from "@/components/backgrounds/SpaceBackground";
import GlowCard from "@/components/ui/GlowCard";
import PriceChart from "@/components/PriceChart";
import { TrendingUp, DollarSign, Users, Layers, Activity, BarChart3 } from "lucide-react";

const Info = () => {
  const protocolStats = [
    { icon: DollarSign, label: "Total TVL", placeholder: "--" },
    { icon: TrendingUp, label: "24h Volume", placeholder: "--" },
    { icon: Activity, label: "All-Time Volume", placeholder: "--" },
    { icon: DollarSign, label: "Total Fees", placeholder: "--" },
    { icon: BarChart3, label: "Protocol Revenue", placeholder: "--" },
    { icon: Layers, label: "Active Pools", value: "3" },
    { icon: Users, label: "Total LPs", placeholder: "--" },
    { icon: TrendingUp, label: "24h Transactions", placeholder: "--" },
  ];

  const poolStats = [
    {
      name: "USDT/USDC Pool",
      tvl: "--",
      volume24h: "--",
      volume7d: "--",
      apr: "--",
      positions: "--",
    },
    {
      name: "WOVER/USDC Pool",
      tvl: "--",
      volume24h: "--",
      volume7d: "--",
      apr: "--",
      positions: "--",
    },
    {
      name: "WOVER/USDT Pool",
      tvl: "--",
      volume24h: "--",
      volume7d: "--",
      apr: "--",
      positions: "--",
    },
  ];

  return (
    <SpaceBackground>
      <div className="min-h-screen pt-24 md:pt-32 pb-20 px-4">
        <div className="container mx-auto">
          {/* Header */}
          <div className="text-center mb-8 md:mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">Protocol Analytics</h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              Real-time statistics and insights for O'Rocket DEX
            </p>
          </div>

          {/* Data Notice */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 text-center">
              <p className="text-sm text-muted-foreground">
                📊 Real data will be available after contract deployment on OverProtocol Mainnet
              </p>
            </div>
          </div>

          {/* Protocol Overview Stats */}
          <div className="mb-12 md:mb-16">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-center">Protocol Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {protocolStats.map((stat, index) => (
                <GlowCard 
                  key={stat.label}
                  className="p-4 md:p-6 text-center animate-slide-up"
                  style={{ animationDelay: `${index * 0.05}s` } as React.CSSProperties}
                >
                  <div className="flex justify-center mb-3 md:mb-4">
                    <stat.icon className="w-8 h-8 md:w-10 md:h-10 text-primary" />
                  </div>
                  <div className="text-lg md:text-2xl font-bold mb-1 md:mb-2">
                    {stat.value || stat.placeholder}
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">{stat.label}</p>
                </GlowCard>
              ))}
            </div>
          </div>

          {/* Price Charts */}
          <div className="mb-12 md:mb-16">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-center">Price Charts</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
              <PriceChart token0="WOVER" token1="USDC" />
              <PriceChart token0="WOVER" token1="USDT" />
            </div>
            <div className="mt-6 max-w-3xl mx-auto">
              <PriceChart token0="USDT" token1="USDC" />
            </div>
          </div>

          {/* Pool Statistics */}
          <div className="mb-12 md:mb-16">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-center">Pool Performance</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {poolStats.map((pool, index) => (
                <GlowCard 
                  key={pool.name} 
                  className="p-4 md:p-6"
                  glowColor={index === 0 ? "cyan" : index === 1 ? "purple" : "pink"}
                >
                  <h3 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 gradient-text">{pool.name}</h3>
                  <div className="space-y-3 md:space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">TVL</span>
                      <span className="text-lg md:text-xl font-bold">{pool.tvl}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">24h Volume</span>
                      <span className="text-lg md:text-xl font-bold">{pool.volume24h}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">7d Volume</span>
                      <span className="text-lg md:text-xl font-bold">{pool.volume7d}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">APR</span>
                      <span className="text-lg md:text-xl font-bold text-muted-foreground">{pool.apr}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">LP Positions</span>
                      <span className="text-lg md:text-xl font-bold">{pool.positions}</span>
                    </div>
                  </div>
                </GlowCard>
              ))}
            </div>
          </div>

          {/* How It Works */}
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-center">How O'Rocket Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <GlowCard className="p-6 text-center">
                <div className="w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                  <span className="text-xl md:text-2xl font-bold text-primary">1</span>
                </div>
                <h3 className="text-lg md:text-xl font-bold mb-3">Connect Wallet</h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Connect your MetaMask or OverWallet to get started with trading and liquidity provision.
                </p>
              </GlowCard>

              <GlowCard className="p-6 text-center" glowColor="purple">
                <div className="w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 rounded-full bg-secondary/20 flex items-center justify-center border border-secondary/30">
                  <span className="text-xl md:text-2xl font-bold text-secondary">2</span>
                </div>
                <h3 className="text-lg md:text-xl font-bold mb-3">Provide Liquidity</h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Add liquidity to pools with concentrated ranges for higher capital efficiency and APR.
                </p>
              </GlowCard>

              <GlowCard className="p-6 text-center" glowColor="pink">
                <div className="w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 rounded-full bg-accent/20 flex items-center justify-center border border-accent/30">
                  <span className="text-xl md:text-2xl font-bold text-accent">3</span>
                </div>
                <h3 className="text-lg md:text-xl font-bold mb-3">Earn Fees</h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Earn 75% of trading fees from every swap, automatically compounded into your position.
                </p>
              </GlowCard>
            </div>
          </div>
        </div>
      </div>
    </SpaceBackground>
  );
};

export default Info;