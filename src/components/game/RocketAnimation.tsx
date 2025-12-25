import { useEffect, useRef, useMemo } from 'react';

interface RocketAnimationProps {
  status: 'betting' | 'countdown' | 'flying' | 'crashed' | 'payout' | 'idle';
  multiplier: number;
  crashPoint?: number | null;
}

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

interface Nebula {
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha: number;
}

const RocketAnimation = ({ status, multiplier, crashPoint }: RocketAnimationProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const rocketY = useRef(0);
  const trailParticles = useRef<Array<{ x: number; y: number; alpha: number; size: number }>>([]);
  const explosionParticles = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }>>([]);
  const orbitAngle = useRef(0);
  const starsRef = useRef<Star[]>([]);
  const nebulaeRef = useRef<Nebula[]>([]);
  const timeRef = useRef(0);

  // Generate stars once
  const generateStars = (width: number, height: number): Star[] => {
    const stars: Star[] = [];
    const count = Math.floor((width * height) / 3000); // Density based on canvas size
    
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.8 + 0.2,
        twinkleSpeed: Math.random() * 2 + 1,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }
    return stars;
  };

  // Generate nebulae
  const generateNebulae = (width: number, height: number): Nebula[] => {
    const colors = [
      'rgba(147, 51, 234, 0.15)',   // Purple
      'rgba(59, 130, 246, 0.12)',   // Blue
      'rgba(236, 72, 153, 0.1)',    // Pink
      'rgba(249, 115, 22, 0.08)',   // Orange
    ];
    
    return [
      { x: width * 0.2, y: height * 0.3, radius: width * 0.4, color: colors[0], alpha: 0.15 },
      { x: width * 0.8, y: height * 0.6, radius: width * 0.35, color: colors[1], alpha: 0.12 },
      { x: width * 0.5, y: height * 0.8, radius: width * 0.3, color: colors[2], alpha: 0.1 },
    ];
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      
      // Regenerate background elements on resize
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      starsRef.current = generateStars(w, h);
      nebulaeRef.current = generateNebulae(w, h);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    
    // Initialize background elements
    if (starsRef.current.length === 0) {
      starsRef.current = generateStars(width, height);
      nebulaeRef.current = generateNebulae(width, height);
    }

    // Reset rocket position based on status
    if (status === 'betting' || status === 'countdown' || status === 'idle') {
      rocketY.current = height - 160;
      trailParticles.current = [];
    }

    // Draw space background with gradient, stars, and nebulae
    const drawBackground = () => {
      timeRef.current += 0.016; // ~60fps time increment
      
      // Deep space gradient
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, '#0a0a1a');
      bgGradient.addColorStop(0.3, '#0f0f2a');
      bgGradient.addColorStop(0.6, '#1a1a35');
      bgGradient.addColorStop(1, '#151530');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);
      
      // Draw nebulae (subtle cloud effects)
      nebulaeRef.current.forEach(nebula => {
        const gradient = ctx.createRadialGradient(
          nebula.x, nebula.y, 0,
          nebula.x, nebula.y, nebula.radius
        );
        gradient.addColorStop(0, nebula.color);
        gradient.addColorStop(0.5, nebula.color.replace(/[\d.]+\)$/, '0.05)'));
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      });
      
      // Draw stars with twinkling effect
      starsRef.current.forEach(star => {
        const twinkle = Math.sin(timeRef.current * star.twinkleSpeed + star.twinkleOffset);
        const alpha = star.alpha * (0.6 + 0.4 * twinkle);
        
        // Parallax effect when flying
        let yOffset = 0;
        if (status === 'flying') {
          yOffset = (multiplier - 1) * star.size * 3;
        }
        const starY = (star.y + yOffset) % height;
        
        ctx.beginPath();
        ctx.arc(star.x, starY, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
        
        // Add glow to brighter stars
        if (star.size > 1.5) {
          ctx.beginPath();
          ctx.arc(star.x, starY, star.size * 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(200, 220, 255, ${alpha * 0.2})`;
          ctx.fill();
        }
      });
      
      // Add subtle vignette
      const vignetteGradient = ctx.createRadialGradient(
        width / 2, height / 2, height * 0.3,
        width / 2, height / 2, height * 0.8
      );
      vignetteGradient.addColorStop(0, 'transparent');
      vignetteGradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
      ctx.fillStyle = vignetteGradient;
      ctx.fillRect(0, 0, width, height);
    };
    
    // Color constants for game states
    const successColor = '#22C55E';
    const destructiveColor = '#EF4444';
    const warningColor = '#F59E0B';

    const drawRocket = (x: number, y: number, shake: boolean = false) => {
      ctx.save();
      
      const offsetX = shake ? (Math.random() - 0.5) * 4 : 0;
      const offsetY = shake ? (Math.random() - 0.5) * 4 : 0;
      
      ctx.translate(x + offsetX, y + offsetY);
      
      // Orbit ring (behind rocket)
      orbitAngle.current += 0.03;
      ctx.save();
      ctx.rotate(orbitAngle.current);
      
      // Draw orbit ring - O'Rocket style
      ctx.beginPath();
      ctx.ellipse(0, 0, 85, 25, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#F97316';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#F97316';
      ctx.shadowBlur = 15;
      ctx.stroke();
      
      // Second orbit for depth
      ctx.beginPath();
      ctx.ellipse(0, 0, 85, 25, 0, Math.PI * 0.7, Math.PI * 1.3);
      ctx.strokeStyle = '#FB923C';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      
      // Rocket glow
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 40;
      
      // Main rocket body - O'Rocket style (larger, ~160px tall)
      ctx.beginPath();
      ctx.moveTo(0, -80); // Tip (pointy top)
      ctx.bezierCurveTo(-8, -65, -20, -40, -22, 0); // Left upper curve
      ctx.bezierCurveTo(-22, 30, -20, 50, -18, 60); // Left body
      ctx.lineTo(-15, 70);
      ctx.lineTo(-10, 75);
      ctx.lineTo(10, 75);
      ctx.lineTo(15, 70);
      ctx.lineTo(18, 60);
      ctx.bezierCurveTo(20, 50, 22, 30, 22, 0); // Right body
      ctx.bezierCurveTo(20, -40, 8, -65, 0, -80); // Right upper curve
      ctx.closePath();
      
      // O'Rocket gradient - Orange to Yellow
      const bodyGradient = ctx.createLinearGradient(-25, -80, 25, 75);
      bodyGradient.addColorStop(0, '#FDE68A'); // Light yellow tip
      bodyGradient.addColorStop(0.2, '#FBBF24'); // Golden
      bodyGradient.addColorStop(0.5, '#F59E0B'); // Orange
      bodyGradient.addColorStop(0.8, '#EA580C'); // Deep orange
      bodyGradient.addColorStop(1, '#DC2626'); // Red bottom
      ctx.fillStyle = bodyGradient;
      ctx.fill();
      
      // Body highlight
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(-5, -75);
      ctx.bezierCurveTo(-12, -50, -15, -20, -15, 10);
      ctx.bezierCurveTo(-15, 30, -12, 50, -10, 60);
      ctx.lineTo(-8, 60);
      ctx.bezierCurveTo(-10, 50, -12, 30, -12, 10);
      ctx.bezierCurveTo(-12, -20, -9, -50, -3, -73);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fill();
      
      // Metallic stripe
      ctx.beginPath();
      ctx.moveTo(-18, 35);
      ctx.lineTo(-18, 45);
      ctx.lineTo(18, 45);
      ctx.lineTo(18, 35);
      ctx.closePath();
      ctx.fillStyle = '#78716C';
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(-16, 37);
      ctx.lineTo(-16, 43);
      ctx.lineTo(16, 43);
      ctx.lineTo(16, 37);
      ctx.closePath();
      ctx.fillStyle = '#A8A29E';
      ctx.fill();
      
      // Main window - larger and more detailed
      ctx.beginPath();
      ctx.arc(0, -15, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#1E3A5F';
      ctx.shadowColor = '#60A5FA';
      ctx.shadowBlur = 10;
      ctx.fill();
      
      // Window inner
      ctx.beginPath();
      ctx.arc(0, -15, 13, 0, Math.PI * 2);
      const windowGradient = ctx.createRadialGradient(-3, -18, 0, 0, -15, 13);
      windowGradient.addColorStop(0, '#93C5FD');
      windowGradient.addColorStop(0.4, '#3B82F6');
      windowGradient.addColorStop(0.8, '#1E40AF');
      windowGradient.addColorStop(1, '#1E3A8A');
      ctx.fillStyle = windowGradient;
      ctx.fill();
      
      // Window frame
      ctx.strokeStyle = '#FCD34D';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 0;
      ctx.stroke();
      
      // Window glare
      ctx.beginPath();
      ctx.arc(-4, -19, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(3, -12, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fill();
      
      // Fins - Detailed O'Rocket style
      const finGradient = ctx.createLinearGradient(-30, 40, -15, 85);
      finGradient.addColorStop(0, '#F59E0B');
      finGradient.addColorStop(0.5, '#EA580C');
      finGradient.addColorStop(1, '#B91C1C');
      
      // Left fin
      ctx.beginPath();
      ctx.moveTo(-18, 50);
      ctx.lineTo(-35, 85);
      ctx.lineTo(-28, 85);
      ctx.lineTo(-15, 70);
      ctx.closePath();
      ctx.fillStyle = finGradient;
      ctx.fill();
      
      // Left fin highlight
      ctx.beginPath();
      ctx.moveTo(-18, 52);
      ctx.lineTo(-30, 78);
      ctx.lineTo(-25, 78);
      ctx.lineTo(-16, 65);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fill();
      
      // Right fin
      const finGradientR = ctx.createLinearGradient(15, 40, 30, 85);
      finGradientR.addColorStop(0, '#F59E0B');
      finGradientR.addColorStop(0.5, '#EA580C');
      finGradientR.addColorStop(1, '#B91C1C');
      
      ctx.beginPath();
      ctx.moveTo(18, 50);
      ctx.lineTo(35, 85);
      ctx.lineTo(28, 85);
      ctx.lineTo(15, 70);
      ctx.closePath();
      ctx.fillStyle = finGradientR;
      ctx.fill();
      
      // Center fin (back)
      ctx.beginPath();
      ctx.moveTo(0, 55);
      ctx.lineTo(-8, 80);
      ctx.lineTo(0, 75);
      ctx.lineTo(8, 80);
      ctx.closePath();
      ctx.fillStyle = '#DC2626';
      ctx.fill();
      
      // Engine nozzle
      ctx.beginPath();
      ctx.moveTo(-12, 72);
      ctx.lineTo(-15, 82);
      ctx.lineTo(15, 82);
      ctx.lineTo(12, 72);
      ctx.closePath();
      ctx.fillStyle = '#57534E';
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(-10, 75);
      ctx.lineTo(-12, 82);
      ctx.lineTo(12, 82);
      ctx.lineTo(10, 75);
      ctx.closePath();
      ctx.fillStyle = '#292524';
      ctx.fill();
      
      ctx.restore();
    };

    const drawFlame = (x: number, y: number, intensity: number) => {
      const time = Date.now() * 0.015;
      const baseHeight = 40 + intensity * 60;
      
      // Add trail particles - Orange/Yellow theme
      if (status === 'flying') {
        for (let i = 0; i < 3; i++) {
          trailParticles.current.push({
            x: x + (Math.random() - 0.5) * 15,
            y: y + 85,
            alpha: 0.9,
            size: 4 + Math.random() * 6
          });
        }
      }
      
      // Draw trail with orange colors
      trailParticles.current = trailParticles.current.filter(p => {
        p.y += 4;
        p.alpha -= 0.025;
        if (p.alpha > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.alpha, 0, Math.PI * 2);
          const trailGradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * p.alpha);
          trailGradient.addColorStop(0, `rgba(251, 191, 36, ${p.alpha * 0.6})`);
          trailGradient.addColorStop(0.5, `rgba(249, 115, 22, ${p.alpha * 0.4})`);
          trailGradient.addColorStop(1, `rgba(234, 88, 12, ${p.alpha * 0.1})`);
          ctx.fillStyle = trailGradient;
          ctx.fill();
          return true;
        }
        return false;
      });
      
      // Flame layers
      for (let i = 0; i < 4; i++) {
        const flameWidth = 14 - i * 3;
        const flameHeight = baseHeight + Math.sin(time * 3 + i * 0.5) * 15;
        const yOffset = i * 8;
        
        ctx.beginPath();
        ctx.moveTo(x - flameWidth, y + 80);
        
        // More dynamic flame shape
        const wobble1 = Math.sin(time * 4 + i) * 6;
        const wobble2 = Math.sin(time * 5 + i * 2) * 4;
        
        ctx.quadraticCurveTo(
          x - flameWidth/2 + wobble1, 
          y + 80 + flameHeight * 0.6 + yOffset,
          x + wobble2,
          y + 80 + flameHeight + yOffset
        );
        ctx.quadraticCurveTo(
          x + flameWidth/2 + wobble1, 
          y + 80 + flameHeight * 0.6 + yOffset,
          x + flameWidth, 
          y + 80
        );
        
        const gradient = ctx.createLinearGradient(x, y + 80, x, y + 80 + flameHeight + yOffset);
        if (i === 0) {
          gradient.addColorStop(0, 'rgba(249, 115, 22, 1)');
          gradient.addColorStop(0.4, 'rgba(234, 88, 12, 0.9)');
          gradient.addColorStop(0.7, 'rgba(220, 38, 38, 0.6)');
          gradient.addColorStop(1, 'rgba(185, 28, 28, 0)');
        } else if (i === 1) {
          gradient.addColorStop(0, 'rgba(251, 191, 36, 1)');
          gradient.addColorStop(0.3, 'rgba(249, 115, 22, 0.8)');
          gradient.addColorStop(0.7, 'rgba(234, 88, 12, 0.4)');
          gradient.addColorStop(1, 'rgba(220, 38, 38, 0)');
        } else if (i === 2) {
          gradient.addColorStop(0, 'rgba(254, 240, 138, 1)');
          gradient.addColorStop(0.3, 'rgba(251, 191, 36, 0.8)');
          gradient.addColorStop(1, 'rgba(249, 115, 22, 0)');
        } else {
          gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
          gradient.addColorStop(0.4, 'rgba(254, 240, 138, 0.6)');
          gradient.addColorStop(1, 'rgba(251, 191, 36, 0)');
        }
        
        ctx.fillStyle = gradient;
        ctx.shadowColor = '#F59E0B';
        ctx.shadowBlur = 20;
        ctx.fill();
      }
      
      ctx.shadowBlur = 0;
    };

    const drawExplosion = (x: number, y: number) => {
      // Add new particles with orange/yellow colors
      if (explosionParticles.current.length < 120) {
        for (let i = 0; i < 10; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 3 + Math.random() * 8;
          explosionParticles.current.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 3,
            life: 1,
            color: ['#F59E0B', '#FBBF24', '#F97316', '#EF4444', '#FDE047', '#DC2626'][Math.floor(Math.random() * 6)],
            size: 4 + Math.random() * 8
          });
        }
      }

      // Update and draw particles
      explosionParticles.current = explosionParticles.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life -= 0.018;
        p.size *= 0.97;

        if (p.life > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
          return true;
        }
        return false;
      });
    };

    const drawMultiplier = () => {
      const centerY = height * 0.32;
      
      // Multiplier value
      ctx.font = 'bold 72px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      let color = successColor;
      if (multiplier >= 3) color = '#FBBF24';
      if (multiplier >= 5) color = '#F97316';
      if (multiplier >= 8) color = destructiveColor;
      if (status === 'crashed') color = destructiveColor;
      
      // Glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 40;
      ctx.fillStyle = color;
      ctx.fillText(`${multiplier.toFixed(2)}×`, width / 2, centerY);
      
      // Clear shadow for status
      ctx.shadowBlur = 0;
      
      // Status text
      ctx.font = '600 18px system-ui, -apple-system, sans-serif';
      
      let statusText = '';
      let statusColor = 'rgba(148, 163, 184, 0.8)';
      
      switch (status) {
        case 'betting':
          statusText = 'PLACE YOUR BETS';
          statusColor = '#FBBF24';
          break;
        case 'countdown':
          statusText = 'LAUNCHING...';
          statusColor = '#F97316';
          break;
        case 'flying':
          statusText = 'TO THE MOON 🚀';
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
      ctx.fillText(statusText, width / 2, centerY + 50);
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Draw space background first
      drawBackground();
      
      // Draw multiplier
      drawMultiplier();
      
      const rocketX = width / 2;
      
      switch (status) {
        case 'betting':
        case 'idle':
          rocketY.current = height - 160;
          drawRocket(rocketX, rocketY.current, false);
          break;
          
        case 'countdown':
          rocketY.current = height - 160;
          drawRocket(rocketX, rocketY.current, true);
          drawFlame(rocketX, rocketY.current, 0.5);
          break;
          
        case 'flying':
          const targetY = height - 160 - (multiplier - 1) * 50;
          rocketY.current = Math.max(height * 0.52, targetY);
          drawRocket(rocketX, rocketY.current, true);
          drawFlame(rocketX, rocketY.current, Math.min(multiplier / 2.5, 1.8));
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
