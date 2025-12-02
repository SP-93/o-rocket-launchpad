import { Card } from "@/components/ui/card";
import { TrendingUp, Activity, DollarSign, Users } from "lucide-react";

const Analytics = () => {
  const metrics = [
    { label: "Total Value Locked", value: "$2.4M", icon: DollarSign, change: "+12.5%" },
    { label: "24h Volume", value: "$450K", icon: Activity, change: "+8.3%" },
    { label: "All-Time Volume", value: "$12.8M", icon: TrendingUp, change: "" },
    { label: "Total LPs", value: "1,234", icon: Users, change: "+15.2%" },
  ];

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 gradient-text">Analytics</h1>
          <p className="text-muted-foreground">Track protocol performance and metrics</p>
        </div>

        {/* Overview Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <Card
                key={metric.label}
                className="glass-card p-6 animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  {metric.change && (
                    <span className="text-sm text-success font-semibold">{metric.change}</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-1">{metric.label}</p>
                <p className="text-3xl font-bold">{metric.value}</p>
              </Card>
            );
          })}
        </div>

        {/* Charts Placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="glass-card p-6">
            <h3 className="text-xl font-bold mb-4">TVL Over Time</h3>
            <div className="h-64 bg-muted/20 rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Chart visualization coming soon</p>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <h3 className="text-xl font-bold mb-4">Volume (24h)</h3>
            <div className="h-64 bg-muted/20 rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Chart visualization coming soon</p>
            </div>
          </Card>
        </div>

        {/* Pool Stats */}
        <Card className="glass-card p-6">
          <h3 className="text-xl font-bold mb-6">Pool Performance</h3>
          <div className="space-y-4">
            {[
              { pair: "USDT/USDC", tvl: "$1.2M", volume: "$280K", fees: "$840" },
              { pair: "WOVER/USDC", tvl: "$850K", volume: "$170K", fees: "$510" },
            ].map((pool) => (
              <div
                key={pool.pair}
                className="flex items-center justify-between p-4 bg-muted/20 rounded-lg"
              >
                <div>
                  <p className="font-semibold mb-1">{pool.pair}</p>
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                    0.3% Fee
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">TVL: {pool.tvl}</p>
                  <p className="text-sm text-muted-foreground">Vol 24h: {pool.volume}</p>
                  <p className="text-sm text-success">Fees: {pool.fees}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
