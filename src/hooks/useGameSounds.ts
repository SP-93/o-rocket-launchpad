import { useCallback, useRef, useEffect } from 'react';

type SoundType = 'launch' | 'flying' | 'cashout' | 'crash' | 'tick' | 'win' | 'bet';

interface AudioNodes {
  oscillator?: OscillatorNode;
  gain?: GainNode;
  filter?: BiquadFilterNode;
}

const useGameSounds = (enabled: boolean = true) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const flyingSoundRef = useRef<AudioNodes | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  // Initialize AudioContext
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.gain.value = 0.5;
      masterGainRef.current.connect(audioContextRef.current.destination);
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Create a smoother sound with multiple oscillators and filters
  const createSmoothSound = useCallback((
    frequencies: number[],
    types: OscillatorType[],
    duration: number,
    gains: number[],
    filterFreq?: number,
    attack: number = 0.02,
    release: number = 0.1
  ) => {
    if (!enabled) return;
    
    const ctx = initAudioContext();
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

  // Create reverb-like effect
  const createPadSound = useCallback((
    baseFreq: number,
    duration: number,
    gain: number = 0.15
  ) => {
    if (!enabled) return;
    
    const ctx = initAudioContext();
    const now = ctx.currentTime;
    const master = masterGainRef.current || ctx.destination;

    // Create multiple detuned oscillators for pad effect
    const detunes = [-12, -5, 0, 5, 12];
    
    detunes.forEach(detune => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.type = 'sine';
      osc.frequency.value = baseFreq;
      osc.detune.value = detune;
      
      filter.type = 'lowpass';
      filter.frequency.value = 2000;
      filter.Q.value = 0.5;
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(gain / detunes.length, now + 0.1);
      gainNode.gain.setValueAtTime(gain / detunes.length, now + duration - 0.2);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
      
      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(master);
      
      osc.start(now);
      osc.stop(now + duration);
    });
  }, [enabled, initAudioContext]);

  // Modern metallic click
  const playClick = useCallback((pitch: number = 1) => {
    if (!enabled) return;
    
    const ctx = initAudioContext();
    const now = ctx.currentTime;
    const master = masterGainRef.current || ctx.destination;

    // High-frequency click
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'triangle';
    osc.frequency.value = 2400 * pitch;
    
    filter.type = 'highpass';
    filter.frequency.value = 1200;
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    
    osc.start(now);
    osc.stop(now + 0.05);
  }, [enabled, initAudioContext]);

  // Soft bell/chime sound
  const playChime = useCallback((frequency: number, duration: number = 0.4, volume: number = 0.2) => {
    if (!enabled) return;
    
    const ctx = initAudioContext();
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
    osc2.frequency.value = frequency * 2.5;
    gain2.gain.setValueAtTime(volume * 0.3, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.6);
    osc2.connect(gain2);
    gain2.connect(master);
    osc2.start(now);
    osc2.stop(now + duration * 0.6);

    // Shimmer
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.value = frequency * 4;
    gain3.gain.setValueAtTime(volume * 0.1, now);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.3);
    osc3.connect(gain3);
    gain3.connect(master);
    osc3.start(now);
    osc3.stop(now + duration * 0.3);
  }, [enabled, initAudioContext]);

  // Sound definitions
  const playSound = useCallback((type: SoundType) => {
    if (!enabled) return;

    switch (type) {
      case 'launch':
        // Cinematic whoosh with rising pitch
        createSmoothSound(
          [80, 120, 200],
          ['sawtooth', 'triangle', 'sine'],
          1.2,
          [0.12, 0.08, 0.05],
          800,
          0.05,
          0.3
        );
        
        // Rising tone
        const ctx = initAudioContext();
        const now = ctx.currentTime;
        const master = masterGainRef.current || ctx.destination;
        
        const riseOsc = ctx.createOscillator();
        const riseGain = ctx.createGain();
        const riseFilter = ctx.createBiquadFilter();
        
        riseOsc.type = 'sawtooth';
        riseOsc.frequency.setValueAtTime(100, now);
        riseOsc.frequency.exponentialRampToValueAtTime(400, now + 1);
        
        riseFilter.type = 'lowpass';
        riseFilter.frequency.setValueAtTime(200, now);
        riseFilter.frequency.exponentialRampToValueAtTime(1200, now + 0.8);
        
        riseGain.gain.setValueAtTime(0, now);
        riseGain.gain.linearRampToValueAtTime(0.15, now + 0.1);
        riseGain.gain.linearRampToValueAtTime(0.1, now + 0.8);
        riseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        
        riseOsc.connect(riseFilter);
        riseFilter.connect(riseGain);
        riseGain.connect(master!);
        
        riseOsc.start(now);
        riseOsc.stop(now + 1.2);
        break;

      case 'cashout':
        // Pleasing ascending chimes
        playChime(523.25, 0.3, 0.25); // C5
        setTimeout(() => playChime(659.25, 0.3, 0.25), 80); // E5
        setTimeout(() => playChime(783.99, 0.5, 0.3), 160); // G5
        setTimeout(() => playChime(1046.50, 0.6, 0.2), 280); // C6
        break;

      case 'crash':
        // Deep impact with rumble
        createSmoothSound(
          [60, 40, 25],
          ['sawtooth', 'triangle', 'sine'],
          0.8,
          [0.25, 0.2, 0.15],
          400,
          0.01,
          0.4
        );
        
        // Noise burst
        const crashCtx = initAudioContext();
        const crashNow = crashCtx.currentTime;
        const crashMaster = masterGainRef.current || crashCtx.destination;
        
        const bufferSize = crashCtx.sampleRate * 0.5;
        const buffer = crashCtx.createBuffer(1, bufferSize, crashCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }
        
        const noiseSource = crashCtx.createBufferSource();
        noiseSource.buffer = buffer;
        const noiseGain = crashCtx.createGain();
        const noiseFilter = crashCtx.createBiquadFilter();
        
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(800, crashNow);
        noiseFilter.frequency.exponentialRampToValueAtTime(100, crashNow + 0.5);
        
        noiseGain.gain.setValueAtTime(0.3, crashNow);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, crashNow + 0.5);
        
        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(crashMaster!);
        noiseSource.start(crashNow);
        break;

      case 'tick':
        // Soft digital tick
        playClick(1.2);
        break;

      case 'win':
        // Celebratory ascending melody
        const winNotes = [
          { freq: 523.25, delay: 0 },    // C5
          { freq: 587.33, delay: 100 },  // D5
          { freq: 659.25, delay: 200 },  // E5
          { freq: 783.99, delay: 300 },  // G5
          { freq: 1046.50, delay: 450 }, // C6
        ];
        winNotes.forEach(note => {
          setTimeout(() => playChime(note.freq, 0.5, 0.25), note.delay);
        });
        
        // Sparkle pad
        setTimeout(() => createPadSound(1046.50, 1, 0.1), 500);
        break;

      case 'bet':
        // Satisfying confirmation
        playClick(1);
        setTimeout(() => playChime(880, 0.15, 0.12), 30);
        break;
    }
  }, [enabled, createSmoothSound, createPadSound, playClick, playChime, initAudioContext]);

  // Start continuous flying sound - smooth engine hum
  const startFlyingSound = useCallback(() => {
    if (!enabled || flyingSoundRef.current?.oscillator) return;
    
    const ctx = initAudioContext();
    const now = ctx.currentTime;
    const master = masterGainRef.current || ctx.destination;

    // Base engine tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(85, now);
    
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    filter.Q.value = 2;
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.3);
    
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
    const now = ctx.currentTime;
    
    // Increase frequency and intensity with multiplier
    const freq = 85 + Math.min(multiplier * 15, 200);
    const filterFreq = 600 + Math.min(multiplier * 100, 1500);
    const gain = 0.06 + Math.min(multiplier * 0.008, 0.08);
    
    flyingSoundRef.current.oscillator.frequency.setTargetAtTime(freq, now, 0.1);
    if (flyingSoundRef.current.filter) {
      flyingSoundRef.current.filter.frequency.setTargetAtTime(filterFreq, now, 0.1);
    }
    if (flyingSoundRef.current.gain) {
      flyingSoundRef.current.gain.gain.setTargetAtTime(gain, now, 0.1);
    }
  }, []);

  // Stop flying sound
  const stopFlyingSound = useCallback(() => {
    if (flyingSoundRef.current?.oscillator && audioContextRef.current) {
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;
      
      if (flyingSoundRef.current.gain) {
        flyingSoundRef.current.gain.gain.setTargetAtTime(0, now, 0.1);
      }
      
      setTimeout(() => {
        try {
          flyingSoundRef.current?.oscillator?.stop();
        } catch (e) {
          // Already stopped
        }
        flyingSoundRef.current = null;
      }, 200);
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
