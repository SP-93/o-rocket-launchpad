import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Coins, Flame, Users, Building, TrendingUp } from "lucide-react";

const TokenomicsSection = () => {
  const distributionData = [
    { name: "Presale", value: 25, amount: "250M", color: "hsl(var(--primary))" },
    { name: "Initial Liquidity", value: 15, amount: "150M", color: "hsl(var(--secondary))" },
    { name: "Farm Rewards", value: 60, amount: "600M", color: "hsl(var(--accent))" },
  ];

  const farmBreakdown = [
    { name: "Stakers (75%)", value: 405, color: "hsl(var(--success))" },
    { name: "Platform (25%)", value: 135, color: "hsl(var(--warning))" },
    { name: "Burned (10%)", value: 60, color: "hsl(var(--destructive))" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Coins className="w-8 h-8 text-primary" />
        <h2 className="text-2xl md:text-3xl font-bold gradient-text">ROCKET Tokenomics</h2>
      </div>

      {/* Total Supply */}
      <div className="glass-card p-6 rounded-xl border border-primary/20 text-center">
        <p className="text-muted-foreground mb-2">Total Supply</p>
        <p className="text-4xl md:text-5xl font-bold gradient-text">1,000,000,000</p>
        <p className="text-xl text-muted-foreground mt-1">ROCKET</p>
      </div>

      {/* Distribution Chart */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="glass-card p-6 rounded-xl border border-primary/20">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Token Distribution</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}%`}
                  labelLine={false}
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name, props) => [`${props.payload.amount} ROCKET`, name]}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--primary) / 0.2)',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl border border-primary/20">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Allocation Details</h3>
          <div className="space-y-4">
            {distributionData.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/10">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium text-foreground">{item.name}</span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary">{item.amount}</p>
                  <p className="text-sm text-muted-foreground">{item.value}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Farm Rewards Breakdown */}
      <div className="glass-card p-6 rounded-xl border border-primary/20">
        <h3 className="text-lg font-semibold mb-6 text-foreground flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Farm Rewards Breakdown (600M over 10 Years)
        </h3>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-4 rounded-lg bg-success/10 border border-success/20 text-center">
            <Users className="w-8 h-8 text-success mx-auto mb-2" />
            <p className="text-2xl font-bold text-success">405M</p>
            <p className="text-sm text-muted-foreground">LP Stakers (75%)</p>
            <p className="text-xs text-muted-foreground mt-1">~40.5M/year</p>
          </div>
          
          <div className="p-4 rounded-lg bg-warning/10 border border-warning/20 text-center">
            <Building className="w-8 h-8 text-warning mx-auto mb-2" />
            <p className="text-2xl font-bold text-warning">135M</p>
            <p className="text-sm text-muted-foreground">Platform (25%)</p>
            <p className="text-xs text-muted-foreground mt-1">Development & Liquidity</p>
          </div>
          
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
            <Flame className="w-8 h-8 text-destructive mx-auto mb-2" />
            <p className="text-2xl font-bold text-destructive">60M</p>
            <p className="text-sm text-muted-foreground">Burned (10%)</p>
            <p className="text-xs text-muted-foreground mt-1">Deflationary</p>
          </div>
        </div>
      </div>

      {/* Farm Pools */}
      <div className="glass-card p-6 rounded-xl border border-primary/20">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Farming Pools</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
            <h4 className="font-medium text-foreground mb-2">ROCKET/USDT LP</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• ~27M ROCKET annual rewards</li>
              <li>• 10% burn per distribution</li>
              <li>• Active upon farm launch</li>
            </ul>
          </div>
          <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
            <h4 className="font-medium text-foreground mb-2">ROCKET/USDC LP</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• ~27M ROCKET annual rewards</li>
              <li>• 10% burn per distribution</li>
              <li>• Pending official USDC pool</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl border border-primary/20 text-center">
          <p className="text-2xl font-bold text-primary">54M</p>
          <p className="text-sm text-muted-foreground">Annual Emission</p>
        </div>
        <div className="glass-card p-4 rounded-xl border border-primary/20 text-center">
          <p className="text-2xl font-bold text-primary">10</p>
          <p className="text-sm text-muted-foreground">Years of Farming</p>
        </div>
        <div className="glass-card p-4 rounded-xl border border-primary/20 text-center">
          <p className="text-2xl font-bold text-destructive">60M</p>
          <p className="text-sm text-muted-foreground">Total Burn</p>
        </div>
        <div className="glass-card p-4 rounded-xl border border-primary/20 text-center">
          <p className="text-2xl font-bold text-success">940M</p>
          <p className="text-sm text-muted-foreground">Final Supply</p>
        </div>
      </div>

      {/* Rocket.fun Ecosystem */}
      <div className="glass-card p-6 rounded-xl border border-primary/20">
        <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
          🚀 Rocket.fun Fee Distribution
        </h3>
        <p className="text-muted-foreground mb-4">
          Fees from the Rocket.fun launchpad support both token creators and platform development:
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-warning/20 bg-warning/10">
            <p className="text-lg font-bold text-warning">1.25%</p>
            <p className="text-sm text-muted-foreground">Bonding Curve Fee</p>
            <p className="text-xs text-muted-foreground mt-1">During token launch phase</p>
          </div>
          <div className="p-4 rounded-lg border border-primary/20 bg-primary/10">
            <p className="text-lg font-bold text-primary">1%</p>
            <p className="text-sm text-muted-foreground">DEX Trading Fee</p>
            <p className="text-xs text-muted-foreground mt-1">50% creator / 50% platform</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenomicsSection;
