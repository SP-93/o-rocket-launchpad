import { ReactNode, MouseEvent } from "react";
import { cn } from "@/lib/utils";

interface NeonButtonProps {
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  variant?: "primary" | "secondary";
  className?: string;
  disabled?: boolean;
}

const NeonButton = ({ 
  children, 
  onClick, 
  variant = "primary", 
  className,
  disabled = false 
}: NeonButtonProps) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        variant === "primary" ? "btn-primary" : "btn-secondary",
        "relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed",
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
