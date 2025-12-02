import SpaceBackground from "@/components/backgrounds/SpaceBackground";
import GlowCard from "@/components/ui/GlowCard";
import AnimatedCounter from "@/components/ui/AnimatedCounter";
import { TrendingUp, DollarSign, Users, Layers, Activity, BarChart3 } from "lucide-react";

const Info = () => {
  const protocolStats = [
    { icon: DollarSign, label: "Total TVL", value: 21200000, prefix: "$", suffix: "M", decimals: 1 },
    { icon: TrendingUp, label: "24h Volume", value: 5300000, prefix: "$", suffix: "M", decimals: 1 },
    { icon: Activity, label: "All-Time Volume", value: 487000000, prefix: "$", suffix: "M", decimals: 0 },
    { icon: DollarSign, label: "Total Fees", value: 1461000, prefix: "$", suffix: "M", decimals: 2 },
    { icon: BarChart3, label: "Protocol Revenue", value: 365250, prefix: "$", suffix: "K", decimals: 0 },
    { icon: Layers, label: "Active Pools", value: 2, suffix: "", decimals: 0 },
    { icon: Users, label: "Total LPs", value: 1250, suffix: "+", decimals: 0 },
    { icon: TrendingUp, label: "24h Transactions", value: 8947, suffix: "", decimals: 0 },
  ];

  return (
    <SpaceBackground>
      <div className="min-h-screen pt-32 pb-20 px-4">
        <div className="container mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4 gradient-text">Protocol Analytics</h1>
            <p className="text-xl text-muted-foreground">
              Real-time statistics and insights for O'Rocket DEX
            </p>
          </div>

          {/* Protocol Overview Stats */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold mb-8 text-center">Protocol Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {protocolStats.map((stat, index) => (
                <GlowCard 
                  key={stat.label}
                  className="p-6 text-center animate-slide-up"
                  style={{ animationDelay: `${index * 0.05}s` } as React.CSSProperties}
                >
                  <div className="flex justify-center mb-4">
                    <stat.icon className="w-10 h-10 text-primary" />
                  </div>
                  <div className="text-2xl font-bold mb-2">
                    <AnimatedCounter 
                      end={stat.value}
                      prefix={stat.prefix}
                      suffix={stat.suffix}
                      decimals={stat.decimals}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </GlowCard>
              ))}
            </div>
          </div>

          {/* Pool Statistics */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold mb-8 text-center">Pool Performance</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {/* USDT/USDC Pool */}
              <GlowCard className="p-6">
                <h3 className="text-2xl font-bold mb-6 gradient-text">USDT/USDC Pool</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">TVL</span>
                    <span className="text-xl font-bold">$12.5M</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">24h Volume</span>
                    <span className="text-xl font-bold">$3.2M</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">7d Volume</span>
                    <span className="text-xl font-bold">$18.9M</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">APR</span>
                    <span className="text-xl font-bold text-success">18.5%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">LP Positions</span>
                    <span className="text-xl font-bold">687</span>
                  </div>
                </div>
              </GlowCard>

              {/* WOVER/USDC Pool */}
              <GlowCard className="p-6">
                <h3 className="text-2xl font-bold mb-6 gradient-text">WOVER/USDC Pool</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">TVL</span>
                    <span className="text-xl font-bold">$8.7M</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">24h Volume</span>
                    <span className="text-xl font-bold">$2.1M</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">7d Volume</span>
                    <span className="text-xl font-bold">$12.4M</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">APR</span>
                    <span className="text-xl font-bold text-success">24.3%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">LP Positions</span>
                    <span className="text-xl font-bold">563</span>
                  </div>
                </div>
              </GlowCard>
            </div>
          </div>

          {/* How It Works */}
          <div>
            <h2 className="text-3xl font-bold mb-8 text-center">How O'Rocket Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <GlowCard className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                  <span className="text-2xl font-bold text-primary">1</span>
                </div>
                <h3 className="text-xl font-bold mb-3">Connect Wallet</h3>
                <p className="text-muted-foreground">
                  Connect your MetaMask or OverWallet to get started with trading and liquidity provision.
                </p>
              </GlowCard>

              <GlowCard className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary/20 flex items-center justify-center border border-secondary/30">
                  <span className="text-2xl font-bold text-secondary">2</span>
                </div>
                <h3 className="text-xl font-bold mb-3">Provide Liquidity</h3>
                <p className="text-muted-foreground">
                  Add liquidity to pools with concentrated ranges for higher capital efficiency and APR.
                </p>
              </GlowCard>

              <GlowCard className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/20 flex items-center justify-center border border-accent/30">
                  <span className="text-2xl font-bold text-accent">3</span>
                </div>
                <h3 className="text-xl font-bold mb-3">Earn Fees</h3>
                <p className="text-muted-foreground">
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
