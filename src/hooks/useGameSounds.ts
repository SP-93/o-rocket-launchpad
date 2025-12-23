import { useCallback, useRef, useEffect } from 'react';

type SoundType = 'launch' | 'flying' | 'cashout' | 'crash' | 'tick' | 'win' | 'bet';

interface OscillatorConfig {
  frequency: number;
  type: OscillatorType;
  duration: number;
  gain: number;
  ramp?: { freq: number; time: number }[];
}

const useGameSounds = (enabled: boolean = true) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const flyingSoundRef = useRef<{ oscillator: OscillatorNode; gain: GainNode } | null>(null);

  // Initialize AudioContext on first interaction
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Create oscillator sound
  const playOscillator = useCallback((config: OscillatorConfig) => {
    if (!enabled) return;
    
    const ctx = initAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(config.frequency, ctx.currentTime);
    
    // Apply frequency ramps if specified
    if (config.ramp) {
      config.ramp.forEach(r => {
        oscillator.frequency.linearRampToValueAtTime(r.freq, ctx.currentTime + r.time);
      });
    }
    
    gainNode.gain.setValueAtTime(config.gain, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + config.duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + config.duration);
    
    return { oscillator, gain: gainNode };
  }, [enabled, initAudioContext]);

  // Play noise burst (for explosion)
  const playNoise = useCallback((duration: number, startGain: number) => {
    if (!enabled) return;
    
    const ctx = initAudioContext();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(startGain, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + duration);
    
    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    noise.start(ctx.currentTime);
  }, [enabled, initAudioContext]);

  // Sound definitions
  const playSound = useCallback((type: SoundType) => {
    if (!enabled) return;

    switch (type) {
      case 'launch':
        // Rocket launch - rising frequency with rumble
        playOscillator({
          frequency: 80,
          type: 'sawtooth',
          duration: 1.5,
          gain: 0.15,
          ramp: [
            { freq: 150, time: 0.3 },
            { freq: 300, time: 0.8 },
            { freq: 600, time: 1.2 },
          ]
        });
        // Add rumble
        playOscillator({
          frequency: 40,
          type: 'triangle',
          duration: 1,
          gain: 0.2,
          ramp: [{ freq: 60, time: 0.5 }]
        });
        break;

      case 'flying':
        // Continuous engine hum - handled separately
        break;

      case 'cashout':
        // Success chime - pleasant ascending notes
        playOscillator({
          frequency: 523.25, // C5
          type: 'sine',
          duration: 0.15,
          gain: 0.2
        });
        setTimeout(() => {
          playOscillator({
            frequency: 659.25, // E5
            type: 'sine',
            duration: 0.15,
            gain: 0.2
          });
        }, 100);
        setTimeout(() => {
          playOscillator({
            frequency: 783.99, // G5
            type: 'sine',
            duration: 0.3,
            gain: 0.25
          });
        }, 200);
        break;

      case 'crash':
        // Explosion - noise burst with falling tone
        playNoise(0.8, 0.4);
        playOscillator({
          frequency: 200,
          type: 'sawtooth',
          duration: 0.6,
          gain: 0.3,
          ramp: [
            { freq: 80, time: 0.2 },
            { freq: 30, time: 0.5 }
          ]
        });
        // Add impact
        playOscillator({
          frequency: 60,
          type: 'triangle',
          duration: 0.4,
          gain: 0.25
        });
        break;

      case 'tick':
        // Countdown tick
        playOscillator({
          frequency: 880,
          type: 'square',
          duration: 0.05,
          gain: 0.1
        });
        break;

      case 'win':
        // Big win fanfare
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
          setTimeout(() => {
            playOscillator({
              frequency: freq,
              type: 'sine',
              duration: 0.25,
              gain: 0.2
            });
          }, i * 120);
        });
        break;

      case 'bet':
        // Bet placed confirmation
        playOscillator({
          frequency: 440,
          type: 'sine',
          duration: 0.1,
          gain: 0.15
        });
        setTimeout(() => {
          playOscillator({
            frequency: 554.37,
            type: 'sine',
            duration: 0.1,
            gain: 0.15
          });
        }, 80);
        break;
    }
  }, [enabled, playOscillator, playNoise]);

  // Start continuous flying sound
  const startFlyingSound = useCallback(() => {
    if (!enabled || flyingSoundRef.current) return;
    
    const ctx = initAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(100, ctx.currentTime);
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.5);
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.start(ctx.currentTime);
    flyingSoundRef.current = { oscillator, gain: gainNode };
  }, [enabled, initAudioContext]);

  // Update flying sound based on multiplier
  const updateFlyingSound = useCallback((multiplier: number) => {
    if (!flyingSoundRef.current) return;
    
    const ctx = audioContextRef.current;
    if (!ctx) return;
    
    // Increase frequency with multiplier
    const freq = 100 + Math.min(multiplier * 30, 400);
    flyingSoundRef.current.oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
    
    // Slight gain increase
    const gain = 0.08 + Math.min(multiplier * 0.01, 0.1);
    flyingSoundRef.current.gain.gain.setValueAtTime(gain, ctx.currentTime);
  }, []);

  // Stop flying sound
  const stopFlyingSound = useCallback(() => {
    if (flyingSoundRef.current && audioContextRef.current) {
      const ctx = audioContextRef.current;
      flyingSoundRef.current.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
      flyingSoundRef.current.oscillator.stop(ctx.currentTime + 0.3);
      flyingSoundRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopFlyingSound();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stopFlyingSound]);

  return {
    playSound,
    startFlyingSound,
    updateFlyingSound,
    stopFlyingSound,
    initAudioContext
  };
};

export default useGameSounds;
