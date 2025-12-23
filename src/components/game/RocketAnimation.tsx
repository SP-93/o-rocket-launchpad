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
  const trailParticles = useRef<Array<{ x: number; y: number; alpha: number; size: number }>>([]);
  const explosionParticles = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }>>([]);

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
    if (status === 'betting' || status === 'countdown' || status === 'idle') {
      rocketY.current = height - 120;
      trailParticles.current = [];
    }

    // Get CSS variable colors
    const getColor = (variable: string, fallback: string) => {
      try {
        const computed = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
        if (computed) {
          return `hsl(${computed})`;
        }
      } catch (e) {}
      return fallback;
    };

    const primaryColor = getColor('--primary', '#8B5CF6');
    const successColor = getColor('--success', '#22C55E');
    const destructiveColor = getColor('--destructive', '#EF4444');
    const warningColor = getColor('--warning', '#F59E0B');

    const drawRocket = (x: number, y: number, shake: boolean = false) => {
      ctx.save();
      
      const offsetX = shake ? (Math.random() - 0.5) * 3 : 0;
      const offsetY = shake ? (Math.random() - 0.5) * 3 : 0;
      
      ctx.translate(x + offsetX, y + offsetY);
      
      // Glow effect
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 20;
      
      // Rocket body - modern sleek design
      ctx.beginPath();
      ctx.moveTo(0, -40); // Tip
      ctx.bezierCurveTo(-5, -30, -12, -10, -12, 15); // Left curve
      ctx.lineTo(-12, 30);
      ctx.lineTo(-8, 35);
      ctx.lineTo(8, 35);
      ctx.lineTo(12, 30);
      ctx.lineTo(12, 15);
      ctx.bezierCurveTo(12, -10, 5, -30, 0, -40); // Right curve
      ctx.closePath();
      
      const bodyGradient = ctx.createLinearGradient(-15, -40, 15, 35);
      bodyGradient.addColorStop(0, '#E0E7FF');
      bodyGradient.addColorStop(0.3, '#C7D2FE');
      bodyGradient.addColorStop(0.7, '#A5B4FC');
      bodyGradient.addColorStop(1, '#818CF8');
      ctx.fillStyle = bodyGradient;
      ctx.fill();
      
      // Subtle stroke
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Window
      ctx.beginPath();
      ctx.arc(0, -5, 7, 0, Math.PI * 2);
      const windowGradient = ctx.createRadialGradient(0, -5, 0, 0, -5, 7);
      windowGradient.addColorStop(0, '#60A5FA');
      windowGradient.addColorStop(0.5, '#3B82F6');
      windowGradient.addColorStop(1, '#1D4ED8');
      ctx.fillStyle = windowGradient;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      // Window glare
      ctx.beginPath();
      ctx.arc(-2, -7, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fill();
      
      // Fins - angular modern design
      ctx.fillStyle = '#6366F1';
      
      // Left fin
      ctx.beginPath();
      ctx.moveTo(-12, 20);
      ctx.lineTo(-22, 38);
      ctx.lineTo(-12, 32);
      ctx.closePath();
      ctx.fill();
      
      // Right fin
      ctx.beginPath();
      ctx.moveTo(12, 20);
      ctx.lineTo(22, 38);
      ctx.lineTo(12, 32);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    };

    const drawFlame = (x: number, y: number, intensity: number) => {
      const time = Date.now() * 0.01;
      const baseHeight = 25 + intensity * 35;
      
      // Add trail particles
      if (status === 'flying') {
        trailParticles.current.push({
          x: x + (Math.random() - 0.5) * 10,
          y: y + 40,
          alpha: 0.8,
          size: 3 + Math.random() * 4
        });
      }
      
      // Draw trail
      trailParticles.current = trailParticles.current.filter(p => {
        p.y += 3;
        p.alpha -= 0.02;
        if (p.alpha > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.alpha, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(139, 92, 246, ${p.alpha * 0.3})`;
          ctx.fill();
          return true;
        }
        return false;
      });
      
      // Main flame
      for (let i = 0; i < 3; i++) {
        const flameWidth = 8 - i * 2;
        const flameHeight = baseHeight + Math.sin(time + i) * 8;
        const yOffset = i * 5;
        
        ctx.beginPath();
        ctx.moveTo(x - flameWidth, y + 35);
        ctx.quadraticCurveTo(
          x + Math.sin(time * 2 + i) * 3, 
          y + 35 + flameHeight + yOffset, 
          x + flameWidth, 
          y + 35
        );
        
        const gradient = ctx.createLinearGradient(x, y + 35, x, y + 35 + flameHeight + yOffset);
        if (i === 0) {
          gradient.addColorStop(0, 'rgba(139, 92, 246, 1)');
          gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.8)');
          gradient.addColorStop(1, 'rgba(192, 132, 252, 0)');
        } else if (i === 1) {
          gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
          gradient.addColorStop(0.3, 'rgba(196, 181, 253, 0.7)');
          gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');
        } else {
          gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
          gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        }
        
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    };

    const drawExplosion = (x: number, y: number) => {
      // Add new particles
      if (explosionParticles.current.length < 100) {
        for (let i = 0; i < 8; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2 + Math.random() * 6;
          explosionParticles.current.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2,
            life: 1,
            color: ['#EF4444', '#F97316', '#FBBF24', '#FDE047', '#8B5CF6'][Math.floor(Math.random() * 5)],
            size: 3 + Math.random() * 6
          });
        }
      }

      // Update and draw particles
      explosionParticles.current = explosionParticles.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life -= 0.015;
        p.size *= 0.98;

        if (p.life > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
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
      const centerY = height * 0.35;
      
      // Multiplier value
      ctx.font = 'bold 64px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      let color = successColor;
      if (multiplier >= 3) color = warningColor;
      if (multiplier >= 5) color = '#F97316';
      if (multiplier >= 8) color = destructiveColor;
      if (status === 'crashed') color = destructiveColor;
      
      // Glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 30;
      ctx.fillStyle = color;
      ctx.fillText(`${multiplier.toFixed(2)}×`, width / 2, centerY);
      
      // Clear shadow for status
      ctx.shadowBlur = 0;
      
      // Status text
      ctx.font = '600 16px system-ui, -apple-system, sans-serif';
      ctx.letterSpacing = '0.1em';
      
      let statusText = '';
      let statusColor = 'rgba(148, 163, 184, 0.8)';
      
      switch (status) {
        case 'betting':
          statusText = 'PLACE YOUR BETS';
          statusColor = primaryColor;
          break;
        case 'countdown':
          statusText = 'LAUNCHING...';
          statusColor = warningColor;
          break;
        case 'flying':
          statusText = 'TO THE MOON';
          statusColor = successColor;
          break;
        case 'crashed':
          statusText = `CRASHED @ ${crashPoint?.toFixed(2)}×`;
          statusColor = destructiveColor;
          break;
        case 'payout':
          statusText = 'CALCULATING PAYOUTS';
          statusColor = successColor;
          break;
        default:
          statusText = 'WAITING FOR ROUND';
      }
      
      ctx.fillStyle = statusColor;
      ctx.fillText(statusText, width / 2, centerY + 45);
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Draw multiplier first (background)
      drawMultiplier();
      
      const rocketX = width / 2;
      
      switch (status) {
        case 'betting':
        case 'idle':
          rocketY.current = height - 120;
          drawRocket(rocketX, rocketY.current, false);
          break;
          
        case 'countdown':
          rocketY.current = height - 120;
          drawRocket(rocketX, rocketY.current, true);
          drawFlame(rocketX, rocketY.current, 0.4);
          break;
          
        case 'flying':
          const targetY = height - 120 - (multiplier - 1) * 40;
          rocketY.current = Math.max(height * 0.55, targetY);
          drawRocket(rocketX, rocketY.current, true);
          drawFlame(rocketX, rocketY.current, Math.min(multiplier / 3, 1.5));
          break;
          
        case 'crashed':
          drawExplosion(rocketX, rocketY.current);
          break;
          
        case 'payout':
          // Just show multiplier, no rocket
          break;
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
