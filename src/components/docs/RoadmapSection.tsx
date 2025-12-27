import { Map, CheckCircle2, Clock, Calendar, Sparkles, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RoadmapItem {
  quarter: string;
  title: string;
  items: string[];
  status: "completed" | "in-progress" | "planned" | "future" | "live";
}

const RoadmapSection = () => {
  const roadmapData: RoadmapItem[] = [
    {
      quarter: "🎮 LIVE",
      title: "Rocket Crash Game",
      items: [
        "Multiplayer crash betting game",
        "Provably fair crash algorithm",
        "Ticket-based entry system (WOVER/USDT)",
        "Real-time multiplier display",
        "Auto cash-out functionality",
        "Prize pool & revenue distribution",
      ],
      status: "live",
    },
    {
      quarter: "Q4 2025",
      title: "Foundation",
      items: [
        "DEX smart contract development",
        "Frontend UI/UX design",
        "Core swap functionality",
        "Wallet integration (Web3Modal)",
      ],
      status: "in-progress",
    },
    {
      quarter: "Q1 2026",
      title: "Token Genesis",
      items: [
        "ROCKET token mint (1B to Admin Wallet)",
        "DEX mainnet deployment",
        "Pool creation interface",
        "Liquidity provision system",
      ],
      status: "planned",
    },
    {
      quarter: "Q2 2026",
      title: "Rocket.fun Development",
      items: [
        "Bonding curve smart contracts",
        "Token creation interface (150M-1B supply options)",
        "Auto-migration to DEX (80% sold trigger)",
        "Creator royalty system (50% of DEX fees)",
        "Platform LP management for fee collection",
        "Monthly payout system for creators",
      ],
      status: "planned",
    },
    {
      quarter: "H2 2026",
      title: "Presale & Launch",
      items: [
        "ROCKET presale (250M tokens)",
        "Presale with OVER/WOVER + USDT",
        "Manual token distribution to buyers",
        "ROCKET/OVER & ROCKET/USDT pool creation",
        "Initial liquidity deployment (150M)",
        "Rocket.fun public launch",
      ],
      status: "planned",
    },
    {
      quarter: "2027",
      title: "Farm Launch",
      items: [
        "ROCKET/USDT LP farming",
        "ROCKET/USDC LP farming (pending official pool)",
        "Staking rewards distribution",
        "10% burn mechanism activation",
      ],
      status: "future",
    },
    {
      quarter: "2027-2036",
      title: "Long-term Emissions",
      items: [
        "54M ROCKET annual emissions",
        "75% to LP stakers / 25% platform",
        "Continuous burn (6M/year)",
        "APR adjustments based on TVL",
      ],
      status: "future",
    },
    {
      quarter: "Future",
      title: "Expansion",
      items: [
        "Base bridge integration (pending Over bridge)",
        "Cross-chain liquidity",
        "Arbitrage bot tools",
        "Governance system",
        "Additional partnerships",
      ],
      status: "future",
    },
  ];

  const getStatusBadge = (status: RoadmapItem["status"]) => {
    switch (status) {
      case "live":
        return (
          <Badge className="bg-success/30 text-success border-success/50 animate-pulse">
            <Rocket className="w-3 h-3 mr-1" />
            LIVE
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-success/20 text-success border-success/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case "in-progress":
        return (
          <Badge className="bg-primary/20 text-primary border-primary/30">
            <Clock className="w-3 h-3 mr-1 animate-pulse" />
            In Progress
          </Badge>
        );
      case "planned":
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30">
            <Calendar className="w-3 h-3 mr-1" />
            Planned
          </Badge>
        );
      case "future":
        return (
          <Badge className="bg-secondary/50 text-muted-foreground border-secondary">
            <Sparkles className="w-3 h-3 mr-1" />
            Future
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Map className="w-8 h-8 text-primary" />
        <h2 className="text-2xl md:text-3xl font-bold gradient-text">Roadmap</h2>
      </div>

      {/* Flexibility Notice */}
      <div className="glass-card p-4 rounded-xl border border-warning/30 bg-warning/5">
        <p className="text-warning text-sm">
          ⚠️ <strong>Note:</strong> This roadmap is subject to change based on market conditions, partnerships, and ecosystem developments. Some features are dependent on Over Protocol's bridge to Base network.
        </p>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-transparent" />

        <div className="space-y-8">
          {roadmapData.map((item, index) => (
            <div
              key={index}
              className={`relative flex flex-col md:flex-row gap-4 md:gap-8 ${
                index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
              }`}
            >
              {/* Timeline Dot */}
              <div className="absolute left-4 md:left-1/2 w-3 h-3 rounded-full bg-primary border-4 border-background transform -translate-x-1/2 mt-6 z-10" />

              {/* Content */}
              <div className={`ml-10 md:ml-0 md:w-1/2 ${index % 2 === 0 ? "md:pr-12 md:text-right" : "md:pl-12"}`}>
                <div className="glass-card p-6 rounded-xl border border-primary/20 hover:border-primary/40 transition-colors">
                  <div className={`flex items-center gap-3 mb-3 ${index % 2 === 0 ? "md:justify-end" : ""}`}>
                    <span className="text-sm font-semibold text-primary">{item.quarter}</span>
                    {getStatusBadge(item.status)}
                  </div>
                  
                  <h3 className="text-xl font-bold text-foreground mb-3">{item.title}</h3>
                  
                  <ul className={`space-y-2 text-muted-foreground ${index % 2 === 0 ? "md:text-right" : ""}`}>
                    {item.items.map((listItem, listIndex) => (
                      <li key={listIndex} className="flex items-start gap-2">
                        <span className="text-primary mt-1 hidden md:inline">•</span>
                        <span className="md:hidden text-primary">•</span>
                        <span>{listItem}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Spacer for alternating layout */}
              <div className="hidden md:block md:w-1/2" />
            </div>
          ))}
        </div>
      </div>

      {/* Dependencies Note */}
      <div className="glass-card p-6 rounded-xl border border-primary/20">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Key Dependencies</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="text-primary">🌉</span>
            <p><strong className="text-foreground">Over Bridge to Base:</strong> Expected by end of 2026. Required for cross-chain expansion.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary">💵</span>
            <p><strong className="text-foreground">Official USDC Pool:</strong> ROCKET/USDC farming depends on Over Protocol's native USDC integration.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoadmapSection;
