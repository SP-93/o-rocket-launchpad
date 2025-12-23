import { Button } from '@/components/ui/button';
import { Wallet, Rocket } from 'lucide-react';

interface SpectatorOverlayProps {
  onConnect: () => void;
}

const SpectatorOverlay = ({ onConnect }: SpectatorOverlayProps) => {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-2xl">
      <div className="text-center space-y-4 p-8">
        <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
          <Rocket className="w-10 h-10 text-primary animate-bounce" />
        </div>
        <h3 className="text-2xl font-bold gradient-text">
          Ready to Play?
        </h3>
        <p className="text-muted-foreground max-w-sm">
          Connect your wallet to buy tickets, place bets, and win WOVER!
        </p>
        <Button onClick={onConnect} className="btn-primary">
          <Wallet className="w-4 h-4 mr-2" />
          Connect Wallet to Play
        </Button>
        <p className="text-xs text-muted-foreground">
          You can watch the game without connecting
        </p>
      </div>
    </div>
  );
};

export default SpectatorOverlay;
