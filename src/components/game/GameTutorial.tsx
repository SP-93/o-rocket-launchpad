import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Ticket, Target, Rocket, Coins, HelpCircle, ChevronRight, ChevronLeft, 
  Clock, Hand, Wallet, ArrowDownToLine 
} from 'lucide-react';

const TUTORIAL_STORAGE_KEY = 'orocket_tutorial_seen';

interface TutorialStep {
  icon: React.ElementType;
  title: string;
  description: string;
  tip: string;
  color: string;
  highlight?: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    icon: Ticket,
    title: 'Buy Tickets',
    description: 'First, purchase game tickets using WOVER tokens. Look for the "Game Tickets" panel on the LEFT side of the screen. Each ticket has a WOVER value that determines your potential winnings.',
    tip: 'Tickets expire after 15 days, so use them before they expire!',
    color: 'text-primary',
    highlight: 'ticket-purchase',
  },
  {
    icon: Wallet,
    title: 'Your Tickets & Betting',
    description: 'After purchasing, go to the "Betting Panel" on the RIGHT side. You\'ll see your available tickets listed there with their values.',
    tip: 'Each ticket can only be used once per round.',
    color: 'text-accent',
    highlight: 'betting-panel',
  },
  {
    icon: Target,
    title: 'Place Your Bet',
    description: 'Select a ticket from your list and click "Place Bet" before the round starts. Look at the GAME SCREEN in the center - betting is only open during the "BETTING OPEN" phase.',
    tip: 'Watch the countdown timer in the game display!',
    color: 'text-warning',
    highlight: 'rocket-display',
  },
  {
    icon: Clock,
    title: 'Auto-Cashout (Optional)',
    description: 'In the Betting Panel (RIGHT side), you can set an auto-cashout multiplier before betting. The game will automatically cash you out when the rocket reaches that multiplier.',
    tip: 'Example: Set 2.0x to automatically double your bet.',
    color: 'text-success',
    highlight: 'betting-panel',
  },
  {
    icon: Rocket,
    title: 'Watch the Rocket',
    description: 'Once the round starts, watch the CENTER of your screen! The rocket takes off and the multiplier increases. The longer it flies, the higher your potential winnings!',
    tip: 'The rocket can crash at ANY moment - there\'s no pattern!',
    color: 'text-primary',
    highlight: 'rocket-display',
  },
  {
    icon: Hand,
    title: 'Manual Cash Out',
    description: 'When your bet is active, a big "CASH OUT" button appears on the rocket display. Click it before the crash to lock in your winnings!',
    tip: 'Higher multipliers = bigger rewards, but more risk!',
    color: 'text-destructive',
    highlight: 'rocket-display',
  },
  {
    icon: ArrowDownToLine,
    title: 'Claim Winnings',
    description: 'After winning, check the Betting Panel (RIGHT side) for your pending winnings. You can play multiple rounds and claim all winnings together!',
    tip: 'Look for the "Claim" button in the Betting Panel.',
    color: 'text-success',
    highlight: 'betting-panel',
  },
];

// Spotlight overlay component
const SpotlightOverlay = ({ targetSelector, isVisible }: { targetSelector: string; isVisible: boolean }) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!isVisible || !targetSelector) {
      setTargetRect(null);
      return;
    }

    const findAndHighlight = () => {
      const target = document.querySelector(`[data-tutorial="${targetSelector}"]`);
      if (target) {
        const rect = target.getBoundingClientRect();
        
        // Check if element is in viewport
        const isInViewport = rect.top >= 0 && rect.top <= window.innerHeight;
        
        if (!isInViewport) {
          // Scroll element into view smoothly
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Re-get rect after scroll
          setTimeout(() => {
            setTargetRect(target.getBoundingClientRect());
          }, 300);
        } else {
          setTargetRect(rect);
        }
      }
    };

    findAndHighlight();
    
    // Re-calculate on resize/scroll
    const handleUpdate = () => {
      const target = document.querySelector(`[data-tutorial="${targetSelector}"]`);
      if (target) setTargetRect(target.getBoundingClientRect());
    };
    
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, { passive: true });

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate);
    };
  }, [targetSelector, isVisible]);

  if (!isVisible || !targetRect) return null;

  const padding = 8;
  const rect = {
    top: targetRect.top - padding,
    left: targetRect.left - padding,
    width: targetRect.width + padding * 2,
    height: targetRect.height + padding * 2,
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Dark overlay with cutout */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={rect.left}
              y={rect.top}
              width={rect.width}
              height={rect.height}
              rx="12"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.7)"
          mask="url(#spotlight-mask)"
        />
      </svg>
      
      {/* Pulsing border around target */}
      <div
        className="absolute border-2 border-primary rounded-xl animate-pulse"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          boxShadow: '0 0 20px hsl(var(--primary) / 0.5), 0 0 40px hsl(var(--primary) / 0.3)',
        }}
      />
      
      {/* Arrow pointing to target */}
      <div
        className="absolute flex items-center gap-2 animate-bounce"
        style={{
          top: rect.top - 50,
          left: rect.left + rect.width / 2 - 12,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-primary">
          <path d="M12 5L12 19M12 19L5 12M12 19L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      
      {/* Label */}
      <div
        className="absolute px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-lg"
        style={{
          top: rect.top - 80,
          left: rect.left + rect.width / 2,
          transform: 'translateX(-50%)',
        }}
      >
        👀 Look Here!
      </div>
    </div>,
    document.body
  );
};

