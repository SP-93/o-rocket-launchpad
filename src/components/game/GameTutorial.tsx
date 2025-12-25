import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Ticket, Target, Rocket, Coins, HelpCircle, ChevronRight, ChevronLeft, X } from 'lucide-react';

const TUTORIAL_STORAGE_KEY = 'orocket_tutorial_seen';

interface TutorialStep {
  icon: React.ElementType;
  title: string;
  description: string;
  tip: string;
  color: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    icon: Ticket,
    title: 'Buy Tickets',
    description: 'First, purchase game tickets using WOVER or USDT tokens. Each ticket has a WOVER value that determines your potential winnings.',
    tip: 'Tickets expire after 24 hours, so use them before they expire!',
    color: 'text-primary',
  },
  {
    icon: Target,
    title: 'Place Your Bet',
    description: 'Select a ticket and place your bet before the round starts. You can optionally set an auto-cashout multiplier to automatically collect winnings.',
    tip: 'Auto-cashout helps if you can\'t watch the game constantly.',
    color: 'text-warning',
  },
  {
    icon: Rocket,
    title: 'Watch the Rocket',
    description: 'Once the round starts, the rocket takes off and the multiplier increases. The longer it flies, the higher your potential winnings!',
    tip: 'The rocket can crash at any moment - there\'s no pattern!',
    color: 'text-success',
  },
  {
    icon: Coins,
    title: 'Cash Out to Win',
    description: 'Click "Cash Out" before the rocket crashes to lock in your winnings. If you cash out at 2x, you double your bet. But if the rocket crashes first, you lose!',
    tip: 'Higher multipliers = bigger rewards, but more risk!',
    color: 'text-destructive',
  },
];

interface GameTutorialProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

const GameTutorial = ({ forceOpen, onClose }: GameTutorialProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (forceOpen !== undefined) {
      setIsOpen(forceOpen);
      return;
    }
    
    // Check if user has seen tutorial
    const hasSeen = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!hasSeen) {
      setIsOpen(true);
    }
  }, [forceOpen]);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    }
    setIsOpen(false);
    setCurrentStep(0);
    onClose?.();
  };

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
    setIsOpen(false);
    setCurrentStep(0);
    onClose?.();
  };

  const step = tutorialSteps[currentStep];
  const StepIcon = step.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" />
            How to Play Rocket Crash
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {tutorialSteps.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? 'w-8 bg-primary'
                    : index < currentStep
                    ? 'w-4 bg-primary/50'
                    : 'w-4 bg-muted'
                }`}
              />
            ))}
          </div>

          {/* Step content */}
          <div className="text-center space-y-4">
            <div className={`w-16 h-16 mx-auto rounded-2xl bg-card flex items-center justify-center ${step.color}`}>
              <StepIcon className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold mb-2">
                {currentStep + 1}. {step.title}
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
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3">
          {/* Navigation buttons */}
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

          {/* Don't show again checkbox */}
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
  );
};

// Help button component to trigger tutorial
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
