import { useMemo } from 'react';

interface FlightBackground3DProps {
  isFlying: boolean;
  multiplier: number;
}

const FlightBackground3D = ({ isFlying, multiplier }: FlightBackground3DProps) => {
  // Generate random stars
  const stars = useMemo(() => {
    return Array.from({ length: 150 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 1 + Math.random() * 2,
      delay: Math.random() * 3,
      duration: 0.5 + Math.random() * 1.5,
    }));
  }, []);

  // Speed lines for flight effect
  const speedLines = useMemo(() => {
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      length: 50 + Math.random() * 150,
      delay: Math.random() * 2,
      duration: 0.3 + Math.random() * 0.5,
    }));
  }, []);

  const animationSpeed = isFlying ? Math.max(0.2, 1 - multiplier * 0.05) : 1;

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Deep space gradient */}
      <div 
        className="absolute inset-0 transition-all duration-1000"
        style={{
          background: isFlying 
            ? 'radial-gradient(ellipse at center, hsl(var(--background)) 0%, hsl(220 30% 5%) 50%, hsl(240 30% 3%) 100%)'
            : 'radial-gradient(ellipse at center, hsl(var(--background)) 0%, hsl(var(--background)) 100%)'
        }}
      />

      {/* Static stars layer */}
      <div className="absolute inset-0">
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: 0.3 + Math.random() * 0.4,
              animation: `twinkle ${2 + star.delay}s ease-in-out infinite`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Flying stars effect - only when flying */}
      {isFlying && (
        <div className="absolute inset-0">
          {stars.slice(0, 80).map((star) => (
            <div
              key={`fly-${star.id}`}
              className="absolute rounded-full"
              style={{
                left: `${star.left}%`,
                top: '50%',
                width: `${star.size * 1.5}px`,
                height: `${star.size * 1.5}px`,
                background: `radial-gradient(circle, hsl(var(--warning)) 0%, transparent 70%)`,
                animation: `flyToward ${star.duration * animationSpeed}s linear infinite`,
                animationDelay: `${star.delay * animationSpeed}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Speed lines - only when flying */}
      {isFlying && (
        <div className="absolute inset-0">
          {speedLines.map((line) => (
            <div
              key={`line-${line.id}`}
              className="absolute origin-center"
              style={{
                left: `${line.left}%`,
                top: '50%',
                width: `${line.length}px`,
                height: '1px',
                background: `linear-gradient(90deg, transparent 0%, hsl(var(--warning) / 0.6) 50%, hsl(var(--warning)) 100%)`,
                transform: `translateX(-50%) rotate(${(line.left - 50) * 1.5}deg)`,
                animation: `speedLine ${line.duration * animationSpeed}s linear infinite`,
                animationDelay: `${line.delay * animationSpeed}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Center glow effect when flying */}
      {isFlying && (
        <div 
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-500"
          style={{
            width: `${200 + multiplier * 20}px`,
            height: `${200 + multiplier * 20}px`,
            background: `radial-gradient(circle, hsl(var(--warning) / ${0.1 + multiplier * 0.02}) 0%, transparent 70%)`,
            filter: 'blur(40px)',
          }}
        />
      )}

      {/* Vignette effect */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, hsl(var(--background) / 0.8) 100%)',
        }}
      />

      {/* CSS Animations */}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.2); }
        }
        
        @keyframes flyToward {
          0% {
            transform: translateY(-50%) scale(0.1);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          100% {
            transform: translateY(-50%) scale(3) translateZ(100px);
            opacity: 0;
          }
        }
        
        @keyframes speedLine {
          0% {
            opacity: 0;
            transform: translateX(-200%) scaleX(0.5);
          }
          30% {
            opacity: 0.8;
          }
          100% {
            opacity: 0;
            transform: translateX(100vw) scaleX(2);
          }
        }
      `}</style>
    </div>
  );
};

export default FlightBackground3D;
