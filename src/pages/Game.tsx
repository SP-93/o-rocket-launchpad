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
import GameTimer from '@/components/game/GameTimer';
import LiveBetsFeed from '@/components/game/LiveBetsFeed';
import { useWallet } from '@/hooks/useWallet';
import { useGameRound, useGameBets } from '@/hooks/useGameRound';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { Wallet, Volume2, VolumeX, Pause, Loader2, Rocket, Users, TrendingUp, Clock } from 'lucide-react';
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
  
  const { playSound, startFlyingSound, updateFlyingSound, stopFlyingSound, initAudioContext } = useGameSounds(soundEnabled);
  const prevStatusRef = useRef<string | null>(null);
  const initialLoadRef = useRef(true);
  const crashedAtRef = useRef<number | null>(null);

  const isFlying = currentRound?.status === 'flying';
  const isCountdown = currentRound?.status === 'countdown';
  const isBetting = currentRound?.status === 'betting';
  const isCrashed = currentRound?.status === 'crashed' || currentRound?.status === 'payout';
  const isWaitingForRound = !currentRound || isCrashed;

  // Fetch game status
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
    const interval = setInterval(fetchGameStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Countdown after crash
  useEffect(() => {
    if (isCrashed && !crashedAtRef.current) {
      crashedAtRef.current = Date.now();
      setNextRoundIn(5);
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

  // Sound effects on status changes
  useEffect(() => {
    const currentStatus = currentRound?.status;
    const prevStatus = prevStatusRef.current;

    if (initialLoadRef.current && currentStatus === 'flying') {
      initAudioContext();
      startFlyingSound();
      initialLoadRef.current = false;
      prevStatusRef.current = currentStatus || null;
      return;
    }

    if (currentStatus !== prevStatus) {
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
        if (myBet?.status === 'won' && myBet?.cashed_out_at) {
          playSound('win');
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
      <WinConfetti isActive={showWinConfetti} multiplier={winMultiplier} />
      <FlightBackground3D isFlying={isFlying} multiplier={currentMultiplier} />

      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/20 to-background/60" />
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-warning/5 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 min-h-screen pt-20 pb-8 px-3 md:px-4">
        <div className="container mx-auto max-w-7xl">
          
          {/* Main Game Layout - Modern 3-column */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4">
            
            {/* Left Sidebar - Tickets & Stats */}
            {isConnected ? (
              <div className="lg:col-span-3 order-2 lg:order-1 space-y-3">
                <TicketPurchase walletAddress={address} isConnected={isConnected} />
                
                {/* Quick Stats */}
                <div className="glass-card p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Your Stats</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-card/50 text-center">
                      <div className="text-lg font-bold text-primary">0</div>
                      <div className="text-[10px] text-muted-foreground">Wins</div>
                    </div>
                    <div className="p-2 rounded-lg bg-card/50 text-center">
                      <div className="text-lg font-bold text-success">0x</div>
                      <div className="text-[10px] text-muted-foreground">Best</div>
                    </div>
                  </div>
                </div>

                <div className="lg:hidden">
                  <CrashHistory history={roundHistory} />
                </div>
              </div>
            ) : null}

            {/* Center - Game Display */}
            <div className={`order-1 lg:order-2 ${isConnected ? 'lg:col-span-6' : 'lg:col-span-8 lg:col-start-3'}`}>
              <div className="relative">
                {/* Main Game Card */}
                <div className="relative glass-card overflow-hidden">
                  {/* Top gradient accent */}
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-warning/60 to-transparent" />
                  
                  {/* Top Controls Bar */}
                  <div className="relative px-3 py-2 flex items-center justify-between border-b border-border/20">
                    {/* Round Info */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs">
                        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                        <span className="text-muted-foreground">Round</span>
                        <span className="font-mono font-bold">#{currentRound?.round_number || '---'}</span>
                      </div>
                    </div>

                    {/* Timer & Controls */}
                    <div className="flex items-center gap-2">
                      <GameTimer status={currentRound?.status || 'idle'} />
                      
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
                      
                      <button
                        onClick={toggleSound}
                        className="p-2 rounded-lg bg-card/60 backdrop-blur-sm border border-border/30 hover:bg-card/80 hover:border-primary/30 transition-all duration-200"
                        title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
                      >
                        {soundEnabled ? (
                          <Volume2 className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* Game Screen */}
                  <div className="relative aspect-[16/10] md:aspect-video bg-gradient-to-b from-card/50 to-background/50">
                    {/* Grid overlay */}
                    <div 
                      className="absolute inset-0 opacity-[0.02]" 
                      style={{
                        backgroundImage: 'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
                        backgroundSize: '40px 40px'
                      }}
                    />
                    
                    {/* Game Paused Overlay */}
                    {gamePaused && (
                      <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                        <div className="text-center p-6">
                          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-warning/20 flex items-center justify-center">
                            <Pause className="w-7 h-7 text-warning" />
                          </div>
                          <h3 className="text-lg font-bold mb-1">Game Paused</h3>
                          <p className="text-muted-foreground text-sm">
                            {pauseReason || 'Please wait for the next round'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Waiting Overlay */}
                    {!gamePaused && isWaitingForRound && !isLoading && (
                      <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/30 backdrop-blur-sm">
                        <div className="text-center p-6">
                          {nextRoundIn !== null && nextRoundIn > 0 ? (
                            <>
                              <div className="relative w-16 h-16 mx-auto mb-3">
                                <div className="absolute inset-0 rounded-full border-2 border-primary/30" />
                                <div 
                                  className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin"
                                  style={{ animationDuration: '1s' }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-2xl font-bold text-primary">{nextRoundIn}</span>
                                </div>
                              </div>
                              <p className="text-foreground font-medium text-sm">Next round starting...</p>
                            </>
                          ) : (
                            <>
                              <Loader2 className="w-10 h-10 mx-auto mb-3 text-primary animate-spin" />
                              <p className="text-muted-foreground text-sm">Waiting for next round...</p>
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
                    
                    <CountdownOverlay status={currentRound?.status || 'idle'} />
                  </div>

                  {/* Bottom Stats Bar */}
                  <div className="border-t border-border/20 bg-card/30 backdrop-blur-sm">
                    <div className="grid grid-cols-4 divide-x divide-border/20">
                      <div className="p-2.5 md:p-3 text-center">
                        <div className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Status</div>
                        <div className={`font-semibold text-xs md:text-sm capitalize ${
                          currentRound?.status === 'flying' ? 'text-success' :
                          currentRound?.status === 'crashed' ? 'text-destructive' :
                          currentRound?.status === 'betting' ? 'text-primary' :
                          'text-muted-foreground'
                        }`}>
                          {currentRound?.status === 'flying' ? '🚀 Flying' :
                           currentRound?.status === 'crashed' ? '💥 Crashed' :
                           currentRound?.status === 'betting' ? '💰 Betting' :
                           currentRound?.status || 'Idle'}
                        </div>
                      </div>
                      <div className="p-2.5 md:p-3 text-center">
                        <div className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Players</div>
                        <div className="font-mono font-semibold text-xs md:text-sm text-primary">{bets.length}</div>
                      </div>
                      <div className="p-2.5 md:p-3 text-center">
                        <div className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Pool</div>
                        <div className="font-mono font-semibold text-xs md:text-sm text-warning">{currentRound?.total_wagered || 0} W</div>
                      </div>
                      <div className="p-2.5 md:p-3 text-center">
                        <div className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Multiplier</div>
                        <div className={`font-mono font-bold text-xs md:text-sm ${
                          currentMultiplier >= 5 ? 'text-destructive' :
                          currentMultiplier >= 2 ? 'text-warning' : 'text-success'
                        }`}>
                          {currentMultiplier.toFixed(2)}×
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Crash History - Desktop */}
                <div className="mt-3 hidden lg:block">
                  <CrashHistory history={roundHistory} />
                </div>

                {/* Live Bets Feed - Desktop */}
                <div className="mt-3 hidden lg:block">
                  <LiveBetsFeed bets={bets} currentStatus={currentRound?.status || 'idle'} />
                </div>
              </div>

              {/* Connect Wallet CTA */}
              {!isConnected && (
                <div className="mt-4 glass-card p-5 text-center">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Rocket className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-lg">Ready to Play?</h3>
                      <p className="text-sm text-muted-foreground">Connect wallet to join</p>
                    </div>
                  </div>
                  <Button onClick={handleConnect} size="lg" className="w-full sm:w-auto px-8 btn-primary">
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect Wallet
                  </Button>
                </div>
              )}
            </div>

            {/* Right Sidebar - Betting & Leaderboard */}
            {isConnected ? (
              <div className="lg:col-span-3 order-3 space-y-3">
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

          {/* How to Play - Modern minimal cards */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { icon: Wallet, title: '1. Get Tickets', desc: 'Buy tickets with WOVER or USDT tokens', color: 'text-primary' },
              { icon: Rocket, title: '2. Place Bet', desc: 'Use your ticket and set auto-cashout', color: 'text-warning' },
              { icon: TrendingUp, title: '3. Cash Out', desc: 'Click before crash to win multiplied tokens', color: 'text-success' },
            ].map((step, i) => (
              <div key={i} className="group glass-card p-4 hover:border-primary/30 transition-all duration-300">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg bg-card/80 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform ${step.color}`}>
                    <step.icon className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-0.5">{step.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
