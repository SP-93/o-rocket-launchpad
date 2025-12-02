import GlowCard from "@/components/ui/GlowCard";
import AnimatedCounter from "@/components/ui/AnimatedCounter";
import { TrendingUp, DollarSign, Users, Layers } from "lucide-react";

const StatsSection = () => {
  const stats = [
    {
      icon: DollarSign,
      label: "Total Value Locked",
      value: 45600000,
      prefix: "$",
      suffix: "M",
      decimals: 1,
      color: "cyan" as const,
    },
    {
      icon: TrendingUp,
      label: "24h Trading Volume",
      value: 8200000,
      prefix: "$",
      suffix: "M",
      decimals: 1,
      color: "purple" as const,
    },
    {
      icon: Layers,
      label: "Active Liquidity Pools",
      value: 2,
      suffix: "",
      decimals: 0,
      color: "pink" as const,
    },
    {
      icon: Users,
      label: "Liquidity Providers",
      value: 1250,
      suffix: "+",
      decimals: 0,
      color: "cyan" as const,
    },
  ];

  return (
    <section className="py-20 px-4">
      <div className="container mx-auto">
        <h2 className="text-4xl font-bold text-center mb-12 gradient-text">
          Protocol Statistics
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <GlowCard 
              key={stat.label} 
              glowColor={stat.color}
              className="p-6 text-center animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` } as React.CSSProperties}
            >
              <div className="flex justify-center mb-4">
                <stat.icon className="w-12 h-12 text-primary" />
              </div>
              
              <div className="text-3xl font-bold mb-2">
                <AnimatedCounter 
                  end={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  decimals={stat.decimals}
                />
              </div>
              
              <p className="text-muted-foreground">{stat.label}</p>
            </GlowCard>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
