import { useState, useEffect, useCallback } from 'react';
import { Rocket } from 'lucide-react';

interface CountdownOverlayProps {
  status: string;
  onCountdownComplete?: () => void;
}

const CountdownOverlay = ({ status, onCountdownComplete }: CountdownOverlayProps) => {
  const [count, setCount] = useState<number | 'LAUNCH' | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (status === 'countdown') {
      setIsVisible(true);
      setCount(5);
      
      const interval = setInterval(() => {
        setCount(prev => {
          if (prev === null || prev === 'LAUNCH') return null;
          if (prev === 1) {
            setTimeout(() => {
              setCount('LAUNCH');
              setTimeout(() => {
                setIsVisible(false);
                onCountdownComplete?.();
              }, 800);
            }, 100);
            return prev;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    } else if (status === 'flying') {
      // Show LAUNCH briefly when flying starts
      setCount('LAUNCH');
      setIsVisible(true);
      setTimeout(() => {
        setIsVisible(false);
        setCount(null);
      }, 600);
    } else {
      setIsVisible(false);
      setCount(null);
    }
  }, [status, onCountdownComplete]);

  if (!isVisible || count === null) return null;

  const isLaunch = count === 'LAUNCH';

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
      {/* Radial pulse background */}
      <div 
        className={`absolute inset-0 transition-opacity duration-300 ${isLaunch ? 'opacity-100' : 'opacity-60'}`}
        style={{
          background: isLaunch 
            ? 'radial-gradient(circle at center, rgba(249, 115, 22, 0.3) 0%, transparent 70%)'
            : 'radial-gradient(circle at center, rgba(251, 191, 36, 0.2) 0%, transparent 60%)'
        }}
      />

      {/* Main countdown display */}
      <div className="relative">
        {/* Outer ring pulse */}
        <div 
          className={`absolute inset-0 -m-16 rounded-full border-4 ${
            isLaunch ? 'border-warning' : 'border-warning/50'
          }`}
          style={{
            animation: 'countdown-ring 1s ease-out infinite',
          }}
        />
        
        {/* Second ring */}
        <div 
          className={`absolute inset-0 -m-8 rounded-full border-2 ${
            isLaunch ? 'border-primary' : 'border-primary/40'
          }`}
          style={{
            animation: 'countdown-ring 1s ease-out infinite 0.2s',
          }}
        />

        {/* Number/Text container */}
        <div 
          className={`relative flex items-center justify-center ${
            isLaunch ? 'w-48 h-48' : 'w-40 h-40'
          }`}
        >
          {/* Glow effect */}
          <div 
            className={`absolute inset-0 rounded-full blur-3xl ${
              isLaunch ? 'bg-warning/40' : 'bg-primary/30'
            }`}
            style={{
              animation: 'countdown-glow 0.5s ease-in-out infinite alternate',
            }}
          />

          {/* Circle background */}
          <div 
            className={`absolute inset-0 rounded-full ${
              isLaunch 
                ? 'bg-gradient-to-br from-warning/30 via-warning/20 to-destructive/20 border-2 border-warning' 
                : 'bg-gradient-to-br from-primary/20 via-card/80 to-accent/20 border border-primary/50'
            }`}
            style={{
              boxShadow: isLaunch 
                ? '0 0 60px rgba(249, 115, 22, 0.5), inset 0 0 40px rgba(249, 115, 22, 0.2)'
                : '0 0 40px rgba(var(--primary), 0.3), inset 0 0 30px rgba(var(--primary), 0.1)',
            }}
          />

          {/* Countdown number or LAUNCH text */}
          {isLaunch ? (
            <div 
              className="relative flex flex-col items-center gap-2"
              style={{ animation: 'countdown-launch 0.6s ease-out' }}
            >
              <Rocket className="w-10 h-10 text-warning animate-bounce" />
              <span 
                className="text-4xl md:text-5xl font-black tracking-widest text-transparent bg-clip-text"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #FDE047 0%, #F59E0B 50%, #EA580C 100%)',
                  textShadow: '0 0 40px rgba(249, 115, 22, 0.8)',
                  filter: 'drop-shadow(0 0 20px rgba(249, 115, 22, 0.6))',
                }}
              >
                LAUNCH!
              </span>
            </div>
          ) : (
            <span 
              key={count}
              className="relative text-8xl md:text-9xl font-black text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(180deg, #FBBF24 0%, #F59E0B 50%, #EA580C 100%)',
                animation: 'countdown-number 1s ease-out',
                textShadow: '0 0 60px rgba(251, 191, 36, 0.8)',
                filter: 'drop-shadow(0 0 30px rgba(251, 191, 36, 0.5))',
              }}
            >
              {count}
            </span>
          )}
        </div>

        {/* Corner decorations */}
        {!isLaunch && (
          <>
            <div className="absolute -top-12 -left-12 w-6 h-6 border-l-2 border-t-2 border-warning/60 rounded-tl" />
            <div className="absolute -top-12 -right-12 w-6 h-6 border-r-2 border-t-2 border-warning/60 rounded-tr" />
            <div className="absolute -bottom-12 -left-12 w-6 h-6 border-l-2 border-b-2 border-warning/60 rounded-bl" />
            <div className="absolute -bottom-12 -right-12 w-6 h-6 border-r-2 border-b-2 border-warning/60 rounded-br" />
          </>
        )}
      </div>

      {/* Particle effects during countdown */}
      {!isLaunch && (
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-warning/60"
              style={{
                left: `${50 + Math.cos((i / 12) * Math.PI * 2) * 35}%`,
                top: `${50 + Math.sin((i / 12) * Math.PI * 2) * 35}%`,
                animation: `countdown-particle 1s ease-in-out infinite ${i * 0.08}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Status text */}
      <div className="absolute bottom-1/4 text-center">
        <p 
          className="text-lg md:text-xl font-semibold text-warning/80 tracking-wider uppercase"
          style={{ textShadow: '0 0 20px rgba(251, 191, 36, 0.5)' }}
        >
          {isLaunch ? '🚀 TO THE MOON!' : 'GET READY'}
        </p>
      </div>

      {/* CSS Keyframes */}
      <style>{`
        @keyframes countdown-number {
          0% {
            transform: scale(2) rotate(-10deg);
            opacity: 0;
          }
          30% {
            transform: scale(0.9) rotate(0deg);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes countdown-launch {
          0% {
            transform: scale(0.5) translateY(20px);
            opacity: 0;
          }
          50% {
            transform: scale(1.2) translateY(-10px);
          }
          100% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }

        @keyframes countdown-ring {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }

        @keyframes countdown-glow {
          0% {
            transform: scale(0.9);
            opacity: 0.6;
          }
          100% {
            transform: scale(1.1);
            opacity: 1;
          }
        }

        @keyframes countdown-particle {
          0%, 100% {
            transform: scale(1);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.5);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default CountdownOverlay;
