import { ReactNode, MouseEvent } from "react";
import { cn } from "@/lib/utils";

interface NeonButtonProps {
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
}

const NeonButton = ({ 
  children, 
  onClick, 
  variant = "primary", 
  size = "md",
  className,
  disabled = false 
}: NeonButtonProps) => {
  const variantClasses = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    ghost: "bg-transparent hover:bg-muted/50 border border-transparent hover:border-border/50 text-foreground",
    destructive: "bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 hover:border-destructive/50 text-destructive",
  };

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        variantClasses[variant],
        sizeClasses[size],
        "relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-200",
        className
      )}
    >
      {/* Ripple effect on hover */}
      <span className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
      
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
};

export default NeonButton;
