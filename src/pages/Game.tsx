import { useEffect } from 'react';
import SpaceBackground from '@/components/backgrounds/SpaceBackground';
import RocketAnimation from '@/components/game/RocketAnimation';
import TicketPurchase from '@/components/game/TicketPurchase';
import BettingPanel from '@/components/game/BettingPanel';
import CrashHistory from '@/components/game/CrashHistory';
import Leaderboard from '@/components/game/Leaderboard';
import SpectatorOverlay from '@/components/game/SpectatorOverlay';
import { useWallet } from '@/hooks/useWallet';
import { useGameRound, useGameBets } from '@/hooks/useGameRound';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { Rocket, Users, Clock, Zap } from 'lucide-react';

const Game = () => {
  const { address, isConnected } = useWallet();
  const { open: openWeb3Modal } = useWeb3Modal();
  const { currentRound, roundHistory, currentMultiplier, isLoading } = useGameRound();
  const { bets, myBet, refetch: refetchBets } = useGameBets(currentRound?.id, address);

  // Refetch bets when round changes
  useEffect(() => {
    if (currentRound?.id) {
      refetchBets();
    }
  }, [currentRound?.id, refetchBets]);

  const handleConnect = () => {
    openWeb3Modal();
  };

  return (
    <SpaceBackground>
      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-7xl">
          {/* Header */}
          <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2 flex items-center justify-center gap-3">
                <Rocket className="w-8 h-8 text-primary animate-float" />
                Rocket Crash
              </h1>
              <p className="text-muted-foreground">
                Cash out before the rocket crashes to multiply your winnings!
              </p>
            </div>

            {/* Stats Bar */}
            <div className="glass-card border border-primary/20 rounded-xl p-4 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-1">
                    <Clock className="w-4 h-4" />
                    Round
                  </div>
                  <div className="font-bold text-lg">
                    #{currentRound?.round_number || '-'}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-1">
                    <Users className="w-4 h-4" />
                    Players
                  </div>
                  <div className="font-bold text-lg text-primary">
                    {bets.length}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-1">
                    <Zap className="w-4 h-4" />
                    Total Bets
                  </div>
                  <div className="font-bold text-lg text-warning">
                    {currentRound?.total_wagered || 0} WOVER
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-sm mb-1">Status</div>
                  <div className={`font-bold text-lg capitalize ${
                    currentRound?.status === 'flying' ? 'text-success' :
                    currentRound?.status === 'crashed' ? 'text-destructive' :
                    currentRound?.status === 'betting' ? 'text-primary' :
                    'text-muted-foreground'
                  }`}>
                    {currentRound?.status || 'Waiting'}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Game Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Tickets & Betting */}
              <div className="space-y-6 order-2 lg:order-1">
                <TicketPurchase 
                  walletAddress={address} 
                  isConnected={isConnected} 
                />
                <BettingPanel
                  walletAddress={address}
                  isConnected={isConnected}
                  currentRound={currentRound}
                  myBet={myBet}
                  currentMultiplier={currentMultiplier}
                  onBetPlaced={refetchBets}
                />
              </div>

              {/* Center - Game Canvas */}
              <div className="order-1 lg:order-2">
                <div className="relative glass-card border border-primary/20 rounded-2xl overflow-hidden aspect-[4/3] lg:aspect-square">
                  <RocketAnimation
                    status={currentRound?.status || 'idle'}
                    multiplier={currentMultiplier}
                    crashPoint={currentRound?.crash_point}
                  />
                  
                  {/* Spectator Overlay */}
                  {!isConnected && (
                    <SpectatorOverlay onConnect={handleConnect} />
                  )}
                </div>

                {/* Crash History below game on mobile */}
                <div className="mt-6 lg:hidden">
                  <CrashHistory history={roundHistory} />
                </div>
              </div>

              {/* Right Column - History & Leaderboard */}
              <div className="space-y-6 order-3">
                <div className="hidden lg:block">
                  <CrashHistory history={roundHistory} />
                </div>
                <Leaderboard />
              </div>
            </div>

            {/* Info Section */}
            <div className="mt-12 glass-card border border-primary/20 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4">How to Play</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/20 flex items-center justify-center mb-3">
                    <span className="text-2xl">🎟️</span>
                  </div>
                  <h3 className="font-semibold mb-2">1. Buy Tickets</h3>
                  <p className="text-sm text-muted-foreground">
                    Purchase tickets using WOVER or USDT. Each ticket is valid for 15 days.
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/20 flex items-center justify-center mb-3">
                    <span className="text-2xl">🎯</span>
                  </div>
                  <h3 className="font-semibold mb-2">2. Place Your Bet</h3>
                  <p className="text-sm text-muted-foreground">
                    Use a ticket to bet during the betting phase. Choose auto cash-out at x2, x10, or go manual.
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/20 flex items-center justify-center mb-3">
                    <span className="text-2xl">🚀</span>
                  </div>
                  <h3 className="font-semibold mb-2">3. Cash Out!</h3>
                  <p className="text-sm text-muted-foreground">
                    Watch the multiplier grow and cash out before the rocket crashes. Max multiplier is x10!
                  </p>
                </div>
              </div>
          </div>
        </div>
      </div>
    </SpaceBackground>
  );
};

export default Game;
