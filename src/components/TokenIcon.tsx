import usdtLogo from '@/assets/tokens/usdt.png';
import usdcLogo from '@/assets/tokens/usdc.png';
import woverLogo from '@/assets/tokens/wover.png';

const tokenLogos: Record<string, string> = {
  USDT: usdtLogo,
  USDC: usdcLogo,
  WOVER: woverLogo,
  OVER: woverLogo,
};

interface TokenIconProps {
  symbol: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-10 h-10',
};

export const TokenIcon = ({ symbol, size = 'md', className = '' }: TokenIconProps) => {
  const logo = tokenLogos[symbol.toUpperCase()];
  
  if (!logo) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary ${className}`}>
        {symbol.slice(0, 2)}
      </div>
    );
  }

  return (
    <img 
      src={logo} 
      alt={`${symbol} logo`}
      className={`${sizeClasses[size]} rounded-full object-contain ${className}`}
    />
  );
};

interface TokenPairIconProps {
  token0: string;
  token1: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const TokenPairIcon = ({ token0, token1, size = 'md', className = '' }: TokenPairIconProps) => {
  const pairSizes = {
    sm: { outer: 'w-10', icon: 'sm' as const, offset: '-ml-2' },
    md: { outer: 'w-14', icon: 'md' as const, offset: '-ml-3' },
    lg: { outer: 'w-18', icon: 'lg' as const, offset: '-ml-4' },
  };

  const { icon, offset } = pairSizes[size];

  return (
    <div className={`flex items-center ${className}`}>
      <TokenIcon symbol={token0} size={icon} className="ring-2 ring-background z-10" />
      <TokenIcon symbol={token1} size={icon} className={`${offset} ring-2 ring-background`} />
    </div>
  );
};

export default TokenIcon;
