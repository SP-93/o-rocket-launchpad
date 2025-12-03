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
      {/* Deep Space Gradient Background - More refined blue tones */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(220_30%_3%)] via-[hsl(225_40%_8%)] to-[hsl(220_50%_12%)]" />
        
        {/* Nebula Effects - Subtle blue/purple glows */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[120px]" />
        <div className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[80px]" />
      </div>

      {/* Star Field */}
      <StarField />

      {/* Shooting Stars & Meteors */}
      <ShootingStars />

      {/* Floating Objects (Planets, Ships, Comets) */}
      <FloatingObjects />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default SpaceBackground;