interface GameTutorialProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

const GameTutorial = ({ forceOpen, onClose }: GameTutorialProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [showSpotlight, setShowSpotlight] = useState(false);

  useEffect(() => {
    if (forceOpen !== undefined) {
      setIsOpen(forceOpen);
      return;
    }
    
    const hasSeen = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!hasSeen) {
      setIsOpen(true);
    }
  }, [forceOpen]);

  // Show spotlight when dialog is open
  useEffect(() => {
    if (isOpen && tutorialSteps[currentStep]?.highlight) {
      const timer = setTimeout(() => setShowSpotlight(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowSpotlight(false);
    }
  }, [isOpen, currentStep]);

  const handleClose = useCallback(() => {
    if (dontShowAgain) {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    }
    setShowSpotlight(false);
    setIsOpen(false);
    setCurrentStep(0);
    onClose?.();
  }, [dontShowAgain, onClose]);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    setShowSpotlight(false);
    setIsOpen(false);
    setCurrentStep(0);
    onClose?.();
  };

  const step = tutorialSteps[currentStep];
  const StepIcon = step.icon;

  return (
    <>
      {/* Spotlight overlay - rendered via portal */}
      <SpotlightOverlay 
        targetSelector={step.highlight || ''} 
        isVisible={showSpotlight && isOpen} 
      />
      
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-lg z-[110]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              How to Play Rocket Crash
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-1.5 mb-6">
              {tutorialSteps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === currentStep
                      ? 'w-8 bg-primary'
                      : index < currentStep
                      ? 'w-4 bg-primary/50 hover:bg-primary/70'
                      : 'w-4 bg-muted hover:bg-muted-foreground/30'
                  }`}
                />
              ))}
            </div>

            {/* Step content */}
            <div className="text-center space-y-4">
              <div className={`w-16 h-16 mx-auto rounded-2xl bg-card flex items-center justify-center ${step.color} border border-border/30`}>
                <StepIcon className="w-8 h-8" />
              </div>

              <div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    Step {currentStep + 1} of {tutorialSteps.length}
                  </span>
                </div>
                <h3 className="text-lg font-bold mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-xs text-primary font-medium">
                  💡 Tip: {step.tip}
                </p>
              </div>

              {/* Visual location indicator */}
              {step.highlight && (
                <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-warning/10 border border-warning/20">
                  <span className="text-xs text-warning font-medium">
                    📍 {step.highlight === 'ticket-purchase' ? 'LEFT panel' : 
                        step.highlight === 'betting-panel' ? 'RIGHT panel' : 
                        'CENTER screen'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="w-24"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-muted-foreground"
              >
                Skip
              </Button>

              <Button
                size="sm"
                onClick={handleNext}
                className="w-24"
              >
                {currentStep === tutorialSteps.length - 1 ? (
                  'Got it!'
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center justify-center gap-2">
              <Checkbox
                id="dontShowAgain"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              />
              <label
                htmlFor="dontShowAgain"
                className="text-xs text-muted-foreground cursor-pointer"
              >
                Don't show this again
              </label>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Help button component
export const TutorialHelpButton = () => {
  const [showTutorial, setShowTutorial] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowTutorial(true)}
        className="p-2 rounded-lg bg-card/60 backdrop-blur-sm border border-border/30 hover:bg-card/80 hover:border-primary/30 transition-all duration-200"
        title="How to play"
      >
        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
      </button>
      <GameTutorial forceOpen={showTutorial} onClose={() => setShowTutorial(false)} />
    </>
  );
};

export default GameTutorial;