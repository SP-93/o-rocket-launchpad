import { ReactNode, CSSProperties, MouseEventHandler } from "react";
import { cn } from "@/lib/utils";

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glowColor?: "cyan" | "purple" | "pink";
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

const GlowCard = ({ children, className, hover = true, glowColor = "cyan", style, onClick }: GlowCardProps) => {
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
        onClick && "cursor-pointer",
        className
      )}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default GlowCard;
