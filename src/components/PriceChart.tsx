import { useState, useMemo } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TokenPairIcon } from '@/components/TokenIcon';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PriceChartProps {
  token0: string;
  token1: string;
  className?: string;
}

const timeframes = [
  { label: '1H', value: '1h', points: 12 },
  { label: '24H', value: '24h', points: 24 },
  { label: '7D', value: '7d', points: 28 },
  { label: '30D', value: '30d', points: 30 },
];

// Generate realistic mock price data
const generatePriceData = (basePrice: number, volatility: number, points: number, trend: number) => {
  const data = [];
  let price = basePrice;
  const now = Date.now();
  const interval = (points === 12 ? 5 : points === 24 ? 60 : points === 28 ? 360 : 1440) * 60 * 1000;
  
  for (let i = points; i >= 0; i--) {
    const randomChange = (Math.random() - 0.5) * volatility;
    const trendChange = trend * (1 - i / points);
    price = price * (1 + randomChange + trendChange * 0.001);
    
    data.push({
      time: now - i * interval,
      price: Number(price.toFixed(6)),
      volume: Math.floor(Math.random() * 100000) + 50000,
    });
  }
  
  return data;
};

const getPairConfig = (token0: string, token1: string) => {
  const pair = `${token0}/${token1}`;
  
  // OVER price ~$0.005 based on CoinGecko data
  const configs: Record<string, { basePrice: number; volatility: number; trend: number }> = {
    'USDT/USDC': { basePrice: 1.0001, volatility: 0.0002, trend: 0.1 },
    'USDC/USDT': { basePrice: 0.9999, volatility: 0.0002, trend: -0.1 },
    'WOVER/USDC': { basePrice: 0.005, volatility: 0.05, trend: -4.5 },
    'WOVER/USDT': { basePrice: 0.005, volatility: 0.05, trend: -4.5 },
    'USDC/WOVER': { basePrice: 200, volatility: 0.05, trend: 4.5 },
    'USDT/WOVER': { basePrice: 200, volatility: 0.05, trend: 4.5 },
  };
  
  return configs[pair] || { basePrice: 1, volatility: 0.02, trend: 0 };
};

const formatTime = (timestamp: number, timeframe: string) => {
  const date = new Date(timestamp);
  if (timeframe === '1h' || timeframe === '24h') {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const CustomTooltip = ({ active, payload, label, token0, token1 }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3 border border-primary/30 rounded-lg">
        <p className="text-xs text-muted-foreground mb-1">
          {new Date(label).toLocaleString()}
        </p>
        <p className="text-sm font-semibold text-foreground">
          1 {token0} = {payload[0].value.toFixed(6)} {token1}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Vol: ${payload[0].payload.volume.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

export const PriceChart = ({ token0, token1, className = '' }: PriceChartProps) => {
  const [timeframe, setTimeframe] = useState('24h');
  
  const config = useMemo(() => getPairConfig(token0, token1), [token0, token1]);
  
  const data = useMemo(() => {
    const tf = timeframes.find(t => t.value === timeframe);
    return generatePriceData(config.basePrice, config.volatility, tf?.points || 24, config.trend);
  }, [timeframe, config]);
  
  const currentPrice = data[data.length - 1]?.price || 0;
  const startPrice = data[0]?.price || 0;
  const priceChange = ((currentPrice - startPrice) / startPrice) * 100;
  const isPositive = priceChange >= 0;
  
  const minPrice = Math.min(...data.map(d => d.price));
  const maxPrice = Math.max(...data.map(d => d.price));
  const padding = (maxPrice - minPrice) * 0.1;

  return (
    <Card className={`glass-card p-4 md:p-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <TokenPairIcon token0={token0} token1={token1} size="lg" />
          <div>
            <h3 className="text-lg font-bold text-foreground">
              {token0} / {token1}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold gradient-text">
                {currentPrice.toFixed(token0 === 'USDT' && token1 === 'USDC' ? 4 : 4)}
              </span>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                isPositive 
                  ? 'bg-success/20 text-success' 
                  : 'bg-destructive/20 text-destructive'
              }`}>
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
        
        {/* Timeframe Selector */}
        <div className="flex gap-1 bg-muted/20 p-1 rounded-lg">
          {timeframes.map((tf) => (
            <Button
              key={tf.value}
              variant="ghost"
              size="sm"
              onClick={() => setTimeframe(tf.value)}
              className={`px-3 py-1 text-xs font-medium transition-all ${
                timeframe === tf.value 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              {tf.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 md:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop 
                  offset="0%" 
                  stopColor={isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} 
                  stopOpacity={0.3} 
                />
                <stop 
                  offset="100%" 
                  stopColor={isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} 
                  stopOpacity={0} 
                />
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(var(--border))" 
              opacity={0.3}
              vertical={false}
            />
            <XAxis 
              dataKey="time" 
              tickFormatter={(value) => formatTime(value, timeframe)}
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              minTickGap={30}
            />
            <YAxis 
              domain={[minPrice - padding, maxPrice + padding]}
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value.toFixed(4)}
              width={60}
            />
            <Tooltip 
              content={<CustomTooltip token0={token0} token1={token1} />}
              cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '5 5' }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
              strokeWidth={2}
              fill="url(#priceGradient)"
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border/30">
        <div>
          <p className="text-xs text-muted-foreground mb-1">24h High</p>
          <p className="text-sm font-semibold text-foreground">{maxPrice.toFixed(4)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">24h Low</p>
          <p className="text-sm font-semibold text-foreground">{minPrice.toFixed(4)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">24h Volume</p>
          <p className="text-sm font-semibold text-foreground">
            ${data.reduce((sum, d) => sum + d.volume, 0).toLocaleString()}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default PriceChart;
