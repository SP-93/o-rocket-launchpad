import { useEffect, useState, useRef } from 'react';
import RocketAnimation from '@/components/game/RocketAnimation';
import TicketPurchase from '@/components/game/TicketPurchase';
import BettingPanel from '@/components/game/BettingPanel';
import CrashHistory from '@/components/game/CrashHistory';
import Leaderboard from '@/components/game/Leaderboard';
import FlightBackground3D from '@/components/game/FlightBackground3D';
import CountdownOverlay from '@/components/game/CountdownOverlay';
import WinConfetti from '@/components/game/WinConfetti';
import ProvablyFairModal from '@/components/game/ProvablyFairModal';
import { useWallet } from '@/hooks/useWallet';
import { useGameRound, useGameBets } from '@/hooks/useGameRound';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { Wallet, Trophy, TrendingUp, Zap, Volume2, VolumeX, Pause, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useGameSounds from '@/hooks/useGameSounds';
import { supabase } from '@/integrations/supabase/client';

const Game = () => {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rocketGameSound') !== 'false';
    }
    return true;
  });
  const [showWinConfetti, setShowWinConfetti] = useState(false);
  const [winMultiplier, setWinMultiplier] = useState(1);
  const [gamePaused, setGamePaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<string | null>(null);
  const [nextRoundIn, setNextRoundIn] = useState<number | null>(null);
  const { address, isConnected } = useWallet();
  const { open: openWeb3Modal } = useWeb3Modal();
  const { currentRound, roundHistory, currentMultiplier, isLoading } = useGameRound();
  const { bets, myBet, refetch: refetchBets } = useGameBets(currentRound?.id, address);
  
  // Sound effects
  const { playSound, startFlyingSound, updateFlyingSound, stopFlyingSound, initAudioContext } = useGameSounds(soundEnabled);
  const prevStatusRef = useRef<string | null>(null);
  const initialLoadRef = useRef(true);
  const crashedAtRef = useRef<number | null>(null);

  const isFlying = currentRound?.status === 'flying';
  const isCountdown = currentRound?.status === 'countdown';
  const isBetting = currentRound?.status === 'betting';
  const isCrashed = currentRound?.status === 'crashed' || currentRound?.status === 'payout';
  const isWaitingForRound = !currentRound || isCrashed;

  // Fetch game status (paused/active) and handle countdown between rounds
  useEffect(() => {
    const fetchGameStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('game-round-manager', {
          body: { action: 'get_status' },
        });
        if (!error && data) {
          setGamePaused(!data.game_active);
          setPauseReason(data.game_paused_reason || null);
        }
      } catch (err) {
        console.error('Failed to fetch game status:', err);
      }
    };
    fetchGameStatus();
    const interval = setInterval(fetchGameStatus, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Countdown after crash
  useEffect(() => {
    if (isCrashed && !crashedAtRef.current) {
      crashedAtRef.current = Date.now();
      setNextRoundIn(5); // Start countdown
    } else if (!isCrashed) {
      crashedAtRef.current = null;
      setNextRoundIn(null);
    }
  }, [isCrashed]);

  useEffect(() => {
    if (nextRoundIn !== null && nextRoundIn > 0) {
      const timer = setTimeout(() => {
        setNextRoundIn(prev => (prev !== null && prev > 0 ? prev - 1 : null));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [nextRoundIn]);

  // Handle game status changes for sounds
  useEffect(() => {
    const currentStatus = currentRound?.status;
    const prevStatus = prevStatusRef.current;

    // On initial load, if already flying, start the sound immediately
    if (initialLoadRef.current && currentStatus === 'flying') {
      initAudioContext();
      startFlyingSound();
      initialLoadRef.current = false;
      prevStatusRef.current = currentStatus || null;
      return;
    }

    if (currentStatus !== prevStatus) {
      // Status changed
      if (currentStatus === 'countdown' && prevStatus !== 'countdown') {
        playSound('tick');
      }
      
      if (currentStatus === 'flying' && prevStatus !== 'flying') {
        playSound('launch');
        startFlyingSound();
      }
      
      if (currentStatus === 'crashed' && prevStatus === 'flying') {
        stopFlyingSound();
        playSound('crash');
      }
      
      if (currentStatus === 'payout' && prevStatus === 'crashed') {
        // Check if user won
        if (myBet?.status === 'won' && myBet?.cashed_out_at) {
          playSound('win');
          // Trigger confetti for wins with 3x+ multiplier
          if (myBet.cashed_out_at >= 3) {
            setWinMultiplier(myBet.cashed_out_at);
            setShowWinConfetti(true);
            setTimeout(() => setShowWinConfetti(false), 4000);
          }
        }
      }
      
      prevStatusRef.current = currentStatus || null;
      initialLoadRef.current = false;
    }
  }, [currentRound?.status, myBet?.status, playSound, startFlyingSound, stopFlyingSound, initAudioContext]);

  // Update flying sound pitch based on multiplier
  useEffect(() => {
    if (isFlying) {
      updateFlyingSound(currentMultiplier);
    }
  }, [isFlying, currentMultiplier, updateFlyingSound]);

  useEffect(() => {
    if (currentRound?.id) {
      refetchBets();
    }
  }, [currentRound?.id, refetchBets]);

  const handleConnect = () => {
    openWeb3Modal();
    // Initialize audio context on user interaction
    initAudioContext();
  };

  const toggleSound = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    localStorage.setItem('rocketGameSound', newValue ? 'true' : 'false');
    if (!newValue) {
      stopFlyingSound();
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Win Confetti Effect */}
      <WinConfetti isActive={showWinConfetti} multiplier={winMultiplier} />

      {/* Flight Background Effect */}
      <FlightBackground3D isFlying={isFlying} multiplier={currentMultiplier} />

      {/* Gradient overlay for readability */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/30 to-background/70" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-warning/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
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
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-warning/50 to-transparent" />
                  
                  {/* Top Controls */}
                  <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                    {/* Provably Fair Button */}
                    <ProvablyFairModal 
                      currentRound={currentRound ? {
                        roundNumber: currentRound.round_number,
                        seedHash: currentRound.server_seed_hash || '',
                        serverSeed: currentRound.server_seed || undefined,
                        crashPoint: currentRound.crash_point ? Math.round(currentRound.crash_point * 100) : undefined,
                        status: currentRound.status || 'idle'
                      } : null}
                      roundHistory={roundHistory.map(r => ({
                        roundNumber: r.round_number,
                        seedHash: r.server_seed_hash || '',
                        serverSeed: r.server_seed || undefined,
                        crashPoint: r.crash_point ? Math.round(r.crash_point * 100) : undefined,
                        status: r.status || 'crashed'
                      }))}
                    />
                    
                    {/* Sound Toggle Button */}
                    <button
                      onClick={toggleSound}
                      className="p-2.5 rounded-lg bg-card/60 backdrop-blur-sm border border-border/40 hover:bg-card/80 hover:border-warning/30 transition-all duration-200 group"
                      title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
                    >
                      {soundEnabled ? (
                        <Volume2 className="w-4 h-4 text-warning group-hover:scale-110 transition-transform" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-muted-foreground group-hover:text-warning group-hover:scale-110 transition-all" />
                      )}
                    </button>
                  </div>
                  
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
                      
                      {/* Game Paused Overlay */}
                      {gamePaused && (
                        <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                          <div className="text-center p-6">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-warning/20 flex items-center justify-center">
                              <Pause className="w-8 h-8 text-warning" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Game Paused</h3>
                            <p className="text-muted-foreground text-sm">
                              {pauseReason || 'The game is currently paused. Please wait for the next round.'}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Waiting for Round Overlay */}
                      {!gamePaused && isWaitingForRound && !isLoading && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/40 backdrop-blur-sm">
                          <div className="text-center p-6">
                            {nextRoundIn !== null && nextRoundIn > 0 ? (
                              <>
                                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-primary/20 flex items-center justify-center">
                                  <span className="text-2xl font-bold text-primary">{nextRoundIn}</span>
                                </div>
                                <p className="text-foreground font-medium">
                                  Next round starting...
                                </p>
                              </>
                            ) : (
                              <>
                                <Loader2 className="w-10 h-10 mx-auto mb-3 text-primary animate-spin" />
                                <p className="text-muted-foreground text-sm">
                                  Waiting for next round...
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <RocketAnimation
                        status={currentRound?.status || 'idle'}
                        multiplier={currentMultiplier}
                        crashPoint={currentRound?.crash_point}
                      />
                      
                      {/* Countdown Overlay */}
                      <CountdownOverlay 
                        status={currentRound?.status || 'idle'}
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
