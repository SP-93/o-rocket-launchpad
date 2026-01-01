import { Link } from 'react-router-dom';
import { Rocket, Dice1, Target, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GameCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  status: 'live' | 'coming';
  gradient: string;
}

const GameCard = ({ title, description, icon, path, status, gradient }: GameCardProps) => (
  <div className={`relative group overflow-hidden rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:border-primary/50 ${status === 'coming' ? 'opacity-60' : ''}`}>
    {/* Gradient background */}
    <div className={`absolute inset-0 opacity-20 ${gradient}`} />
    
    {/* Status badge */}
    <div className="absolute top-4 right-4">
      {status === 'live' ? (
        <span className="px-3 py-1 text-xs font-bold rounded-full bg-success/20 text-success border border-success/30 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          LIVE
        </span>
      ) : (
        <span className="px-3 py-1 text-xs font-medium rounded-full bg-muted/50 text-muted-foreground border border-border/30 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Coming Soon
        </span>
      )}
    </div>

    <div className="relative p-6 space-y-4">
      {/* Icon */}
      <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
        {icon}
      </div>

      {/* Content */}
      <div>
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {/* Action */}
      {status === 'live' ? (
        <Link to={path}>
          <Button className="w-full btn-primary">
            Play Now
            <Sparkles className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      ) : (
        <Button className="w-full" disabled variant="outline">
          Coming Soon
        </Button>
      )}
    </div>
  </div>
);

const Games = () => {
  const games: GameCardProps[] = [
    {
      title: "Rocket Crash 🚀",
      description: "Watch the rocket fly and cash out before it crashes! Multipliers up to 10x. Buy tickets with WOVER or USDT.",
      icon: <Rocket className="w-8 h-8 text-primary" />,
      path: "/game",
      status: 'live',
      gradient: 'bg-gradient-to-br from-primary/30 to-cyan-500/20',
    },
    {
      title: "Lucky Dice 🎲",
      description: "Roll the dice and win big! Classic casino dice game with provably fair results.",
      icon: <Dice1 className="w-8 h-8 text-warning" />,
      path: "/dice",
      status: 'coming',
      gradient: 'bg-gradient-to-br from-warning/30 to-orange-500/20',
    },
    {
      title: "Target Spin 🎯",
      description: "Spin the wheel and hit your target! Multiple prize zones with different multipliers.",
      icon: <Target className="w-8 h-8 text-success" />,
      path: "/wheel",
      status: 'coming',
      gradient: 'bg-gradient-to-br from-success/30 to-emerald-500/20',
    },
  ];

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">O'Rockets Game's</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Play provably fair games on OverProtocol. Win WOVER tokens with transparent odds.
          </p>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game) => (
            <GameCard key={game.title} {...game} />
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-16 p-6 rounded-2xl bg-card/30 border border-border/30">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Why O'Rockets Games?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <h3 className="font-semibold mb-2 text-primary">Provably Fair</h3>
              <p className="text-muted-foreground">All games use cryptographic seeds that you can verify. No hidden manipulation.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-primary">Instant Payouts</h3>
              <p className="text-muted-foreground">Winnings are claimable immediately on-chain. No waiting, no limits.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-primary">WOVER Economy</h3>
              <p className="text-muted-foreground">Play with WOVER tokens. Part of the O'Rocket DEX ecosystem.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Games;
