import SpaceBackground from "@/components/backgrounds/SpaceBackground";
import HeroSection from "@/components/sections/HeroSection";
import StatsSection from "@/components/sections/StatsSection";
import FeaturedPools from "@/components/sections/FeaturedPools";
import GlowCard from "@/components/ui/GlowCard";
import { Rocket, Wallet, TrendingUp } from "lucide-react";

const Index = () => {
  return (
    <SpaceBackground>
      <div className="min-h-screen">
        {/* Hero Section */}
        <HeroSection />

        {/* Stats Section */}
        <StatsSection />

        {/* Featured Pools */}
        <FeaturedPools />

        {/* How It Works Section */}
        <section className="py-20 px-4">
          <div className="container mx-auto">
            <h2 className="text-4xl font-bold text-center mb-4 gradient-text">
              How It Works
            </h2>
            <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
              Start earning in three simple steps
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <GlowCard className="p-8 text-center animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/40">
                  <Wallet className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">1. Connect Wallet</h3>
                <p className="text-muted-foreground">
                  Connect your MetaMask or OverWallet to access the OverProtocol network
                </p>
              </GlowCard>

              <GlowCard className="p-8 text-center animate-slide-up" glowColor="purple" style={{ animationDelay: '0.2s' }}>
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-secondary/20 flex items-center justify-center border-2 border-secondary/40">
                  <Rocket className="w-10 h-10 text-secondary" />
                </div>
                <h3 className="text-xl font-bold mb-3">2. Provide Liquidity</h3>
                <p className="text-muted-foreground">
                  Add liquidity to pools with concentrated ranges for maximum capital efficiency
                </p>
              </GlowCard>

              <GlowCard className="p-8 text-center animate-slide-up" glowColor="pink" style={{ animationDelay: '0.3s' }}>
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent/20 flex items-center justify-center border-2 border-accent/40">
                  <TrendingUp className="w-10 h-10 text-accent" />
                </div>
                <h3 className="text-xl font-bold mb-3">3. Earn Fees</h3>
                <p className="text-muted-foreground">
                  Earn 75% of all trading fees automatically compounded into your position
                </p>
              </GlowCard>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 border-t border-primary/20">
          <div className="container mx-auto px-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Rocket className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold gradient-text">O'ROCKET</span>
            </div>
            <p className="text-muted-foreground mb-2">Built on OverProtocol Mainnet</p>
            <p className="text-sm text-muted-foreground/60">© 2024 O'Rocket. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </SpaceBackground>
  );
};

export default Index;
