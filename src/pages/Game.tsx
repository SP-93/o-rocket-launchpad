import { useEffect, useState, useRef, memo, useMemo } from 'react';
import BuildVersion from '@/components/BuildVersion';
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
import QuickCashoutOverlay from '@/components/game/QuickCashoutOverlay';
import MobileBetBar from '@/components/game/MobileBetBar';
import GameTutorial, { TutorialHelpButton } from '@/components/game/GameTutorial';
import { LiveStatusHUD } from '@/components/game/LiveStatusHUD';
import GameDebugOverlay from '@/components/game/GameDebugOverlay';
import ClaimWinNotification from '@/components/game/ClaimWinNotification';
import GameHistoryPanel from '@/components/game/GameHistoryPanel';
import PlayerChat from '@/components/game/PlayerChat';
import DiagnosticsPanel from '@/components/DiagnosticsPanel';
import { useWallet } from '@/hooks/useWallet';
import { useGameRound, useGameBets } from '@/hooks/useGameRound';
import { useGameEngine } from '@/hooks/useGameEngine';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { Wallet, Volume2, VolumeX, Pause, Loader2, Rocket, Users, TrendingUp, Clock, Ticket, History, Trophy, ClipboardList, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import useGameSounds from '@/hooks/useGameSounds';
import { supabase } from '@/integrations/supabase/client';
import { GameTicketsProvider } from '@/contexts/GameTicketsContext';

// Memoized heavy components to prevent unnecessary rerenders
const MemoizedLeaderboard = memo(Leaderboard);
const MemoizedCrashHistory = memo(CrashHistory);
const MemoizedLiveBetsFeed = memo(LiveBetsFeed);
const MemoizedPlayerChat = memo(PlayerChat);

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
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const { address, isConnected } = useWallet();
  const { open: openWeb3Modal } = useWeb3Modal();
  const { currentRound, roundHistory, currentMultiplier, isLoading } = useGameRound();
  const { bets, myBet, refetch: refetchBets } = useGameBets(currentRound?.id, address);
  const { status: engineStatus } = useGameEngine(); // Drives tick-based game loop
  
  const { playSound, startFlyingSound, updateFlyingSound, stopFlyingSound, initAudioContext, playCountdownBeep, playMilestoneSound, startBackgroundMusic, stopBackgroundMusic, isMusicPlaying } = useGameSounds(soundEnabled);
  const prevStatusRef = useRef<string | null>(null);
  const initialLoadRef = useRef(true);
  const crashedAtRef = useRef<number | null>(null);
  const lastMilestoneRef = useRef<number>(1);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastCountdownBeepRef = useRef<number>(0);
  const audioInitializedRef = useRef(false);

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

  // Initialize audio and start background music on first user interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!audioInitializedRef.current) {
        initAudioContext();
        audioInitializedRef.current = true;
        // Start background music after audio context is initialized
        if (soundEnabled) {
          setTimeout(() => startBackgroundMusic(), 500);
        }
      }
    };
    
    document.addEventListener('click', handleFirstInteraction, { once: true });
    document.addEventListener('touchstart', handleFirstInteraction, { once: true });
    
    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [initAudioContext, soundEnabled, startBackgroundMusic]);

  // Toggle background music with sound setting
  useEffect(() => {
    if (audioInitializedRef.current) {
      if (soundEnabled && !isMusicPlaying()) {
        startBackgroundMusic();
      } else if (!soundEnabled) {
        stopBackgroundMusic();
      }
    }
  }, [soundEnabled, startBackgroundMusic, stopBackgroundMusic, isMusicPlaying]);

  // Countdown beep timer (3, 2, 1)
  useEffect(() => {
    if (isCountdown) {
      // Clear previous timer
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      
      // Play countdown beeps at 3, 2, 1 seconds
      const startTime = Date.now();
      const countdownDuration = 5000; // 5 seconds countdown
      
      // Immediate first beep at countdown start
      playCountdownBeep(5);
      lastCountdownBeepRef.current = 5;
      
      countdownTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.ceil((countdownDuration - elapsed) / 1000);
        
        if (remaining <= 3 && remaining >= 1 && remaining !== lastCountdownBeepRef.current) {
          playCountdownBeep(remaining);
          lastCountdownBeepRef.current = remaining;
        }
        
        if (remaining <= 0) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
        }
      }, 200);
      
      return () => {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
      };
    }
  }, [isCountdown, playCountdownBeep]);

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

  // Update flying sound and play milestone sounds
  useEffect(() => {
    if (isFlying) {
      updateFlyingSound(currentMultiplier);
      
      // Play milestone sounds at 2x, 3x, 5x, 10x
      const milestones = [2, 3, 5, 10];
      for (const milestone of milestones) {
        if (currentMultiplier >= milestone && lastMilestoneRef.current < milestone) {
          playMilestoneSound(milestone);
          lastMilestoneRef.current = milestone;
          break;
        }
      }
    } else {
      // Reset milestone tracker when not flying
      lastMilestoneRef.current = 1;
    }
  }, [isFlying, currentMultiplier, updateFlyingSound, playMilestoneSound]);

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
    <GameTicketsProvider>
    <div className="min-h-screen bg-background relative overflow-hidden pb-20 lg:pb-0">
      {/* Tutorial Modal for first-time users */}
      <GameTutorial />
      
      {/* Game History Panel */}
      <GameHistoryPanel 
        walletAddress={address}
        isOpen={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
      />
      
      <WinConfetti isActive={showWinConfetti} multiplier={winMultiplier} />
      <FlightBackground3D isFlying={isFlying} multiplier={currentMultiplier} />
      
      {/* Claim Win Notification */}
      <ClaimWinNotification
        myBet={myBet}
        roundStatus={currentRound?.status || null}
        roundId={currentRound?.id}
        walletAddress={address}
        onClaimSuccess={refetchBets}
      />
      
      {/* Live Status HUD */}
      <LiveStatusHUD 
        engineStatus={engineStatus}
        roundStatus={currentRound?.status || null}
        roundNumber={currentRound?.round_number || null}
        gamePaused={gamePaused}
        pauseReason={pauseReason}
      />
      
      {/* Debug Overlay - visible with ?debug=1 */}
      <GameDebugOverlay
        currentRound={currentRound}
        currentMultiplier={currentMultiplier}
        engineStatus={engineStatus}
        isLoading={isLoading}
      />

      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none z-[1]">
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background/50" />
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-warning/3 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-primary/3 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 min-h-screen pt-16 md:pt-20 pb-4 px-2 md:px-4">
        <div className="container mx-auto max-w-7xl">
          
          {/* Main Game Layout - Modern 3-column */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-4">
            
            {/* Left Sidebar - Tickets & Stats (hidden on mobile, shown below game) */}
            {isConnected ? (
              <div className="hidden lg:block lg:col-span-3 lg:order-1 space-y-3" data-tutorial="ticket-purchase">
                <TicketPurchase walletAddress={address} isConnected={isConnected} />
                
                {/* Quick Stats & History Button */}
                <div className="glass-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Your Stats</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2 text-xs"
                      onClick={() => setShowHistoryPanel(true)}
                    >
                      <ClipboardList className="w-3.5 h-3.5 mr-1" />
                      My History
                    </Button>
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
              </div>
            ) : null}

            {/* Center - Game Display */}
            <div className={`order-1 lg:order-2 ${isConnected ? 'lg:col-span-6' : 'lg:col-span-8 lg:col-start-3'}`}>
              <div className="relative">
                {/* Main Game Card - Enhanced Design */}
                <div className="relative glass-card overflow-hidden shadow-2xl border-2 border-primary/20 hover:border-primary/30 transition-colors duration-500">
                  {/* Top gradient accent - more vibrant */}
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-warning/80 to-transparent" />
                  {/* Side glow effects */}
                  <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary/0 via-primary/30 to-primary/0" />
                  <div className="absolute inset-y-0 right-0 w-1 bg-gradient-to-b from-primary/0 via-primary/30 to-primary/0" />
                  
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
                      
                      <TutorialHelpButton />
                    </div>
                  </div>
                  
                  {/* Game Screen - Enhanced with glow - MOBILE OPTIMIZED */}
                  <div className="relative aspect-[4/3] md:aspect-video bg-gradient-to-b from-card/60 via-background/40 to-background/60" data-tutorial="rocket-display">
                    {/* Animated grid overlay */}
                    <div 
                      className="absolute inset-0 opacity-[0.03]" 
                      style={{
                        backgroundImage: 'linear-gradient(hsl(var(--primary) / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.5) 1px, transparent 1px)',
                        backgroundSize: '50px 50px'
                      }}
                    />
                    {/* Corner glow effects during flight */}
                    {isFlying && (
                      <>
                        <div className="absolute top-0 left-0 w-32 h-32 bg-success/10 rounded-full blur-3xl animate-pulse" />
                        <div className="absolute bottom-0 right-0 w-40 h-40 bg-warning/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
                      </>
                    )}
                    
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
                    
                    {/* Quick Cashout Overlay - positioned over rocket */}
                    <QuickCashoutOverlay
                      walletAddress={address}
                      myBet={myBet}
                      currentMultiplier={currentMultiplier}
                      roundStatus={currentRound?.status || 'idle'}
                      onCashout={refetchBets}
                    />
                    
                    <CountdownOverlay status={currentRound?.status || 'idle'} />
                  </div>

                  {/* Bottom Stats Bar - Enhanced design */}
                  <div className="border-t border-border/30 bg-gradient-to-r from-card/40 via-card/60 to-card/40 backdrop-blur-md">
                    <div className="grid grid-cols-4 divide-x divide-border/20">
                      <div className="p-2.5 md:p-3.5 text-center group hover:bg-card/30 transition-colors">
                        <div className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-medium">Status</div>
                        <div className={`font-semibold text-xs md:text-sm capitalize flex items-center justify-center gap-1.5 ${
                          currentRound?.status === 'flying' ? 'text-success' :
                          currentRound?.status === 'crashed' ? 'text-destructive' :
                          currentRound?.status === 'betting' ? 'text-primary' :
                          'text-muted-foreground'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${
                            currentRound?.status === 'flying' ? 'bg-success animate-pulse' :
                            currentRound?.status === 'crashed' ? 'bg-destructive' :
                            currentRound?.status === 'betting' ? 'bg-primary animate-pulse' :
                            'bg-muted-foreground'
                          }`} />
                          {currentRound?.status === 'flying' ? 'Flying' :
                           currentRound?.status === 'crashed' ? 'Crashed' :
                           currentRound?.status === 'betting' ? 'Betting' :
                           currentRound?.status || 'Idle'}
                        </div>
                      </div>
                      <div className="p-2.5 md:p-3.5 text-center group hover:bg-card/30 transition-colors">
                        <div className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-medium flex items-center justify-center gap-1">
                          <Users className="w-3 h-3" />
                          Players
                        </div>
                        <div className="font-mono font-bold text-sm md:text-base text-primary">{bets.length}</div>
                      </div>
                      <div className="p-2.5 md:p-3.5 text-center group hover:bg-card/30 transition-colors">
                        <div className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-medium">Pool</div>
                        <div className="font-mono font-bold text-sm md:text-base text-warning">{currentRound?.total_wagered || 0} W</div>
                      </div>
                      <div className="p-2.5 md:p-3.5 text-center group hover:bg-card/30 transition-colors">
                        <div className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-medium">Multiplier</div>
                        <div className={`font-mono font-bold text-sm md:text-base transition-all duration-200 ${
                          currentMultiplier >= 10 ? 'text-amber-400 scale-110' :
                          currentMultiplier >= 5 ? 'text-purple-400' :
                          currentMultiplier >= 2 ? 'text-warning' : 'text-success'
                        }`}>
                          {currentMultiplier.toFixed(2)}×
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile Quick History Strip - Shows 5 past games directly below game screen */}
                <div className="mt-2 lg:hidden">
                  <div className="glass-card px-3 py-2">
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap font-medium">LAST:</span>
                      {roundHistory.slice(0, 5).map((round) => {
                        const crashPoint = round.crash_point || 0;
                        const bgColor = crashPoint >= 10 ? 'bg-gradient-to-r from-amber-500/30 to-yellow-500/30 border-amber-500/50' :
                                       crashPoint >= 5 ? 'bg-gradient-to-r from-purple-500/30 to-pink-500/30 border-purple-500/50' :
                                       crashPoint >= 2 ? 'bg-success/20 border-success/50' :
                                       'bg-destructive/20 border-destructive/50';
                        const textColor = crashPoint >= 10 ? 'text-amber-400' :
                                         crashPoint >= 5 ? 'text-purple-400' :
                                         crashPoint >= 2 ? 'text-success' :
                                         'text-destructive';
                        return (
                          <div 
                            key={round.id} 
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border ${bgColor} ${textColor} flex-shrink-0 transition-transform hover:scale-105`}
                          >
                            {crashPoint.toFixed(2)}×
                          </div>
                        );
                      })}
                      {roundHistory.length === 0 && (
                        <span className="text-[10px] text-muted-foreground">No history yet</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Crash History - Desktop (memoized) */}
                <div className="mt-3 hidden lg:block">
                  <MemoizedCrashHistory history={roundHistory} />
                </div>

                {/* Live Bets Feed - Desktop (memoized) */}
                <div className="mt-3 hidden lg:block">
                  <MemoizedLiveBetsFeed bets={bets} currentStatus={currentRound?.status || 'idle'} />
                </div>
                
                {/* Player Chat - Desktop */}
                <div className="mt-3 hidden lg:block">
                  <MemoizedPlayerChat 
                    walletAddress={address} 
                    isConnected={isConnected}
                  />
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
              <div className="lg:col-span-3 order-3 space-y-3" data-tutorial="betting-panel">
                <BettingPanel
                  walletAddress={address}
                  isConnected={isConnected}
                  currentRound={currentRound}
                  myBet={myBet}
                  currentMultiplier={currentMultiplier}
                  onBetPlaced={refetchBets}
                />
                <MemoizedLeaderboard />
              </div>
            ) : (
              <div className="lg:col-span-8 lg:col-start-3 order-3">
                <MemoizedLeaderboard />
              </div>
            )}
          </div>

          {/* Mobile Tabs Section - Only visible on mobile */}
          {isConnected && (
            <div className="mt-4 lg:hidden">
              <Tabs defaultValue="tickets" className="w-full">
                <TabsList className="w-full grid grid-cols-5 bg-card/50 backdrop-blur border border-border/30 rounded-xl h-11">
                  <TabsTrigger 
                    value="tickets" 
                    className="text-[10px] font-medium data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg px-1"
                  >
                    <Ticket className="w-3 h-3 mr-0.5" />
                    Tickets
                  </TabsTrigger>
                  <TabsTrigger 
                    value="rounds" 
                    className="text-[10px] font-medium data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg px-1"
                  >
                    <History className="w-3 h-3 mr-0.5" />
                    Rounds
                  </TabsTrigger>
                  <TabsTrigger 
                    value="chat" 
                    className="text-[10px] font-medium data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg px-1"
                  >
                    <MessageCircle className="w-3 h-3 mr-0.5" />
                    Chat
                  </TabsTrigger>
                  <TabsTrigger 
                    value="my-history" 
                    className="text-[10px] font-medium data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg px-1"
                  >
                    <ClipboardList className="w-3 h-3 mr-0.5" />
                    My Bets
                  </TabsTrigger>
                  <TabsTrigger 
                    value="leaderboard" 
                    className="text-[10px] font-medium data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg px-1"
                  >
                    <Trophy className="w-3 h-3 mr-0.5" />
                    Top
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="tickets" className="mt-3">
                  <TicketPurchase walletAddress={address} isConnected={isConnected} />
                </TabsContent>
                
                <TabsContent value="rounds" className="mt-3 space-y-3">
                  <MemoizedCrashHistory history={roundHistory} />
                  <MemoizedLiveBetsFeed bets={bets} currentStatus={currentRound?.status || 'idle'} />
                </TabsContent>
                
                <TabsContent value="chat" className="mt-3">
                  <MemoizedPlayerChat 
                    walletAddress={address} 
                    isConnected={isConnected}
                    className="w-full h-[320px]"
                  />
                </TabsContent>
                
                <TabsContent value="my-history" className="mt-3">
                  <div className="glass-card p-4 text-center">
                    <ClipboardList className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-3">View your complete game history</p>
                    <Button onClick={() => setShowHistoryPanel(true)} size="sm">
                      Open My History
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="leaderboard" className="mt-3">
                  <MemoizedLeaderboard />
                </TabsContent>
              </Tabs>
            </div>
          )}

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
          
          {/* Build Version & Diagnostics */}
          <div className="mt-4 flex justify-center items-center gap-4">
            <BuildVersion />
            <DiagnosticsPanel compact />
          </div>
        </div>
      </div>

      {/* Mobile Bet Bar - Fixed bottom on mobile */}
      {isConnected && (
        <MobileBetBar
          walletAddress={address}
          isConnected={isConnected}
          currentRound={currentRound}
          myBet={myBet}
          currentMultiplier={currentMultiplier}
          onBetPlaced={refetchBets}
        />
      )}
    </div>
    </GameTicketsProvider>
  );
};

export default Game;
