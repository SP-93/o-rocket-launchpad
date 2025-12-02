import { ReactNode } from "react";
import StarField from "./StarField";
import ShootingStars from "./ShootingStars";
import FloatingObjects from "./FloatingObjects";

interface SpaceBackgroundProps {
  children: ReactNode;
}

const SpaceBackground = ({ children }: SpaceBackgroundProps) => {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Deep Space Gradient Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(5_7%_4%)] via-[hsl(245_45%_9%)] to-[hsl(230_55%_15%)]" />
        
        {/* Nebula Effect */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-purple-500/10 rounded-full blur-[150px] animate-pulse-glow" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse-glow" style={{ animationDelay: '1s' }} />
      </div>

      {/* Star Field */}
      <StarField />

      {/* Shooting Stars & Meteors */}
      <ShootingStars />

      {/* Floating Objects (Moon, Ships, Comets) */}
      <FloatingObjects />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default SpaceBackground;
