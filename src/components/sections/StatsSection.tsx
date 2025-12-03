import GlowCard from "@/components/ui/GlowCard";
import { TrendingUp, DollarSign, Users, Layers } from "lucide-react";

const StatsSection = () => {
  const stats = [
    {
      icon: DollarSign,
      label: "Total Value Locked",
      value: "--",
      color: "cyan" as const,
    },
    {
      icon: TrendingUp,
      label: "24h Trading Volume",
      value: "--",
      color: "purple" as const,
    },
    {
      icon: Layers,
      label: "Active Liquidity Pools",
      value: "3",
      color: "pink" as const,
    },
    {
      icon: Users,
      label: "Liquidity Providers",
      value: "--",
      color: "cyan" as const,
    },
  ];

  return (
    <section className="py-20 px-4">
      <div className="container mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 gradient-text">
          Protocol Statistics
        </h2>
        <p className="text-center text-muted-foreground mb-12 text-sm">
          Real-time data coming soon after mainnet launch
        </p>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {stats.map((stat, index) => (
            <GlowCard 
              key={stat.label} 
              glowColor={stat.color}
              className="p-4 md:p-6 text-center animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` } as React.CSSProperties}
            >
              <div className="flex justify-center mb-3 md:mb-4">
                <stat.icon className="w-8 h-8 md:w-12 md:h-12 text-primary" />
              </div>
              
              <div className="text-2xl md:text-3xl font-bold mb-2 text-foreground">
                {stat.value}
              </div>
              
              <p className="text-muted-foreground text-xs md:text-sm">{stat.label}</p>
            </GlowCard>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
