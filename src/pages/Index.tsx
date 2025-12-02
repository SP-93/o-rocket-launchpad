import { ArrowRight, TrendingUp, Users, DollarSign, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  const metrics = [
    { label: "Total Value Locked", value: "$2.4M", icon: DollarSign, change: "+12.5%" },
    { label: "24h Volume", value: "$450K", icon: Activity, change: "+8.3%" },
    { label: "Active LPs", value: "1,234", icon: Users, change: "+15.2%" },
    { label: "Total Positions", value: "3,456", icon: TrendingUp, change: "+10.1%" },
  ];

  const featuredPools = [
    { pair: "USDT/USDC", tvl: "$1.2M", volume24h: "$280K", apr: "12.5%", fee: "0.3%" },
    { pair: "WOVER/USDC", tvl: "$850K", volume24h: "$170K", apr: "18.2%", fee: "0.3%" },
  ];

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4">
        {/* Hero Section */}
        <div className="text-center mb-20 animate-slide-up">
          <div className="inline-block mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent blur-3xl opacity-30 animate-pulse-glow" />
              <h1 className="relative text-6xl md:text-8xl font-bold mb-4">
                <span className="gradient-text">O'ROCKET</span>
              </h1>
            </div>
          </div>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Launch Your Liquidity to the Moon
          </p>
          <p className="text-lg text-muted-foreground/80 mb-12 max-w-3xl mx-auto">
            Next-generation DeFi powered by OverProtocol. Trade with concentrated liquidity, 
            earn sustainable yields, and explore the future of decentralized finance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button className="btn-primary text-lg" onClick={() => navigate("/swap")}>
              Start Trading
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button className="btn-secondary text-lg" onClick={() => navigate("/pools")}>
              Provide Liquidity
            </Button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="metric-card animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-center justify-center mb-3">
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">{metric.label}</p>
                <p className="text-3xl font-bold mb-2">{metric.value}</p>
                <p className="text-sm text-success">{metric.change}</p>
              </div>
            );
          })}
        </div>

        {/* Featured Pools */}
        <div className="mb-20">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold">Featured Pools</h2>
            <Button variant="ghost" className="text-primary" onClick={() => navigate("/pools")}>
              View All Pools
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {featuredPools.map((pool, index) => (
              <div
                key={pool.pair}
                className="pool-card animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">{pool.pair}</h3>
                    <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                      {pool.fee} Fee
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-success">{pool.apr}</p>
                    <p className="text-sm text-muted-foreground">APR</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">TVL</p>
                    <p className="text-xl font-semibold">{pool.tvl}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">24h Volume</p>
                    <p className="text-xl font-semibold">{pool.volume24h}</p>
                  </div>
                </div>

                <Button className="w-full btn-primary">
                  Add Liquidity
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="glass-card p-12 text-center">
          <h2 className="text-3xl font-bold mb-6">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-primary to-accent mx-auto mb-4 flex items-center justify-center text-2xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Connect Wallet</h3>
              <p className="text-muted-foreground">
                Connect your MetaMask or OverWallet to get started
              </p>
            </div>
            <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-primary to-accent mx-auto mb-4 flex items-center justify-center text-2xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Choose Your Strategy</h3>
              <p className="text-muted-foreground">
                Trade tokens or provide liquidity with concentrated ranges
              </p>
            </div>
            <div className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-primary to-accent mx-auto mb-4 flex items-center justify-center text-2xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Earn Rewards</h3>
              <p className="text-muted-foreground">
                Collect trading fees automatically on your liquidity positions
              </p>
            </div>
          </div>
          <Button className="btn-primary text-lg" onClick={() => navigate("/swap")}>
            Launch App
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 border-t border-primary/20 pt-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p className="mb-2">Built on OverProtocol Mainnet</p>
          <p className="text-sm">© 2024 O'Rocket. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
