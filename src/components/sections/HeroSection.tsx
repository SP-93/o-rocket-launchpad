import { Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";
import NeonButton from "@/components/ui/NeonButton";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center px-4">
      <div className="container mx-auto text-center">
        {/* Animated Rocket */}
        <div className="mb-6 sm:mb-8 flex justify-center">
          <div className="relative animate-float">
            <Rocket className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 text-primary glow-effect" />
            {/* Rocket exhaust */}
            <div className="absolute -bottom-3 sm:-bottom-4 left-1/2 transform -translate-x-1/2">
              <div className="w-6 h-12 sm:w-8 sm:h-16 bg-gradient-to-b from-orange-400 via-yellow-300 to-transparent rounded-full blur-sm animate-pulse" />
            </div>
          </div>
        </div>

        {/* Hero Text */}
        <h1 className="text-4xl sm:text-6xl md:text-8xl font-bold mb-4 sm:mb-6 animate-slide-up">
          <span className="gradient-text">O'ROCKET</span>
        </h1>
        
        <p className="text-xl sm:text-2xl md:text-4xl text-muted-foreground mb-3 sm:mb-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          Launch Your Liquidity to the Moon
        </p>
        
        <p className="text-base sm:text-lg md:text-xl text-muted-foreground/80 mb-8 sm:mb-12 max-w-2xl mx-auto animate-slide-up px-2" style={{ animationDelay: '0.2s' }}>
          DeFi on OverProtocol, Elevated. Trade and provide liquidity with concentrated liquidity positions on the most advanced DEX.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center animate-slide-up px-4" style={{ animationDelay: '0.3s' }}>
          <NeonButton 
            onClick={() => navigate('/swap')}
            className="text-base sm:text-lg px-8 sm:px-10 py-3 sm:py-4 w-full sm:w-auto"
          >
            <Rocket className="w-4 h-4 sm:w-5 sm:h-5" />
            Start Trading
          </NeonButton>
          
          <NeonButton 
            onClick={() => navigate('/pools')}
            variant="secondary"
            className="text-base sm:text-lg px-8 sm:px-10 py-3 sm:py-4 w-full sm:w-auto"
          >
            Explore Pools
          </NeonButton>
        </div>

        {/* Decorative Elements - hidden on small mobile */}
        <div className="hidden sm:block absolute top-1/2 left-10 w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
        <div className="hidden sm:block absolute top-1/3 right-20 w-3 h-3 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '1s' }} />
        <div className="hidden sm:block absolute bottom-1/4 left-1/4 w-2 h-2 bg-pink-400 rounded-full animate-ping" style={{ animationDelay: '2s' }} />
      </div>
    </section>
  );
};

export default HeroSection;
