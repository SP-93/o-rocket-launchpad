// Price Impact Warning Component
import { AlertTriangle, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  SwapRiskAssessment, 
  PriceImpactLevel,
  getPriceImpactBgColor 
} from "@/lib/oracleProtection";

interface PriceImpactWarningProps {
  risk: SwapRiskAssessment;
  className?: string;
}

const getIcon = (level: PriceImpactLevel) => {
  switch (level) {
    case 'safe':
      return <ShieldCheck className="h-4 w-4 text-green-500" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'danger':
      return <ShieldAlert className="h-4 w-4 text-red-500" />;
    case 'blocked':
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return null;
  }
};

export const PriceImpactWarning = ({ risk, className = "" }: PriceImpactWarningProps) => {
  // Don't show anything for safe swaps
  if (risk.level === 'safe') return null;

  return (
    <Alert className={`${getPriceImpactBgColor(risk.level)} ${className}`}>
      <div className="flex items-start gap-2">
        {getIcon(risk.level)}
        <AlertDescription className="text-sm">
          {risk.message}
          {risk.level === 'blocked' && (
            <p className="mt-1 text-xs opacity-80">
              Split your swap into smaller amounts or wait for more liquidity.
            </p>
          )}
        </AlertDescription>
      </div>
    </Alert>
  );
};

// Inline price impact badge za prikaz pored quote-a
interface PriceImpactBadgeProps {
  priceImpact: number;
  level: PriceImpactLevel;
}

export const PriceImpactBadge = ({ priceImpact, level }: PriceImpactBadgeProps) => {
  const colorClass = {
    safe: 'text-green-500',
    warning: 'text-yellow-500',
    danger: 'text-red-500',
    blocked: 'text-red-600',
  }[level];

  return (
    <span className={`text-xs font-medium ${colorClass}`}>
      ({priceImpact.toFixed(2)}% impact)
    </span>
  );
};
