import { ReactNode, CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glowColor?: "cyan" | "purple" | "pink";
  style?: CSSProperties;
}

const GlowCard = ({ children, className, hover = true, glowColor = "cyan", style }: GlowCardProps) => {
  const glowClass = {
    cyan: "neon-glow-cyan",
    purple: "neon-glow-purple",
    pink: "neon-glow-pink",
  }[glowColor];

  return (
    <div 
      className={cn(
        hover ? "glass-card-hover" : "glass-card",
        hover && glowClass,
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
};

export default GlowCard;
