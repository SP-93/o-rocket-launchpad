import { useCallback, useRef, useEffect } from 'react';

type SoundType = 'launch' | 'flying' | 'cashout' | 'crash' | 'tick' | 'win' | 'bet' | 'countdown' | 'milestone';

interface AudioNodes {
  oscillator?: OscillatorNode;
  gain?: GainNode;
  filter?: BiquadFilterNode;
}

const useGameSounds = (enabled: boolean = true) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const flyingSoundRef = useRef<AudioNodes | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const isInitializedRef = useRef(false);

  // Initialize AudioContext with auto-resume and retry
  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.gain.value = 0.75;
      masterGainRef.current.connect(audioContextRef.current.destination);
      isInitializedRef.current = true;
    }
    
    // Force resume with retry
    if (audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch (e) {
        setTimeout(() => {
          audioContextRef.current?.resume().catch(() => {});
        }, 100);
      }
    }
    
    return audioContextRef.current;
  }, []);

  // Auto-resume on any user interaction
  useEffect(() => {
    const handleInteraction = () => {
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume().catch(console.error);
      }
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    document.addEventListener('keydown', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  // Create smooth sound with envelope
  const createSmoothSound = useCallback(async (
    frequencies: number[],
    types: OscillatorType[],
    duration: number,
    gains: number[],
    filterFreq?: number,
    attack: number = 0.02,
    release: number = 0.1
  ) => {
    if (!enabled) return;
    
    const ctx = await initAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
      if (ctx.state === 'suspended') return;
    }
    
    const now = ctx.currentTime;
    const master = masterGainRef.current || ctx.destination;

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = types[i] || 'sine';
      osc.frequency.setValueAtTime(freq, now);
      
      // Smooth envelope
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(gains[i] || 0.1, now + attack);
      gain.gain.setValueAtTime(gains[i] || 0.1, now + duration - release);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      if (filterFreq) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = filterFreq;
        filter.Q.value = 1;
        osc.connect(filter);
        filter.connect(gain);
      } else {
        osc.connect(gain);
      }
      
      gain.connect(master);
      osc.start(now);
      osc.stop(now + duration);
    });
  }, [enabled, initAudioContext]);

  // Pad sound with reverb-like effect
  const createPadSound = useCallback(async (
    baseFreq: number,
    duration: number,
    gain: number = 0.12
  ) => {
    if (!enabled) return;
    
    const ctx = await initAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
      if (ctx.state === 'suspended') return;
    }
    
    const now = ctx.currentTime;
    const master = masterGainRef.current || ctx.destination;

    const detunes = [-10, -4, 0, 4, 10];
    
    detunes.forEach(detune => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.type = 'sine';
      osc.frequency.value = baseFreq;
      osc.detune.value = detune;
      
      filter.type = 'lowpass';
      filter.frequency.value = 2500;
      filter.Q.value = 0.4;
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(gain / detunes.length, now + 0.08);
      gainNode.gain.setValueAtTime(gain / detunes.length, now + duration - 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
      
      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(master);
      
      osc.start(now);
      osc.stop(now + duration);
    });
  }, [enabled, initAudioContext]);

  // Modern click sound
  const playClick = useCallback(async (pitch: number = 1, volume: number = 0.15) => {
    if (!enabled) return;
    
    const ctx = await initAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
      if (ctx.state === 'suspended') return;
    }
    
    const now = ctx.currentTime;
    const master = masterGainRef.current || ctx.destination;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'triangle';
    osc.frequency.value = 2200 * pitch;
    
    filter.type = 'bandpass';
    filter.frequency.value = 1800 * pitch;
    filter.Q.value = 2;
    
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    
    osc.start(now);
    osc.stop(now + 0.06);
  }, [enabled, initAudioContext]);

  // Chime/bell sound
  const playChime = useCallback(async (frequency: number, duration: number = 0.4, volume: number = 0.22) => {
    if (!enabled) return;
    
    const ctx = await initAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
      if (ctx.state === 'suspended') return;
    }
    
    const now = ctx.currentTime;
    const master = masterGainRef.current || ctx.destination;

    // Fundamental
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = frequency;
    gain1.gain.setValueAtTime(volume, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc1.connect(gain1);
    gain1.connect(master);
    osc1.start(now);
    osc1.stop(now + duration);

    // Harmonic
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = frequency * 2.4;
    gain2.gain.setValueAtTime(volume * 0.25, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.5);
    osc2.connect(gain2);
    gain2.connect(master);
    osc2.start(now);
    osc2.stop(now + duration * 0.5);

    // High shimmer
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.value = frequency * 3.8;
    gain3.gain.setValueAtTime(volume * 0.08, now);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.25);
    osc3.connect(gain3);
    gain3.connect(master);
    osc3.start(now);
    osc3.stop(now + duration * 0.25);
  }, [enabled, initAudioContext]);

  // Countdown beep (3, 2, 1)
  const playCountdownBeep = useCallback(async (count: number) => {
    if (!enabled) return;
    
    const ctx = await initAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
      if (ctx.state === 'suspended') return;
    }
    
    const now = ctx.currentTime;
    const master = masterGainRef.current || ctx.destination;
    
    // Higher pitch for lower count (builds tension)
    const baseFreq = count === 1 ? 880 : count === 2 ? 660 : 523;
    const duration = count === 1 ? 0.4 : 0.25;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain.gain.setValueAtTime(0.2, now + duration - 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    osc.connect(gain);
    gain.connect(master);
    
    osc.start(now);
    osc.stop(now + duration);
    
    // Double beep for final count
    if (count === 1) {
      setTimeout(() => playChime(baseFreq * 1.5, 0.3, 0.15), 150);
    }
  }, [enabled, initAudioContext, playChime]);

  // Milestone sound (2x, 3x, 5x, 10x)
  const playMilestoneSound = useCallback(async (multiplier: number) => {
    if (!enabled) return;
    
    const ctx = await initAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
      if (ctx.state === 'suspended') return;
    }
    
    const now = ctx.currentTime;
    const master = masterGainRef.current || ctx.destination;
    
    // More dramatic for higher milestones
    const baseFreq = multiplier >= 10 ? 880 : multiplier >= 5 ? 740 : multiplier >= 3 ? 660 : 587;
    const volume = Math.min(0.15 + multiplier * 0.01, 0.25);
    
    // Quick ascending notes
    [0, 100].forEach((delay, i) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = baseFreq * (1 + i * 0.25);
        
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        
        osc.connect(gain);
        gain.connect(master);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
      }, delay);
    });
  }, [enabled, initAudioContext]);

  // Main sound player
  const playSound = useCallback(async (type: SoundType) => {
    if (!enabled) return;
    
    // Ensure context is ready with force resume
    const ctx = await initAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    switch (type) {
      case 'launch':
        // Cinematic whoosh with rising pitch
        createSmoothSound(
          [90, 140, 220],
          ['sawtooth', 'triangle', 'sine'],
          1.0,
          [0.1, 0.07, 0.04],
          900,
          0.04,
          0.25
        );
        
        // Rising engine sound - use already awaited ctx
        if (!audioContextRef.current || audioContextRef.current.state === 'suspended') return;
        const launchCtx = audioContextRef.current;
        const now = launchCtx.currentTime;
        const master = masterGainRef.current || launchCtx.destination;
        
        const riseOsc = launchCtx.createOscillator();
        const riseGain = launchCtx.createGain();
        const riseFilter = launchCtx.createBiquadFilter();
        
        riseOsc.type = 'sawtooth';
        riseOsc.frequency.setValueAtTime(120, now);
        riseOsc.frequency.exponentialRampToValueAtTime(350, now + 0.8);
        
        riseFilter.type = 'lowpass';
        riseFilter.frequency.setValueAtTime(250, now);
        riseFilter.frequency.exponentialRampToValueAtTime(1400, now + 0.6);
        
        riseGain.gain.setValueAtTime(0, now);
        riseGain.gain.linearRampToValueAtTime(0.12, now + 0.08);
        riseGain.gain.linearRampToValueAtTime(0.08, now + 0.6);
        riseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
        
        riseOsc.connect(riseFilter);
        riseFilter.connect(riseGain);
        riseGain.connect(master!);
        
        riseOsc.start(now);
        riseOsc.stop(now + 1.0);
        break;

      case 'cashout':
        // Satisfying cash register sound
        playChime(587.33, 0.25, 0.22); // D5
        setTimeout(() => playChime(739.99, 0.25, 0.22), 70); // F#5
        setTimeout(() => playChime(880.00, 0.4, 0.25), 140); // A5
        setTimeout(() => playChime(1174.66, 0.5, 0.18), 220); // D6
        break;

      case 'crash':
        // Deep impact sound
        createSmoothSound(
          [65, 45, 30],
          ['sawtooth', 'triangle', 'sine'],
          0.6,
          [0.22, 0.18, 0.14],
          350,
          0.01,
          0.35
        );
        
        // Noise burst for explosion effect - use already awaited ctx
        if (!audioContextRef.current || audioContextRef.current.state === 'suspended') return;
        const crashCtx = audioContextRef.current;
        const crashNow = crashCtx.currentTime;
        const crashMaster = masterGainRef.current || crashCtx.destination;
        
        const bufferSize = crashCtx.sampleRate * 0.4;
        const buffer = crashCtx.createBuffer(1, bufferSize, crashCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
        }
        
        const noiseSource = crashCtx.createBufferSource();
        noiseSource.buffer = buffer;
        const noiseGain = crashCtx.createGain();
        const noiseFilter = crashCtx.createBiquadFilter();
        
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(600, crashNow);
        noiseFilter.frequency.exponentialRampToValueAtTime(80, crashNow + 0.4);
        
        noiseGain.gain.setValueAtTime(0.25, crashNow);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, crashNow + 0.4);
        
        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(crashMaster!);
        noiseSource.start(crashNow);
        break;

      case 'tick':
        playClick(1.1, 0.1);
        break;

      case 'countdown':
        playCountdownBeep(3);
        break;

      case 'milestone':
        playMilestoneSound(2);
        break;

      case 'win':
        // Celebratory melody
        const winNotes = [
          { freq: 523.25, delay: 0 },    // C5
          { freq: 659.25, delay: 80 },   // E5
          { freq: 783.99, delay: 160 },  // G5
          { freq: 1046.50, delay: 280 }, // C6
        ];
        winNotes.forEach(note => {
          setTimeout(() => playChime(note.freq, 0.45, 0.22), note.delay);
        });
        
        // Victory pad
        setTimeout(() => createPadSound(1046.50, 0.8, 0.08), 350);
        break;

      case 'bet':
        playClick(0.9, 0.08);
        setTimeout(() => playChime(880, 0.12, 0.1), 25);
        break;
    }
  }, [enabled, createSmoothSound, createPadSound, playClick, playChime, playCountdownBeep, playMilestoneSound, initAudioContext]);

  // Start continuous flying sound
  const startFlyingSound = useCallback(async () => {
    if (!enabled || flyingSoundRef.current?.oscillator) return;
    
    const ctx = await initAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
      if (ctx.state === 'suspended') return;
    }
    
    const now = ctx.currentTime;
    const master = masterGainRef.current || ctx.destination;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, now);
    
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    filter.Q.value = 1.5;
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.25);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master!);
    
    osc.start(now);
    
    flyingSoundRef.current = { oscillator: osc, gain, filter };
  }, [enabled, initAudioContext]);

  // Update flying sound based on multiplier
  const updateFlyingSound = useCallback((multiplier: number) => {
    if (!flyingSoundRef.current?.oscillator || !audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') return;
    
    const now = ctx.currentTime;
    
    // More dynamic response to multiplier
    const freq = 90 + Math.min(multiplier * 18, 220);
    const filterFreq = 700 + Math.min(multiplier * 120, 1800);
    const gain = 0.05 + Math.min(multiplier * 0.01, 0.1);
    
    flyingSoundRef.current.oscillator.frequency.setTargetAtTime(freq, now, 0.08);
    if (flyingSoundRef.current.filter) {
      flyingSoundRef.current.filter.frequency.setTargetAtTime(filterFreq, now, 0.08);
    }
    if (flyingSoundRef.current.gain) {
      flyingSoundRef.current.gain.gain.setTargetAtTime(gain, now, 0.08);
    }
  }, []);

  // Stop flying sound
  const stopFlyingSound = useCallback(() => {
    if (flyingSoundRef.current?.oscillator && audioContextRef.current) {
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;
      
      if (flyingSoundRef.current.gain) {
        flyingSoundRef.current.gain.gain.setTargetAtTime(0, now, 0.08);
      }
      
      setTimeout(() => {
        try {
          flyingSoundRef.current?.oscillator?.stop();
        } catch (e) {
          // Already stopped
        }
        flyingSoundRef.current = null;
      }, 150);
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
    initAudioContext,
    playCountdownBeep,
    playMilestoneSound
  };
};

export default useGameSounds;