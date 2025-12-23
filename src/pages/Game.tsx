import { useEffect } from 'react';
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
    <div className="min-h-screen bg-[#0a0a12] relative overflow-hidden">
      {/* Deep space background */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#0a0a12] via-[#0d0d1a] to-[#050508]" />
      
      {/* Subtle stars */}
      <div className="fixed inset-0 opacity-30">
        {[...Array(100)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white animate-pulse"
            style={{
              width: Math.random() * 2 + 1 + 'px',
              height: Math.random() * 2 + 1 + 'px',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
              animationDelay: Math.random() * 3 + 's',
              animationDuration: Math.random() * 2 + 2 + 's',
            }}
          />
        ))}
      </div>

      <div className="relative z-10 min-h-screen pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-7xl">
          {/* Compact Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl md:text-3xl font-bold gradient-text flex items-center justify-center gap-2">
              <Rocket className="w-6 h-6 text-primary animate-float" />
              Rocket Crash
            </h1>
          </div>

          {/* Main Game Layout - Monitor Focus */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Left Column - Tickets */}
            <div className="order-2 xl:order-1">
              <TicketPurchase 
                walletAddress={address} 
                isConnected={isConnected} 
              />
            </div>

            {/* Center - LARGE Game Monitor */}
            <div className="order-1 xl:order-2 xl:col-span-2">
              {/* Gaming Monitor Frame */}
              <div className="relative">
                {/* Monitor outer bezel */}
                <div className="bg-gradient-to-b from-[#2a2a3a] via-[#1a1a2a] to-[#0f0f1a] p-3 rounded-3xl shadow-2xl">
                  {/* Monitor inner bezel with LED accent */}
                  <div className="relative bg-gradient-to-b from-[#1a1a25] to-[#0d0d15] p-1 rounded-2xl">
                    {/* LED strip effect */}
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50 rounded-t-2xl" />
                    
                    {/* Screen */}
                    <div className="relative bg-[#050510] rounded-xl overflow-hidden aspect-video border border-primary/10 shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]">
                      {/* Scanline effect */}
                      <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20 z-10" />
                      
                      {/* CRT corner vignette */}
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.4)_100%)] pointer-events-none z-10" />
                      
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
                  </div>
                </div>
                
                {/* Monitor Stand */}
                <div className="flex justify-center">
                  <div className="w-24 h-6 bg-gradient-to-b from-[#2a2a3a] to-[#1a1a2a] rounded-b-lg" />
                </div>
                <div className="flex justify-center -mt-1">
                  <div className="w-40 h-3 bg-gradient-to-b from-[#1a1a2a] to-[#0f0f1a] rounded-b-xl" />
                </div>
              </div>

              {/* Stats Bar below monitor */}
              <div className="mt-4 bg-[#0d0d18]/80 backdrop-blur border border-primary/10 rounded-xl p-3">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
                      <Clock className="w-3 h-3" />
                      Round
                    </div>
                    <div className="font-bold text-sm">#{currentRound?.round_number || '-'}</div>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
                      <Users className="w-3 h-3" />
                      Players
                    </div>
                    <div className="font-bold text-sm text-primary">{bets.length}</div>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
                      <Zap className="w-3 h-3" />
                      Pool
                    </div>
                    <div className="font-bold text-sm text-warning">{currentRound?.total_wagered || 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Status</div>
                    <div className={`font-bold text-sm capitalize ${
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

              {/* Crash History below game on mobile */}
              <div className="mt-4 xl:hidden">
                <CrashHistory history={roundHistory} />
              </div>
            </div>

            {/* Right Column - Betting & History */}
            <div className="space-y-4 order-3">
              <BettingPanel
                walletAddress={address}
                isConnected={isConnected}
                currentRound={currentRound}
                myBet={myBet}
                currentMultiplier={currentMultiplier}
                onBetPlaced={refetchBets}
              />
              <div className="hidden xl:block">
                <CrashHistory history={roundHistory} />
              </div>
              <Leaderboard />
            </div>
          </div>

          {/* Info Section */}
          <div className="mt-8 bg-[#0d0d18]/60 backdrop-blur border border-primary/10 rounded-xl p-5">
            <h2 className="text-lg font-bold mb-4 text-center">How to Play</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-primary/5 rounded-lg">
                <div className="w-10 h-10 mx-auto rounded-full bg-primary/20 flex items-center justify-center mb-2">
                  <span className="text-xl">🎟️</span>
                </div>
                <h3 className="font-semibold text-sm mb-1">1. Buy Tickets</h3>
                <p className="text-xs text-muted-foreground">
                  Purchase tickets with WOVER or USDT
                </p>
              </div>
              <div className="text-center p-3 bg-primary/5 rounded-lg">
                <div className="w-10 h-10 mx-auto rounded-full bg-primary/20 flex items-center justify-center mb-2">
                  <span className="text-xl">🎯</span>
                </div>
                <h3 className="font-semibold text-sm mb-1">2. Place Bet</h3>
                <p className="text-xs text-muted-foreground">
                  Use a ticket during betting phase
                </p>
              </div>
              <div className="text-center p-3 bg-primary/5 rounded-lg">
                <div className="w-10 h-10 mx-auto rounded-full bg-primary/20 flex items-center justify-center mb-2">
                  <span className="text-xl">🚀</span>
                </div>
                <h3 className="font-semibold text-sm mb-1">3. Cash Out!</h3>
                <p className="text-xs text-muted-foreground">
                  Exit before the rocket crashes
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
