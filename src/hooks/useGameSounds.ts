import { useCallback, useRef, useEffect } from 'react';

type SoundType = 'launch' | 'flying' | 'cashout' | 'crash' | 'tick' | 'win' | 'bet' | 'countdown' | 'milestone';

// Mixkit CDN URLs for free sound effects
const SOUND_URLS: Record<string, string> = {
  launch: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',      // Rocket whoosh
  crash: 'https://assets.mixkit.co/active_storage/sfx/2810/2810-preview.mp3',       // Big explosion
  cashout: 'https://assets.mixkit.co/active_storage/sfx/888/888-preview.mp3',       // Cash register
  win: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3',         // Victory fanfare
  countdown: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',   // Beep
  milestone: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',   // Achievement ding
  tick: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',        // Tick sound
  bet: 'https://assets.mixkit.co/active_storage/sfx/146/146-preview.mp3',           // Coin drop
};

interface BackgroundMusicNodes {
  oscillators: OscillatorNode[];
  gains: GainNode[];
  masterGain: GainNode;
}

const useGameSounds = (enabled: boolean = true) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const backgroundMusicRef = useRef<BackgroundMusicNodes | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const isInitializedRef = useRef(false);
  const musicVolumeRef = useRef<number>(0.25);
  const soundCacheRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const flyingAudioRef = useRef<HTMLAudioElement | null>(null);
  const preloadedRef = useRef(false);

  const MASTER_VOLUME = 0.8;

  // Preload all sounds on mount
  useEffect(() => {
    if (preloadedRef.current) return;
    preloadedRef.current = true;

    Object.entries(SOUND_URLS).forEach(([key, url]) => {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = url;
      audio.volume = MASTER_VOLUME;
      // Preload by loading metadata
      audio.load();
      soundCacheRef.current.set(key, audio);
    });

    console.log('[SoundSystem] Preloaded', Object.keys(SOUND_URLS).length, 'MP3 sounds');
  }, []);

  // Initialize AudioContext for background music only
  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.gain.value = 1.0;
      masterGainRef.current.connect(audioContextRef.current.destination);
      isInitializedRef.current = true;
    }
    
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume().catch(() => {});
    }
    
    return audioContextRef.current;
  }, []);

  // Auto-resume on user interaction
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

  // Play MP3 sound from cache
  const playMP3 = useCallback((soundKey: string, volume: number = MASTER_VOLUME) => {
    if (!enabled) return;
    
    const cachedAudio = soundCacheRef.current.get(soundKey);
    if (cachedAudio) {
      // Clone the audio to allow overlapping sounds
      const audio = cachedAudio.cloneNode() as HTMLAudioElement;
      audio.volume = Math.min(volume, 1.0);
      audio.currentTime = 0;
      audio.play().catch(err => {
        console.warn('[SoundSystem] Failed to play', soundKey, err.message);
      });
      return audio;
    }
    return null;
  }, [enabled]);

  // Countdown beep with pitch variation
  const playCountdownBeep = useCallback(async (count: number) => {
    if (!enabled) return;
    
    // Use different volumes for countdown drama
    const volume = count === 1 ? 1.0 : count <= 3 ? 0.9 : 0.8;
    playMP3('countdown', volume * MASTER_VOLUME);
  }, [enabled, playMP3]);

  // Milestone sound
  const playMilestoneSound = useCallback(async (multiplier: number) => {
    if (!enabled) return;
    
    const volume = Math.min(0.7 + multiplier * 0.03, 1.0);
    playMP3('milestone', volume * MASTER_VOLUME);
  }, [enabled, playMP3]);

  // Main sound player
  const playSound = useCallback(async (type: SoundType) => {
    if (!enabled) return;

    switch (type) {
      case 'launch':
        playMP3('launch', 1.0);
        break;

      case 'cashout':
        playMP3('cashout', 0.9);
        break;

      case 'crash':
        playMP3('crash', 1.0);
        break;

      case 'win':
        playMP3('win', 0.95);
        break;

      case 'tick':
        playMP3('tick', 0.5);
        break;

      case 'bet':
        playMP3('bet', 0.7);
        break;

      case 'countdown':
        playMP3('countdown', 0.85);
        break;

      case 'milestone':
        playMP3('milestone', 0.8);
        break;

      case 'flying':
        // Flying is handled by startFlyingSound
        break;
    }
  }, [enabled, playMP3]);

  // Flying sound - use looping ambient engine sound
  const startFlyingSound = useCallback(async () => {
    if (!enabled) return;

    // Use a looping ambient sound for flying
    if (flyingAudioRef.current) {
      flyingAudioRef.current.pause();
    }

    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/212/212-preview.mp3');
    audio.loop = true;
    audio.volume = 0.4;
    audio.play().catch(err => {
      console.warn('[SoundSystem] Failed to start flying sound', err.message);
    });
    flyingAudioRef.current = audio;
  }, [enabled]);

  const updateFlyingSound = useCallback((multiplier: number) => {
    if (!enabled || !flyingAudioRef.current) return;
    
    // Increase volume and playback rate as multiplier grows
    const baseVolume = 0.4;
    const volumeBoost = Math.min(multiplier * 0.05, 0.4);
    flyingAudioRef.current.volume = Math.min(baseVolume + volumeBoost, 0.8);
    
    // Slightly increase playback rate for tension
    flyingAudioRef.current.playbackRate = Math.min(1.0 + (multiplier - 1) * 0.02, 1.3);
  }, [enabled]);

  const stopFlyingSound = useCallback(() => {
    if (flyingAudioRef.current) {
      flyingAudioRef.current.pause();
      flyingAudioRef.current.currentTime = 0;
      flyingAudioRef.current = null;
    }
  }, []);

  // Background music using Web Audio (ambient synth pads)
  const startBackgroundMusic = useCallback(async () => {
    if (!enabled || backgroundMusicRef.current) return;
    
    const ctx = await initAudioContext();
    if (ctx.state === 'suspended') return;

    const masterGain = ctx.createGain();
    masterGain.gain.value = musicVolumeRef.current;
    masterGain.connect(masterGainRef.current || ctx.destination);

    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    
    // Deep ambient pad chord
    const notes = [110, 165, 220, 330]; // A2, E3, A3, E4
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.type = i < 2 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * 10;
      
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      filter.Q.value = 0.5;
      
      gain.gain.value = (0.08 - i * 0.015);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      
      osc.start();
      oscillators.push(osc);
      gains.push(gain);
    });
    
    backgroundMusicRef.current = { oscillators, gains, masterGain };
  }, [enabled, initAudioContext]);

  const stopBackgroundMusic = useCallback(() => {
    if (backgroundMusicRef.current) {
      const { oscillators, masterGain } = backgroundMusicRef.current;
      const now = audioContextRef.current?.currentTime || 0;
      
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + 2);
      
      setTimeout(() => {
        oscillators.forEach(osc => {
          try { osc.stop(); } catch {}
        });
        backgroundMusicRef.current = null;
      }, 2100);
    }
  }, []);

  const setMusicVolume = useCallback((volume: number) => {
    musicVolumeRef.current = volume;
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.masterGain.gain.value = volume;
    }
  }, []);

  const isMusicPlaying = useCallback(() => {
    return backgroundMusicRef.current !== null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopFlyingSound();
      stopBackgroundMusic();
      soundCacheRef.current.forEach(audio => {
        audio.pause();
        audio.src = '';
      });
      soundCacheRef.current.clear();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [stopFlyingSound, stopBackgroundMusic]);

  return {
    playSound,
    initAudioContext,
    playCountdownBeep,
    playMilestoneSound,
    startFlyingSound,
    updateFlyingSound,
    stopFlyingSound,
    startBackgroundMusic,
    stopBackgroundMusic,
    setMusicVolume,
    isMusicPlaying
  };
};

export default useGameSounds;
