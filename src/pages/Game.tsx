import { useEffect } from 'react';
import RocketAnimation from '@/components/game/RocketAnimation';
import TicketPurchase from '@/components/game/TicketPurchase';
import BettingPanel from '@/components/game/BettingPanel';
import CrashHistory from '@/components/game/CrashHistory';
import Leaderboard from '@/components/game/Leaderboard';
import { useWallet } from '@/hooks/useWallet';
import { useGameRound, useGameBets } from '@/hooks/useGameRound';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { Wallet, Users, Trophy, TrendingUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Game = () => {
  const { address, isConnected } = useWallet();
  const { open: openWeb3Modal } = useWeb3Modal();
  const { currentRound, roundHistory, currentMultiplier, isLoading } = useGameRound();
  const { bets, myBet, refetch: refetchBets } = useGameBets(currentRound?.id, address);

  useEffect(() => {
    if (currentRound?.id) {
      refetchBets();
    }
  }, [currentRound?.id, refetchBets]);

  const handleConnect = () => {
    openWeb3Modal();
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Modern gradient mesh background */}
      <div className="fixed inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 min-h-screen pt-20 pb-8 px-4">
        <div className="container mx-auto max-w-7xl">
          
          {/* Main Game Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
            
            {/* Left Sidebar - Only show if connected */}
            {isConnected ? (
              <div className="lg:col-span-3 order-2 lg:order-1 space-y-4">
                <TicketPurchase 
                  walletAddress={address} 
                  isConnected={isConnected} 
                />
                <div className="lg:hidden">
                  <CrashHistory history={roundHistory} />
                </div>
              </div>
            ) : null}

            {/* Center - Game Display (Always visible and larger when not connected) */}
            <div className={`order-1 lg:order-2 ${isConnected ? 'lg:col-span-6' : 'lg:col-span-8 lg:col-start-3'}`}>
              {/* Game Container */}
              <div className="relative">
                {/* Modern glass card */}
                <div className="relative bg-card/30 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden shadow-2xl">
                  {/* Top accent line */}
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                  
                  {/* Game Screen */}
                  <div className="relative aspect-video bg-gradient-to-b from-background/80 to-background/40">
                    {/* Subtle grid overlay */}
                    <div 
                      className="absolute inset-0 opacity-[0.02]" 
                      style={{
                        backgroundImage: 'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
                        backgroundSize: '50px 50px'
                      }}
                    />
                    
                    <RocketAnimation
                      status={currentRound?.status || 'idle'}
                      multiplier={currentMultiplier}
                      crashPoint={currentRound?.crash_point}
                    />
                  </div>

                  {/* Bottom info bar */}
                  <div className="border-t border-border/30 bg-card/50 backdrop-blur-sm">
                    <div className="grid grid-cols-4 divide-x divide-border/30">
                      <div className="p-3 text-center">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Round</div>
                        <div className="font-mono font-semibold text-sm">#{currentRound?.round_number || '---'}</div>
                      </div>
                      <div className="p-3 text-center">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Players</div>
                        <div className="font-mono font-semibold text-sm text-primary">{bets.length}</div>
                      </div>
                      <div className="p-3 text-center">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Prize Pool</div>
                        <div className="font-mono font-semibold text-sm text-warning">{currentRound?.total_wagered || 0}</div>
                      </div>
                      <div className="p-3 text-center">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Status</div>
                        <div className={`font-semibold text-sm capitalize ${
                          currentRound?.status === 'flying' ? 'text-success' :
                          currentRound?.status === 'crashed' ? 'text-destructive' :
                          currentRound?.status === 'betting' ? 'text-primary' :
                          'text-muted-foreground'
                        }`}>
                          {currentRound?.status || 'Idle'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Crash History - Desktop */}
                <div className="mt-4 hidden lg:block">
                  <CrashHistory history={roundHistory} />
                </div>
              </div>

              {/* Connect Wallet CTA - Only show if not connected */}
              {!isConnected && (
                <div className="mt-6 bg-card/40 backdrop-blur-xl border border-border/50 rounded-2xl p-6 text-center">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Wallet className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-lg">Ready to play?</h3>
                      <p className="text-sm text-muted-foreground">Connect wallet to place bets</p>
                    </div>
                  </div>
                  <Button onClick={handleConnect} size="lg" className="w-full sm:w-auto px-8">
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect Wallet
                  </Button>
                </div>
              )}
            </div>

            {/* Right Sidebar - Only show if connected */}
            {isConnected ? (
              <div className="lg:col-span-3 order-3 space-y-4">
                <BettingPanel
                  walletAddress={address}
                  isConnected={isConnected}
                  currentRound={currentRound}
                  myBet={myBet}
                  currentMultiplier={currentMultiplier}
                  onBetPlaced={refetchBets}
                />
                <Leaderboard />
              </div>
            ) : (
              <div className="lg:col-span-8 lg:col-start-3 order-3">
                <Leaderboard />
              </div>
            )}
          </div>

          {/* How to Play - Modern cards */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="group bg-card/30 backdrop-blur-xl border border-border/50 rounded-xl p-5 hover:border-primary/30 transition-all duration-300">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Buy Tickets</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Purchase game tickets using WOVER or USDT tokens
                  </p>
                </div>
              </div>
            </div>
            <div className="group bg-card/30 backdrop-blur-xl border border-border/50 rounded-xl p-5 hover:border-primary/30 transition-all duration-300">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Place Your Bet</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Use tickets during betting phase before launch
                  </p>
                </div>
              </div>
            </div>
            <div className="group bg-card/30 backdrop-blur-xl border border-border/50 rounded-xl p-5 hover:border-primary/30 transition-all duration-300">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Cash Out & Win</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Exit anytime before crash to multiply winnings
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
