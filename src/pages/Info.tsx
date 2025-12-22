import SpaceBackground from "@/components/backgrounds/SpaceBackground";
import GlowCard from "@/components/ui/GlowCard";
import PriceChart from "@/components/PriceChart";
import { useCoinGeckoPrice } from "@/hooks/useCoinGeckoPrice";
import { TrendingUp, TrendingDown, DollarSign, Users, Layers, Activity, BarChart3, ExternalLink, RefreshCw, Loader2 } from "lucide-react";
import { TokenIcon } from "@/components/TokenIcon";
import NeonButton from "@/components/ui/NeonButton";
import gateIoLogo from "@/assets/icons/gate-io.jpg";

// Gate.io Logo Component - using official image
const GateLogo = ({ className }: { className?: string }) => (
  <img 
    src={gateIoLogo} 
    alt="Gate.io" 
    className={`rounded-lg ${className || ''}`}
  />
);

// Telegram SVG Logo Component - Standard paper plane
const TelegramLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
  </svg>
);

// X (Twitter) SVG Logo Component - Standard X logo
const XLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

// Exchanges where OVER is traded
const EXCHANGES = [
  { 
    name: 'Gate.io', 
    url: 'https://www.gate.com/referral/cashback?ref=AgJMUFkK&ref_type=103&page=earnVoucher&utm_cmp=PEYEQd', 
    description: 'Buy OVER with referral bonus'
  },
];

// Social links - X accounts use X icon only
const SOCIAL_LINKS = [
  { 
    name: "O'Rocket Telegram", 
    url: 'https://t.me/+6aGbv0-Ct6JjMDEy', 
    type: 'telegram' as const,
    description: 'Join our community'
  },
  { 
    name: "Over Hippo", 
    url: 'https://x.com/SteeWee_93', 
    type: 'x' as const,
    description: '@SteeWee_93'
  },
  { 
    name: 'Over Protocol', 
    url: 'https://x.com/overprotocol', 
    type: 'x' as const,
    description: '@overprotocol'
  },
  { 
    name: 'Ben', 
    url: 'https://x.com/overnance', 
    type: 'x' as const,
    description: '@overnance'
  },
];

