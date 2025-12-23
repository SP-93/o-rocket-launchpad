import { useEffect, useState, useCallback } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  shape: 'circle' | 'square' | 'triangle' | 'star';
  opacity: number;
}

interface WinConfettiProps {
  isActive: boolean;
  multiplier?: number;
}

const COLORS = [
  '#F59E0B', // warning/orange
  '#FBBF24', // yellow
  '#22C55E', // success/green
  '#3B82F6', // blue
  '#A855F7', // purple
  '#EC4899', // pink
  '#FDE047', // light yellow
  '#FB923C', // light orange
];

const WinConfetti = ({ isActive, multiplier = 1 }: WinConfettiProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  const createParticles = useCallback(() => {
    const newParticles: Particle[] = [];
    // More particles for higher multipliers
    const particleCount = Math.min(80 + Math.floor(multiplier * 10), 150);

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.random() * Math.PI * 2);
      const velocity = 8 + Math.random() * 12;
      const shapes: Particle['shape'][] = ['circle', 'square', 'triangle', 'star'];
      
      newParticles.push({
        id: i,
        x: 50, // Start from center (percentage)
        y: 40, // Start slightly above center
        vx: Math.cos(angle) * velocity * (0.5 + Math.random()),
        vy: Math.sin(angle) * velocity * 0.8 - 5, // Bias upward initially
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 10,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        opacity: 1,
      });
    }
    
    setParticles(newParticles);
  }, [multiplier]);

  useEffect(() => {
    if (isActive) {
      createParticles();
      
      // Animation loop
      const interval = setInterval(() => {
        setParticles(prev => {
          const updated = prev.map(p => ({
            ...p,
            x: p.x + p.vx * 0.1,
            y: p.y + p.vy * 0.1,
            vy: p.vy + 0.3, // Gravity
            vx: p.vx * 0.99, // Air resistance
            rotation: p.rotation + p.rotationSpeed,
            opacity: Math.max(0, p.opacity - 0.008),
          })).filter(p => p.opacity > 0 && p.y < 120);
          
          return updated;
        });
      }, 16);

      // Clear after animation
      const timeout = setTimeout(() => {
        setParticles([]);
        clearInterval(interval);
      }, 4000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    } else {
      setParticles([]);
    }
  }, [isActive, createParticles]);

  if (!isActive && particles.length === 0) return null;

  const renderShape = (particle: Particle) => {
    const style: React.CSSProperties = {
      position: 'absolute',
      left: `${particle.x}%`,
      top: `${particle.y}%`,
      width: particle.size,
      height: particle.size,
      transform: `translate(-50%, -50%) rotate(${particle.rotation}deg)`,
      opacity: particle.opacity,
      pointerEvents: 'none',
    };

    switch (particle.shape) {
      case 'circle':
        return (
          <div
            key={particle.id}
            style={{
              ...style,
              borderRadius: '50%',
              backgroundColor: particle.color,
              boxShadow: `0 0 ${particle.size / 2}px ${particle.color}`,
            }}
          />
        );
      case 'square':
        return (
          <div
            key={particle.id}
            style={{
              ...style,
              backgroundColor: particle.color,
              boxShadow: `0 0 ${particle.size / 2}px ${particle.color}`,
            }}
          />
        );
      case 'triangle':
        return (
          <div
            key={particle.id}
            style={{
              ...style,
              width: 0,
              height: 0,
              borderLeft: `${particle.size / 2}px solid transparent`,
              borderRight: `${particle.size / 2}px solid transparent`,
              borderBottom: `${particle.size}px solid ${particle.color}`,
              backgroundColor: 'transparent',
            }}
          />
        );
      case 'star':
        return (
          <div
            key={particle.id}
            style={{
              ...style,
              fontSize: particle.size,
              lineHeight: 1,
              color: particle.color,
              textShadow: `0 0 ${particle.size / 2}px ${particle.color}`,
            }}
          >
            ★
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {/* Win message overlay */}
      {isActive && multiplier >= 3 && (
        <div 
          className="absolute top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          style={{ animation: 'win-message 0.5s ease-out' }}
        >
          <div className="text-center">
            <div 
              className="text-4xl md:text-6xl font-black text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(135deg, #FDE047 0%, #22C55E 50%, #3B82F6 100%)',
                textShadow: '0 0 40px rgba(34, 197, 94, 0.6)',
                filter: 'drop-shadow(0 0 20px rgba(34, 197, 94, 0.4))',
                animation: 'win-pulse 0.5s ease-in-out infinite alternate',
              }}
            >
              🎉 {multiplier.toFixed(2)}× WIN! 🎉
            </div>
          </div>
        </div>
      )}

      {/* Confetti particles */}
      {particles.map(renderShape)}

      {/* Keyframes */}
      <style>{`
        @keyframes win-message {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 0;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }
        
        @keyframes win-pulse {
          0% {
            transform: scale(1);
          }
          100% {
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  );
};

export default WinConfetti;
