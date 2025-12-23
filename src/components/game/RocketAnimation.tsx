import { useEffect, useRef } from 'react';

interface RocketAnimationProps {
  status: 'betting' | 'countdown' | 'flying' | 'crashed' | 'payout' | 'idle';
  multiplier: number;
  crashPoint?: number | null;
}

const RocketAnimation = ({ status, multiplier, crashPoint }: RocketAnimationProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const rocketY = useRef(0);
  const particles = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    // Reset rocket position based on status
    if (status === 'betting' || status === 'countdown') {
      rocketY.current = height - 100;
    }

    const drawStars = () => {
      for (let i = 0; i < 50; i++) {
        const x = (Math.sin(i * 12.9898 + Date.now() * 0.0001) * 0.5 + 0.5) * width;
        const y = (Math.cos(i * 78.233 + Date.now() * 0.0001) * 0.5 + 0.5) * height;
        const size = Math.sin(i * 43758.5453 + Date.now() * 0.002) * 0.5 + 1;
        
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + Math.sin(Date.now() * 0.003 + i) * 0.3})`;
        ctx.fill();
      }
    };

    const drawRocket = (x: number, y: number, shake: boolean = false) => {
      ctx.save();
      
      const offsetX = shake ? (Math.random() - 0.5) * 4 : 0;
      const offsetY = shake ? (Math.random() - 0.5) * 4 : 0;
      
      ctx.translate(x + offsetX, y + offsetY);
      
      // Rocket body
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(-15, 20);
      ctx.lineTo(-10, 20);
      ctx.lineTo(-10, 35);
      ctx.lineTo(10, 35);
      ctx.lineTo(10, 20);
      ctx.lineTo(15, 20);
      ctx.closePath();
      
      const gradient = ctx.createLinearGradient(0, -30, 0, 35);
      gradient.addColorStop(0, '#FF6B35');
      gradient.addColorStop(0.5, '#FF8C42');
      gradient.addColorStop(1, '#FFD700');
      ctx.fillStyle = gradient;
      ctx.fill();
      
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Window
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#87CEEB';
      ctx.fill();
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Fins
      ctx.fillStyle = '#FF4500';
      ctx.beginPath();
      ctx.moveTo(-15, 20);
      ctx.lineTo(-25, 35);
      ctx.lineTo(-10, 30);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(15, 20);
      ctx.lineTo(25, 35);
      ctx.lineTo(10, 30);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    };

    const drawFlame = (x: number, y: number, intensity: number) => {
      const flameHeight = 30 + intensity * 20 + Math.sin(Date.now() * 0.02) * 10;
      
      // Outer flame
      ctx.beginPath();
      ctx.moveTo(x - 8, y + 35);
      ctx.quadraticCurveTo(x, y + 35 + flameHeight, x + 8, y + 35);
      const gradient = ctx.createLinearGradient(x, y + 35, x, y + 35 + flameHeight);
      gradient.addColorStop(0, '#FF4500');
      gradient.addColorStop(0.5, '#FF6347');
      gradient.addColorStop(1, 'rgba(255, 99, 71, 0)');
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Inner flame
      ctx.beginPath();
      ctx.moveTo(x - 4, y + 35);
      ctx.quadraticCurveTo(x, y + 35 + flameHeight * 0.7, x + 4, y + 35);
      const innerGradient = ctx.createLinearGradient(x, y + 35, x, y + 35 + flameHeight * 0.7);
      innerGradient.addColorStop(0, '#FFD700');
      innerGradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
      ctx.fillStyle = innerGradient;
      ctx.fill();
    };

    const drawExplosion = (x: number, y: number) => {
      // Add explosion particles
      for (let i = 0; i < 5; i++) {
        particles.current.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 0.5) * 10,
          life: 1,
          color: ['#FF4500', '#FF6347', '#FFD700', '#FFA500'][Math.floor(Math.random() * 4)],
        });
      }

      // Update and draw particles
      particles.current = particles.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.life -= 0.02;

        if (p.life > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.life * 8, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.fill();
          ctx.globalAlpha = 1;
          return true;
        }
        return false;
      });
    };

    const drawMultiplier = () => {
      ctx.font = 'bold 48px system-ui';
      ctx.textAlign = 'center';
      
      let color = '#22C55E'; // Green
      if (multiplier >= 5) color = '#EAB308'; // Yellow
      if (multiplier >= 8) color = '#EF4444'; // Red
      if (status === 'crashed') color = '#EF4444';
      
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.fillText(`${multiplier.toFixed(2)}x`, width / 2, 60);
      ctx.shadowBlur = 0;
      
      // Status text
      ctx.font = 'bold 18px system-ui';
      ctx.fillStyle = '#94A3B8';
      
      let statusText = '';
      switch (status) {
        case 'betting':
          statusText = 'PLACE YOUR BETS';
          break;
        case 'countdown':
          statusText = 'LAUNCHING...';
          break;
        case 'flying':
          statusText = 'ROCKET FLYING!';
          break;
        case 'crashed':
          statusText = `CRASHED @ ${crashPoint?.toFixed(2)}x`;
          ctx.fillStyle = '#EF4444';
          break;
        default:
          statusText = 'WAITING...';
      }
      
      ctx.fillText(statusText, width / 2, 90);
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Draw background stars
      drawStars();
      
      // Draw multiplier
      drawMultiplier();
      
      const rocketX = width / 2;
      
      switch (status) {
        case 'betting':
          rocketY.current = height - 100;
          drawRocket(rocketX, rocketY.current, false);
          break;
          
        case 'countdown':
          rocketY.current = height - 100;
          drawRocket(rocketX, rocketY.current, true);
          drawFlame(rocketX, rocketY.current, 0.3);
          break;
          
        case 'flying':
          // Move rocket up based on multiplier
          const targetY = height - 100 - (multiplier - 1) * 50;
          rocketY.current = Math.max(100, targetY);
          drawRocket(rocketX, rocketY.current, true);
          drawFlame(rocketX, rocketY.current, multiplier / 2);
          break;
          
        case 'crashed':
          drawExplosion(rocketX, rocketY.current);
          break;
          
        default:
          rocketY.current = height - 100;
          drawRocket(rocketX, rocketY.current, false);
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [status, multiplier, crashPoint]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ background: 'transparent' }}
    />
  );
};

export default RocketAnimation;