const Info = () => {
  const { price, change24h, marketCap, volume24h, high24h, low24h, loading, error, refetch, lastUpdated } = useCoinGeckoPrice();
  const isPositive = change24h >= 0;

  const protocolStats = [
    { icon: DollarSign, label: "Total TVL", placeholder: "--" },
    { icon: TrendingUp, label: "24h Volume", placeholder: "--" },
    { icon: Activity, label: "All-Time Volume", placeholder: "--" },
    { icon: DollarSign, label: "Total Fees", placeholder: "--" },
    { icon: BarChart3, label: "Protocol Revenue", placeholder: "--" },
    { icon: Layers, label: "Active Pools", value: "3" },
    { icon: Users, label: "Total LPs", placeholder: "--" },
    { icon: TrendingUp, label: "24h Transactions", placeholder: "--" },
  ];

  const poolStats = [
    {
      name: "USDT/USDC Pool",
      tvl: "--",
      volume24h: "--",
      volume7d: "--",
      apr: "--",
      positions: "--",
    },
    {
      name: "WOVER/USDC Pool",
      tvl: "--",
      volume24h: "--",
      volume7d: "--",
      apr: "--",
      positions: "--",
    },
    {
      name: "WOVER/USDT Pool",
      tvl: "--",
      volume24h: "--",
      volume7d: "--",
      apr: "--",
      positions: "--",
    },
  ];

  const formatNumber = (num: number) => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  return (
    <SpaceBackground>
      <div className="min-h-screen pt-24 md:pt-32 pb-20 px-4">
        <div className="container mx-auto">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8 md:mb-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 gradient-text">Protocol Analytics</h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground px-2">
              Real-time statistics and insights for O'Rocket DEX
            </p>
          </div>

          {/* Live Market Data Section */}
          <div className="mb-12 md:mb-16">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-center">Live Market Data</h2>
            <div className="max-w-4xl mx-auto">
              <GlowCard className="p-6" glowColor="cyan">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <TokenIcon symbol="WOVER" size="lg" />
                    <div>
                      <h3 className="text-xl font-bold text-foreground">OVER Token</h3>
                      <p className="text-sm text-muted-foreground">OverProtocol Native Token</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <NeonButton variant="secondary" className="text-xs px-3 py-1.5" onClick={refetch} disabled={loading}>
                      <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </NeonButton>
                    <a 
                      href="https://www.coingecko.com/en/coins/overprotocol" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      CoinGecko <ExternalLink className="w-3 h-3" />
                    </a>
                    <a 
                      href="https://coinmarketcap.com/currencies/overprotocol/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      CMC <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Failed to load price data</p>
                    <NeonButton variant="secondary" className="mt-3" onClick={refetch}>
                      Try Again
                    </NeonButton>
                  </div>
                ) : (
                  <>
                    {/* Price and Change */}
                    <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Current Price</p>
                        <p className="text-4xl md:text-5xl font-bold gradient-text">${price.toFixed(5)}</p>
                      </div>
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                        isPositive ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                      }`}>
                        {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {isPositive ? '+' : ''}{change24h.toFixed(2)}% (24h)
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-background/50 rounded-lg p-4 border border-border/30">
                        <p className="text-xs text-muted-foreground mb-1">Market Cap</p>
                        <p className="text-lg font-bold text-foreground">{formatNumber(marketCap)}</p>
                      </div>
                      <div className="bg-background/50 rounded-lg p-4 border border-border/30">
                        <p className="text-xs text-muted-foreground mb-1">24h Volume</p>
                        <p className="text-lg font-bold text-foreground">{formatNumber(volume24h)}</p>
                      </div>
                      <div className="bg-background/50 rounded-lg p-4 border border-border/30">
                        <p className="text-xs text-muted-foreground mb-1">24h High</p>
                        <p className="text-lg font-bold text-success">${high24h.toFixed(5)}</p>
                      </div>
                      <div className="bg-background/50 rounded-lg p-4 border border-border/30">
                        <p className="text-xs text-muted-foreground mb-1">24h Low</p>
                        <p className="text-lg font-bold text-destructive">${low24h.toFixed(5)}</p>
                      </div>
                    </div>

                    {/* Exchanges */}
                    <div>
                      <p className="text-sm font-medium text-foreground mb-3">Trade OVER on:</p>
                      <div className="flex flex-wrap gap-3">
                        {EXCHANGES.map((exchange) => (
                          <a
                            key={exchange.name}
                            href={exchange.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 bg-gradient-to-r from-[#00D4AA]/10 to-[#00B4D8]/10 hover:from-[#00D4AA]/20 hover:to-[#00B4D8]/20 border border-[#00D4AA]/30 hover:border-[#00D4AA]/50 rounded-xl px-5 py-3 transition-all group"
                          >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00D4AA] to-[#00B4D8] flex items-center justify-center shadow-lg shadow-[#00D4AA]/20">
                              <GateLogo className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-left">
                              <span className="text-base font-bold text-foreground block">{exchange.name}</span>
                              <span className="text-xs text-muted-foreground">{exchange.description}</span>
                            </div>
                            <ExternalLink className="w-4 h-4 text-[#00D4AA] opacity-0 group-hover:opacity-100 transition-opacity ml-2" />
                          </a>
                        ))}
                      </div>
                    </div>

                    {lastUpdated && (
                      <p className="text-xs text-muted-foreground mt-4 text-right">
                        Last updated: {new Date(lastUpdated).toLocaleTimeString()}
                      </p>
                    )}
                  </>
                )}
              </GlowCard>
            </div>
          </div>

          {/* Community & Social Links */}
          <div className="mb-12 md:mb-16">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-center">Community & Social</h2>
            <div className="max-w-4xl mx-auto">
              <GlowCard className="p-6" glowColor="purple">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {SOCIAL_LINKS.map((link) => (
                    <a
                      key={link.name}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-3 bg-background/50 hover:bg-primary/10 border border-border/30 hover:border-primary/30 rounded-xl p-4 transition-all group hover:scale-105"
                    >
                      {link.type === 'telegram' ? (
                        <div className="w-14 h-14 rounded-full bg-[#0088cc] flex items-center justify-center shadow-lg shadow-[#0088cc]/30 group-hover:shadow-[#0088cc]/50 transition-all">
                          <TelegramLogo className="w-8 h-8 text-white" />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-foreground flex items-center justify-center shadow-lg group-hover:shadow-foreground/30 transition-all">
                          <XLogo className="w-8 h-8 text-background" />
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-sm font-semibold text-foreground">{link.name}</p>
                        <p className="text-xs text-muted-foreground">{link.description}</p>
                      </div>
                      <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ))}
                </div>
              </GlowCard>
            </div>
          </div>

          {/* Data Notice */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 text-center">
              <p className="text-sm text-muted-foreground">
                📊 Protocol-specific data will be available after pools receive trading activity
              </p>
            </div>
          </div>

          {/* Protocol Overview Stats */}
          <div className="mb-12 md:mb-16">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-center">Protocol Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {protocolStats.map((stat, index) => (
                <GlowCard 
                  key={stat.label}
                  className="p-4 md:p-6 text-center animate-slide-up"
                  style={{ animationDelay: `${index * 0.05}s` } as React.CSSProperties}
                >
                  <div className="flex justify-center mb-3 md:mb-4">
                    <stat.icon className="w-8 h-8 md:w-10 md:h-10 text-primary" />
                  </div>
                  <div className="text-lg md:text-2xl font-bold mb-1 md:mb-2">
                    {stat.value || stat.placeholder}
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">{stat.label}</p>
                </GlowCard>
              ))}
            </div>
          </div>

          {/* Price Charts */}
          <div className="mb-12 md:mb-16">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-center">Price Charts</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
              <PriceChart token0="WOVER" token1="USDC" />
              <PriceChart token0="WOVER" token1="USDT" />
            </div>
            <div className="mt-6 max-w-3xl mx-auto">
              <PriceChart token0="USDT" token1="USDC" />
            </div>
          </div>

          {/* Pool Statistics */}
          <div className="mb-12 md:mb-16">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-center">Pool Performance</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {poolStats.map((pool, index) => (
                <GlowCard 
                  key={pool.name} 
                  className="p-4 md:p-6"
                  glowColor={index === 0 ? "cyan" : index === 1 ? "purple" : "pink"}
                >
                  <h3 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 gradient-text">{pool.name}</h3>
                  <div className="space-y-3 md:space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">TVL</span>
                      <span className="text-lg md:text-xl font-bold">{pool.tvl}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">24h Volume</span>
                      <span className="text-lg md:text-xl font-bold">{pool.volume24h}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">7d Volume</span>
                      <span className="text-lg md:text-xl font-bold">{pool.volume7d}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">APR</span>
                      <span className="text-lg md:text-xl font-bold text-muted-foreground">{pool.apr}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">LP Positions</span>
                      <span className="text-lg md:text-xl font-bold">{pool.positions}</span>
                    </div>
                  </div>
                </GlowCard>
              ))}
            </div>
          </div>

          {/* How It Works */}
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-center">How O'Rocket Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <GlowCard className="p-6 text-center">
                <div className="w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                  <span className="text-xl md:text-2xl font-bold text-primary">1</span>
                </div>
                <h3 className="text-lg md:text-xl font-bold mb-3">Connect Wallet</h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Connect your MetaMask or OverWallet to get started with trading and liquidity provision.
                </p>
              </GlowCard>

              <GlowCard className="p-6 text-center" glowColor="purple">
                <div className="w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 rounded-full bg-secondary/20 flex items-center justify-center border border-secondary/30">
                  <span className="text-xl md:text-2xl font-bold text-secondary">2</span>
                </div>
                <h3 className="text-lg md:text-xl font-bold mb-3">Provide Liquidity</h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Add liquidity to pools with concentrated ranges for higher capital efficiency and APR.
                </p>
              </GlowCard>

              <GlowCard className="p-6 text-center" glowColor="pink">
                <div className="w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 rounded-full bg-accent/20 flex items-center justify-center border border-accent/30">
                  <span className="text-xl md:text-2xl font-bold text-accent">3</span>
                </div>
                <h3 className="text-lg md:text-xl font-bold mb-3">Earn Fees</h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Earn 75% of trading fees from every swap, automatically compounded into your position.
                </p>
              </GlowCard>
            </div>
          </div>
        </div>
      </div>
    </SpaceBackground>
  );
};

export default Info;