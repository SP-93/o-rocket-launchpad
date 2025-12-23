// Oracle Protection - Price Impact & Swap Limits
// Zaštita korisnika od velikih gubitaka

export interface OracleConfig {
  // Price impact thresholds (%)
  priceImpactWarning: number;    // Žuto upozorenje
  priceImpactDanger: number;     // Crveno upozorenje
  priceImpactBlock: number;      // Blokiraj swap
  
  // Max swap limits (USD equivalent)
  maxSwapUsd: number;            // Max vrednost po swapu
  maxSwapPerToken: Record<string, number>; // Max po tokenu
  
  // Rate limiting
  maxSwapsPerHour: number;       // Max broj swapova na sat
  cooldownSeconds: number;       // Pauza između swapova
}

// Default conservative configuration
export const DEFAULT_ORACLE_CONFIG: OracleConfig = {
  priceImpactWarning: 1,      // 1% - žuto upozorenje
  priceImpactDanger: 3,       // 3% - crveno upozorenje
  priceImpactBlock: 10,       // 10% - blokiraj bez potvrde
  
  maxSwapUsd: 50000,          // $50k max po swapu
  maxSwapPerToken: {
    USDT: 50000,
    USDC: 50000,
    WOVER: 100000,
    OVER: 100000,
  },
  
  maxSwapsPerHour: 20,
  cooldownSeconds: 5,
};

export type PriceImpactLevel = 'safe' | 'warning' | 'danger' | 'blocked';

export interface SwapRiskAssessment {
  level: PriceImpactLevel;
  priceImpact: number;
  message: string;
  requiresConfirmation: boolean;
  blocked: boolean;
}

// Proceni rizik swapa na osnovu price impacta
export const assessSwapRisk = (
  priceImpact: number,
  config: OracleConfig = DEFAULT_ORACLE_CONFIG
): SwapRiskAssessment => {
  if (priceImpact >= config.priceImpactBlock) {
    return {
      level: 'blocked',
      priceImpact,
      message: `Price impact too high (${priceImpact.toFixed(2)}%). This swap would result in significant losses.`,
      requiresConfirmation: true,
      blocked: true,
    };
  }
  
  if (priceImpact >= config.priceImpactDanger) {
    return {
      level: 'danger',
      priceImpact,
      message: `High price impact (${priceImpact.toFixed(2)}%). You may receive significantly less than expected.`,
      requiresConfirmation: true,
      blocked: false,
    };
  }
  
  if (priceImpact >= config.priceImpactWarning) {
    return {
      level: 'warning',
      priceImpact,
      message: `Price impact is ${priceImpact.toFixed(2)}%. Consider swapping smaller amounts.`,
      requiresConfirmation: false,
      blocked: false,
    };
  }
  
  return {
    level: 'safe',
    priceImpact,
    message: '',
    requiresConfirmation: false,
    blocked: false,
  };
};

// Proveri da li swap prelazi max limit
export const checkSwapLimit = (
  amount: number,
  tokenSymbol: string,
  tokenPriceUsd: number = 1,
  config: OracleConfig = DEFAULT_ORACLE_CONFIG
): { allowed: boolean; reason?: string } => {
  const valueUsd = amount * tokenPriceUsd;
  
  // Check USD limit
  if (valueUsd > config.maxSwapUsd) {
    return {
      allowed: false,
      reason: `Swap exceeds maximum limit of $${config.maxSwapUsd.toLocaleString()} USD`,
    };
  }
  
  // Check per-token limit
  const tokenLimit = config.maxSwapPerToken[tokenSymbol];
  if (tokenLimit && amount > tokenLimit) {
    return {
      allowed: false,
      reason: `Swap exceeds maximum ${tokenSymbol} limit of ${tokenLimit.toLocaleString()}`,
    };
  }
  
  return { allowed: true };
};

// Rate limiting - sprečava spam swapove
const swapHistory: number[] = [];

export const checkRateLimit = (
  config: OracleConfig = DEFAULT_ORACLE_CONFIG
): { allowed: boolean; waitSeconds?: number } => {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  
  // Clean old entries
  while (swapHistory.length > 0 && swapHistory[0] < hourAgo) {
    swapHistory.shift();
  }
  
  // Check hourly limit
  if (swapHistory.length >= config.maxSwapsPerHour) {
    return {
      allowed: false,
      waitSeconds: Math.ceil((swapHistory[0] + 60 * 60 * 1000 - now) / 1000),
    };
  }
  
  // Check cooldown
  const lastSwap = swapHistory[swapHistory.length - 1];
  if (lastSwap && now - lastSwap < config.cooldownSeconds * 1000) {
    return {
      allowed: false,
      waitSeconds: Math.ceil((lastSwap + config.cooldownSeconds * 1000 - now) / 1000),
    };
  }
  
  return { allowed: true };
};

export const recordSwap = (): void => {
  swapHistory.push(Date.now());
};

// Formatiranje za UI
export const getPriceImpactColor = (level: PriceImpactLevel): string => {
  switch (level) {
    case 'safe': return 'text-green-500';
    case 'warning': return 'text-yellow-500';
    case 'danger': return 'text-red-500';
    case 'blocked': return 'text-red-600';
    default: return 'text-muted-foreground';
  }
};

export const getPriceImpactBgColor = (level: PriceImpactLevel): string => {
  switch (level) {
    case 'safe': return 'bg-green-500/10 border-green-500/20';
    case 'warning': return 'bg-yellow-500/10 border-yellow-500/20';
    case 'danger': return 'bg-red-500/10 border-red-500/20';
    case 'blocked': return 'bg-red-600/20 border-red-600/30';
    default: return 'bg-muted/10';
  }
};
