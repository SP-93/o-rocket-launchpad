import { useCallback, useRef, useEffect } from 'react';

type SoundType = 'launch' | 'flying' | 'cashout' | 'crash' | 'tick' | 'win' | 'bet' | 'countdown' | 'milestone';

interface AudioNodes {
  oscillator?: OscillatorNode;
  gain?: GainNode;
  filter?: BiquadFilterNode;
}

interface BackgroundMusicNodes {
  oscillators: OscillatorNode[];
  gains: GainNode[];
  masterGain: GainNode;
}

const useGameSounds = (enabled: boolean = true) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const flyingSoundRef = useRef<AudioNodes | null>(null);
  const backgroundMusicRef = useRef<BackgroundMusicNodes | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const isInitializedRef = useRef(false);
  const musicVolumeRef = useRef<number>(0.25);

  // MASTER VOLUME - Increased significantly for louder output
  const MASTER_VOLUME = 1.0;
  const SOUND_MULTIPLIER = 4.0; // Global sound amplification

  // Initialize AudioContext with aggressive resume
  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.gain.value = MASTER_VOLUME;
      masterGainRef.current.connect(audioContextRef.current.destination);
      isInitializedRef.current = true;
    }
    
    // Aggressive resume with multiple retries
    if (audioContextRef.current.state === 'suspended') {
      for (let i = 0; i < 3; i++) {
        try {
          await audioContextRef.current.resume();
          if (audioContextRef.current.state !== 'suspended') break;
        } catch (e) {
          await new Promise(r => setTimeout(r, 50));
        }
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

  // Create smooth sound with envelope - MUCH LOUDER
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
      
      // AMPLIFIED gains
      const amplifiedGain = (gains[i] || 0.1) * SOUND_MULTIPLIER;
      
      // Smooth envelope
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(amplifiedGain, now + attack);
      gain.gain.setValueAtTime(amplifiedGain, now + duration - release);
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
  }, [enabled, initAudioContext, SOUND_MULTIPLIER]);

  // Pad sound with reverb-like effect - LOUDER
  const createPadSound = useCallback(async (
    baseFreq: number,
    duration: number,
    gain: number = 0.3
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
    const amplifiedGain = gain * SOUND_MULTIPLIER;
    
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
      gainNode.gain.linearRampToValueAtTime(amplifiedGain / detunes.length, now + 0.08);
      gainNode.gain.setValueAtTime(amplifiedGain / detunes.length, now + duration - 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
      
      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(master);
      
      osc.start(now);
      osc.stop(now + duration);
    });
  }, [enabled, initAudioContext, SOUND_MULTIPLIER]);

  // Modern click sound - LOUDER
  const playClick = useCallback(async (pitch: number = 1, volume: number = 0.4) => {
    if (!enabled) return;
    
    const ctx = await initAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
      if (ctx.state === 'suspended') return;
    }
    
    const now = ctx.currentTime;
    const master = masterGainRef.current || ctx.destination;
    const amplifiedVolume = volume * SOUND_MULTIPLIER;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'triangle';
    osc.frequency.value = 2200 * pitch;
    
    filter.type = 'bandpass';
    filter.frequency.value = 1800 * pitch;
    filter.Q.value = 2;
    
    gain.gain.setValueAtTime(amplifiedVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    
    osc.start(now);
    osc.stop(now + 0.08);
  }, [enabled, initAudioContext, SOUND_MULTIPLIER]);

  // Chime/bell sound - MUCH LOUDER
  const playChime = useCallback(async (frequency: number, duration: number = 0.5, volume: number = 0.6) => {
    if (!enabled) return;
    
    const ctx = await initAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
      if (ctx.state === 'suspended') return;
    }
    
    const now = ctx.currentTime;
    const master = masterGainRef.current || ctx.destination;
    const amplifiedVolume = volume * SOUND_MULTIPLIER;

    // Fundamental - LOUDER
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = frequency;
    gain1.gain.setValueAtTime(amplifiedVolume, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc1.connect(gain1);
    gain1.connect(master);
    osc1.start(now);
    osc1.stop(now + duration);

    // Harmonic - adds brightness
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = frequency * 2.4;
    gain2.gain.setValueAtTime(amplifiedVolume * 0.3, now);
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
    gain3.gain.setValueAtTime(amplifiedVolume * 0.15, now);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.25);
    osc3.connect(gain3);
    gain3.connect(master);
    osc3.start(now);
    osc3.stop(now + duration * 0.25);
  }, [enabled, initAudioContext, SOUND_MULTIPLIER]);

  // Countdown beep (5, 4, 3, 2, 1) - MUCH LOUDER
  const playCountdownBeep = useCallback(async (count: number) => {
    if (!enabled) return;
    
    const ctx = await initAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
      if (ctx.state === 'suspended') return;
    }
    
    const now = ctx.currentTime;
    const master = masterGainRef.current || ctx.destination;
    
    // Higher pitch and louder for lower counts (builds tension)
    const baseFreq = count === 1 ? 1047 : count === 2 ? 880 : count === 3 ? 740 : count === 4 ? 659 : 523;
    const duration = count === 1 ? 0.6 : count <= 3 ? 0.4 : 0.25;
    const volume = (count === 1 ? 0.8 : count <= 3 ? 0.65 : 0.5) * SOUND_MULTIPLIER;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.02);
    gain.gain.setValueAtTime(volume, now + duration - 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    osc.connect(gain);
    gain.connect(master);
    
    osc.start(now);
    osc.stop(now + duration);
    
    // Double beep for counts 1-3 - adds urgency
    if (count <= 3) {
      setTimeout(() => playChime(baseFreq * 1.5, 0.3, volume * 0.5), 100);
    }
  }, [enabled, initAudioContext, playChime, SOUND_MULTIPLIER]);

  // Milestone sound (2x, 3x, 5x, 10x) - LOUDER
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
    const volume = Math.min(0.4 + multiplier * 0.03, 0.7) * SOUND_MULTIPLIER;
    
    // Quick ascending notes
    [0, 100, 180].forEach((delay, i) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = baseFreq * (1 + i * 0.25);
        
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        
        osc.connect(gain);
        gain.connect(master);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      }, delay);
    });
  }, [enabled, initAudioContext, SOUND_MULTIPLIER]);

  // Main sound player - ALL SOUNDS SIGNIFICANTLY LOUDER
  const playSound = useCallback(async (type: SoundType) => {
    if (!enabled) return;
    
    // Ensure context is ready with force resume
    const ctx = await initAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    switch (type) {
      case 'launch':
        // POWERFUL rocket launch with massive sub-bass rumble
        createSmoothSound(
          [60, 100, 160, 280],
          ['sawtooth', 'triangle', 'sine', 'sine'],
          1.4,
          [0.5, 0.35, 0.25, 0.15],
          1400,
          0.03,
          0.35
        );
        
        if (!audioContextRef.current || audioContextRef.current.state === 'suspended') return;
        const launchCtx = audioContextRef.current;
        const now = launchCtx.currentTime;
        const master = masterGainRef.current || launchCtx.destination;
        
        // MASSIVE Sub-bass rumble (30-60Hz) - feels in your chest
        const subBass = launchCtx.createOscillator();
        const subGain = launchCtx.createGain();
        subBass.type = 'sine';
        subBass.frequency.setValueAtTime(35, now);
        subBass.frequency.exponentialRampToValueAtTime(80, now + 0.9);
        subGain.gain.setValueAtTime(0, now);
        subGain.gain.linearRampToValueAtTime(0.7 * SOUND_MULTIPLIER, now + 0.1);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        subBass.connect(subGain);
        subGain.connect(master!);
        subBass.start(now);
        subBass.stop(now + 1.2);
        
        // Main rising engine - LOUD
        const riseOsc = launchCtx.createOscillator();
        const riseGain = launchCtx.createGain();
        const riseFilter = launchCtx.createBiquadFilter();
        
        riseOsc.type = 'sawtooth';
        riseOsc.frequency.setValueAtTime(100, now);
        riseOsc.frequency.exponentialRampToValueAtTime(450, now + 1.0);
        
        riseFilter.type = 'lowpass';
        riseFilter.frequency.setValueAtTime(350, now);
        riseFilter.frequency.exponentialRampToValueAtTime(2500, now + 0.8);
        riseFilter.Q.value = 3;
        
        riseGain.gain.setValueAtTime(0, now);
        riseGain.gain.linearRampToValueAtTime(0.5 * SOUND_MULTIPLIER, now + 0.08);
        riseGain.gain.linearRampToValueAtTime(0.35 * SOUND_MULTIPLIER, now + 0.8);
        riseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
        
        riseOsc.connect(riseFilter);
        riseFilter.connect(riseGain);
        riseGain.connect(master!);
        
        riseOsc.start(now);
        riseOsc.stop(now + 1.3);
        
        // Add white noise burst for realism
        const noiseBuffer = launchCtx.createBuffer(1, launchCtx.sampleRate * 0.8, launchCtx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseBuffer.length; i++) {
          noiseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noiseBuffer.length, 0.5);
        }
        const noiseSource = launchCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        const noiseGain = launchCtx.createGain();
        const noiseFilter = launchCtx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 800;
        noiseFilter.Q.value = 0.5;
        noiseGain.gain.setValueAtTime(0.3 * SOUND_MULTIPLIER, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(master!);
        noiseSource.start(now);
        break;

      case 'cashout':
        // LOUD satisfying cash register sound
        playChime(587.33, 0.3, 0.65); // D5
        setTimeout(() => playChime(739.99, 0.3, 0.65), 80); // F#5
        setTimeout(() => playChime(880.00, 0.45, 0.7), 160); // A5
        setTimeout(() => playChime(1174.66, 0.6, 0.6), 260); // D6
        break;

      case 'crash':
        // MASSIVE explosion with earth-shaking sub-bass
        createSmoothSound(
          [40, 55, 80, 120],
          ['sawtooth', 'triangle', 'sine', 'sine'],
          1.0,
          [0.7, 0.6, 0.5, 0.35],
          600,
          0.008,
          0.6
        );
        
        if (!audioContextRef.current || audioContextRef.current.state === 'suspended') return;
        const crashCtx = audioContextRef.current;
        const crashNow = crashCtx.currentTime;
        const crashMaster = masterGainRef.current || crashCtx.destination;
        
        // DEEP sub-bass thud (20-50Hz) - you FEEL this
        const impactBass = crashCtx.createOscillator();
        const impactGain = crashCtx.createGain();
        impactBass.type = 'sine';
        impactBass.frequency.setValueAtTime(55, crashNow);
        impactBass.frequency.exponentialRampToValueAtTime(25, crashNow + 0.5);
        impactGain.gain.setValueAtTime(0.85 * SOUND_MULTIPLIER, crashNow);
        impactGain.gain.exponentialRampToValueAtTime(0.001, crashNow + 0.6);
        impactBass.connect(impactGain);
        impactGain.connect(crashMaster!);
        impactBass.start(crashNow);
        impactBass.stop(crashNow + 0.6);
        
        // Secondary mid rumble
        const midRumble = crashCtx.createOscillator();
        const midGain = crashCtx.createGain();
        midRumble.type = 'triangle';
        midRumble.frequency.setValueAtTime(100, crashNow);
        midRumble.frequency.exponentialRampToValueAtTime(40, crashNow + 0.4);
        midGain.gain.setValueAtTime(0.6 * SOUND_MULTIPLIER, crashNow);
        midGain.gain.exponentialRampToValueAtTime(0.001, crashNow + 0.5);
        midRumble.connect(midGain);
        midGain.connect(crashMaster!);
        midRumble.start(crashNow);
        midRumble.stop(crashNow + 0.5);
        
        // Explosion noise burst - LOUD
        const bufferSize = crashCtx.sampleRate * 0.7;
        const buffer = crashCtx.createBuffer(1, bufferSize, crashCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.0);
        }
        
        const noiseSource2 = crashCtx.createBufferSource();
        noiseSource2.buffer = buffer;
        const noiseGain2 = crashCtx.createGain();
        const noiseFilter2 = crashCtx.createBiquadFilter();
        
        noiseFilter2.type = 'lowpass';
        noiseFilter2.frequency.setValueAtTime(1200, crashNow);
        noiseFilter2.frequency.exponentialRampToValueAtTime(80, crashNow + 0.6);
        noiseFilter2.Q.value = 2;
        
        noiseGain2.gain.setValueAtTime(0.75 * SOUND_MULTIPLIER, crashNow);
        noiseGain2.gain.exponentialRampToValueAtTime(0.001, crashNow + 0.65);
        
        noiseSource2.connect(noiseFilter2);
        noiseFilter2.connect(noiseGain2);
        noiseGain2.connect(crashMaster!);
        noiseSource2.start(crashNow);
        break;

      case 'tick':
        playClick(1.1, 0.3);
        break;

      case 'countdown':
        playCountdownBeep(3);
        break;

      case 'milestone':
        playMilestoneSound(2);
        break;

      case 'win':
        // TRIUMPHANT victory fanfare - LOUD
        const winNotes = [
          { freq: 523.25, delay: 0, vol: 0.65 },    // C5
          { freq: 659.25, delay: 90, vol: 0.65 },   // E5
          { freq: 783.99, delay: 180, vol: 0.7 },   // G5
          { freq: 1046.50, delay: 300, vol: 0.75 }, // C6
        ];
        winNotes.forEach(note => {
          setTimeout(() => playChime(note.freq, 0.55, note.vol), note.delay);
        });
        
        // Victory pad - triumphant
        setTimeout(() => createPadSound(1046.50, 0.9, 0.25), 400);
        break;

      case 'bet':
        playClick(0.9, 0.25);
        setTimeout(() => playChime(880, 0.15, 0.35), 30);
        break;
    }
  }, [enabled, createSmoothSound, createPadSound, playClick, playChime, playCountdownBeep, playMilestoneSound, initAudioContext, SOUND_MULTIPLIER]);

  // Start continuous flying sound - LOUDER
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
    filter.frequency.value = 800;
    filter.Q.value = 1.5;
    
    // Start louder
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15 * SOUND_MULTIPLIER, now + 0.3);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master!);
    
    osc.start(now);
    
    flyingSoundRef.current = { oscillator: osc, gain, filter };
  }, [enabled, initAudioContext, SOUND_MULTIPLIER]);

  // Update flying sound based on multiplier - LOUDER
  const updateFlyingSound = useCallback((multiplier: number) => {
    if (!flyingSoundRef.current?.oscillator || !audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') return;
    
    const now = ctx.currentTime;
    
    // More dynamic response to multiplier - LOUDER
    const freq = 90 + Math.min(multiplier * 22, 280);
    const filterFreq = 800 + Math.min(multiplier * 150, 2200);
    const gain = (0.15 + Math.min(multiplier * 0.025, 0.2)) * SOUND_MULTIPLIER;
    
    flyingSoundRef.current.oscillator.frequency.setTargetAtTime(freq, now, 0.08);
    if (flyingSoundRef.current.filter) {
      flyingSoundRef.current.filter.frequency.setTargetAtTime(filterFreq, now, 0.08);
    }
    if (flyingSoundRef.current.gain) {
      flyingSoundRef.current.gain.gain.setTargetAtTime(gain, now, 0.08);
    }
  }, [SOUND_MULTIPLIER]);

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

  // Start ambient background music - slightly louder
  const startBackgroundMusic = useCallback(async () => {
    if (!enabled || backgroundMusicRef.current) return;
    
    const ctx = await initAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
      if (ctx.state === 'suspended') return;
    }
    
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(musicVolumeRef.current, now + 2);
    masterGain.connect(ctx.destination);
    
    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    
    // Ambient pad layers - C major 7 chord voicings - LOUDER
    const frequencies = [
      { freq: 65.41, type: 'sine' as OscillatorType, gain: 0.12 },    // C2 bass
      { freq: 130.81, type: 'sine' as OscillatorType, gain: 0.09 },   // C3
      { freq: 164.81, type: 'triangle' as OscillatorType, gain: 0.06 }, // E3
      { freq: 196.00, type: 'sine' as OscillatorType, gain: 0.07 },   // G3
      { freq: 246.94, type: 'triangle' as OscillatorType, gain: 0.05 }, // B3
    ];
    
    frequencies.forEach(({ freq, type, gain: vol }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * 8;
      
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      filter.Q.value = 0.5;
      
      gainNode.gain.value = vol;
      
      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(masterGain);
      
      osc.start(now);
      oscillators.push(osc);
      gains.push(gainNode);
    });
    
    // Subtle LFO for movement
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1;
    lfoGain.gain.value = 50;
    lfo.connect(lfoGain);
    
    oscillators.forEach((_, i) => {
      if (gains[i]) {
        const modGain = ctx.createGain();
        modGain.gain.value = 0.01;
        lfoGain.connect(modGain);
      }
    });
    
    lfo.start(now);
    oscillators.push(lfo);
    
    backgroundMusicRef.current = { oscillators, gains, masterGain };
  }, [enabled, initAudioContext]);

  // Stop background music
  const stopBackgroundMusic = useCallback(() => {
    if (backgroundMusicRef.current && audioContextRef.current) {
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;
      
      backgroundMusicRef.current.masterGain.gain.setTargetAtTime(0, now, 0.5);
      
      setTimeout(() => {
        backgroundMusicRef.current?.oscillators.forEach(osc => {
          try { osc.stop(); } catch {}
        });
        backgroundMusicRef.current = null;
      }, 2000);
    }
  }, []);

  // Set music volume (0-1) - LOUDER max
  const setMusicVolume = useCallback((volume: number) => {
    musicVolumeRef.current = Math.max(0, Math.min(1, volume)) * 0.35; // Max 35% volume
    
    if (backgroundMusicRef.current?.masterGain && audioContextRef.current) {
      const ctx = audioContextRef.current;
      backgroundMusicRef.current.masterGain.gain.setTargetAtTime(
        musicVolumeRef.current,
        ctx.currentTime,
        0.1
      );
    }
  }, []);

  // Check if music is playing
  const isMusicPlaying = useCallback(() => {
    return backgroundMusicRef.current !== null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopFlyingSound();
      stopBackgroundMusic();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stopFlyingSound, stopBackgroundMusic]);

  return {
    playSound,
    startFlyingSound,
    updateFlyingSound,
    stopFlyingSound,
    initAudioContext,
    playCountdownBeep,
    playMilestoneSound,
    startBackgroundMusic,
    stopBackgroundMusic,
    setMusicVolume,
    isMusicPlaying
  };
};

export default useGameSounds;
