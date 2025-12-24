import { useMemo } from 'react';

interface FlightBackground3DProps {
  isFlying: boolean;
  multiplier: number;
}

const FlightBackground3D = ({ isFlying, multiplier }: FlightBackground3DProps) => {
  // Generate more stars for denser field
  const stars = useMemo(() => {
    return Array.from({ length: 250 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 1 + Math.random() * 3,
      delay: Math.random() * 3,
      duration: 0.5 + Math.random() * 1.5,
      brightness: 0.4 + Math.random() * 0.6,
    }));
  }, []);

  // More speed lines for better flight effect
  const speedLines = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      length: 80 + Math.random() * 200,
      delay: Math.random() * 2,
      duration: 0.2 + Math.random() * 0.4,
    }));
  }, []);

  const animationSpeed = isFlying ? Math.max(0.15, 1 - multiplier * 0.06) : 1;
  const glowIntensity = isFlying ? Math.min(0.4, 0.15 + multiplier * 0.03) : 0.05;

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Deep space gradient with purple/blue tones */}
      <div 
        className="absolute inset-0 transition-all duration-700"
        style={{
          background: isFlying 
            ? `radial-gradient(ellipse at 50% 60%, 
                hsl(260 40% 8%) 0%, 
                hsl(230 50% 6%) 30%, 
                hsl(220 60% 4%) 60%, 
                hsl(240 50% 2%) 100%)`
            : 'radial-gradient(ellipse at center, hsl(var(--background)) 0%, hsl(var(--background)) 100%)'
        }}
      />

      {/* Nebula effect when flying */}
      {isFlying && (
        <>
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              background: `radial-gradient(ellipse at 30% 40%, hsl(280 60% 20% / 0.3) 0%, transparent 50%),
                           radial-gradient(ellipse at 70% 60%, hsl(200 60% 20% / 0.2) 0%, transparent 50%)`
            }}
          />
        </>
      )}

      {/* Static stars layer - always visible */}
      <div className="absolute inset-0">
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute rounded-full"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              backgroundColor: isFlying ? 'hsl(var(--warning))' : 'white',
              opacity: isFlying ? star.brightness * 0.8 : star.brightness * 0.5,
              boxShadow: isFlying ? `0 0 ${star.size * 2}px hsl(var(--warning) / 0.5)` : 'none',
              animation: `twinkle ${2 + star.delay}s ease-in-out infinite`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Flying stars effect - only when flying */}
      {isFlying && (
        <div className="absolute inset-0">
          {stars.slice(0, 120).map((star) => (
            <div
              key={`fly-${star.id}`}
              className="absolute rounded-full"
              style={{
                left: `${star.left}%`,
                top: '50%',
                width: `${star.size * 2}px`,
                height: `${star.size * 2}px`,
                background: `radial-gradient(circle, hsl(var(--warning)) 0%, hsl(var(--warning) / 0.5) 40%, transparent 70%)`,
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
                height: '2px',
                background: `linear-gradient(90deg, transparent 0%, hsl(var(--warning) / 0.4) 30%, hsl(var(--warning) / 0.8) 70%, hsl(var(--warning)) 100%)`,
                transform: `translateX(-50%) rotate(${(line.left - 50) * 1.2}deg)`,
                animation: `speedLine ${line.duration * animationSpeed}s linear infinite`,
                animationDelay: `${line.delay * animationSpeed}s`,
                filter: 'blur(0.5px)',
              }}
            />
          ))}
        </div>
      )}

      {/* Center glow effect when flying - stronger */}
      {isFlying && (
        <>
          <div 
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-300"
            style={{
              width: `${300 + multiplier * 40}px`,
              height: `${300 + multiplier * 40}px`,
              background: `radial-gradient(circle, hsl(var(--warning) / ${glowIntensity}) 0%, hsl(var(--warning) / ${glowIntensity * 0.3}) 40%, transparent 70%)`,
              filter: 'blur(60px)',
            }}
          />
          {/* Secondary glow */}
          <div 
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: `${150 + multiplier * 20}px`,
              height: `${150 + multiplier * 20}px`,
              background: `radial-gradient(circle, hsl(var(--primary) / ${glowIntensity * 0.5}) 0%, transparent 70%)`,
              filter: 'blur(30px)',
            }}
          />
        </>
      )}

      {/* Vignette effect - always present, stronger when flying */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          background: `radial-gradient(ellipse at center, transparent ${isFlying ? '30%' : '50%'}, hsl(var(--background) / ${isFlying ? '0.9' : '0.7'}) 100%)`,
        }}
      />

      {/* CSS Animations */}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
        
        @keyframes flyToward {
          0% {
            transform: translateY(-50%) scale(0.1);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          100% {
            transform: translateY(-50%) scale(4) translateZ(200px);
            opacity: 0;
          }
        }
        
        @keyframes speedLine {
          0% {
            opacity: 0;
            transform: translateX(-300%) scaleX(0.3);
          }
          20% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateX(100vw) scaleX(2.5);
          }
        }
      `}</style>
    </div>
  );
};

export default FlightBackground3D;
