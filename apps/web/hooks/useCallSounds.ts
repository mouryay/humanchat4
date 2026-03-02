/**
 * useCallSounds hook
 * Manages audio playback for call notifications and events
 */

import { useRef, useCallback, useEffect } from 'react';

export type SoundType = 
  | 'outgoing-ring'    // Caller hears while waiting for receiver
  | 'incoming-ring'    // Receiver hears for incoming call
  | 'call-end'         // Both hear when call ends
  | 'mute'             // Confirmation beep for mute
  | 'unmute';          // Confirmation beep for unmute

interface CallSound {
  path: string;
  loop: boolean;
  volume: number;
}

// Sound configuration
const SOUNDS: Record<SoundType, CallSound> = {
  'outgoing-ring': {
    path: '/sounds/outgoing-ring.mp3',
    loop: true,
    volume: 0.5,
  },
  'incoming-ring': {
    path: '/sounds/incoming-ring.mp3',
    loop: true,
    volume: 0.7,
  },
  'call-end': {
    path: '/sounds/call-end.mp3',
    loop: false,
    volume: 0.6,
  },
  'mute': {
    path: '/sounds/call-end.mp3', // Using call-end for mute (same sound)
    loop: false,
    volume: 0.4,
  },
  'unmute': {
    path: '/sounds/call-end.mp3', // Using call-end for unmute (same sound)
    loop: false,
    volume: 0.4,
  },
};

export function useCallSounds() {
  // Store audio instances for each sound type
  const audioRefs = useRef<Map<SoundType, HTMLAudioElement>>(new Map());
  // Track which sounds loaded successfully
  const loadedSounds = useRef<Set<SoundType>>(new Set());
  // Track if user has interacted (for autoplay policy)
  const hasUserInteracted = useRef<boolean>(false);

  /**
   * Enable sounds after user interaction (fixes autoplay policy)
   */
  useEffect(() => {
    const handleInteraction = () => {
      if (!hasUserInteracted.current) {
        hasUserInteracted.current = true;
        console.log('[useCallSounds] ✅ User interaction detected, sounds enabled');
        
        // Prime all audio elements by loading them
        audioRefs.current.forEach((audio, type) => {
          audio.load();
        });
      }
    };

    // Listen for ANY user interaction
    document.addEventListener('click', handleInteraction, { once: true });
    document.addEventListener('keydown', handleInteraction, { once: true });
    document.addEventListener('touchstart', handleInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  /**
   * Initialize audio elements
   */
  useEffect(() => {
    // Preload all sounds
    Object.entries(SOUNDS).forEach(([type, config]) => {
      const audio = new Audio(config.path);
      audio.loop = config.loop;
      audio.volume = config.volume;
      audio.preload = 'auto';
      
      // Explicitly set loop attribute for looping sounds
      if (config.loop) {
        audio.setAttribute('loop', 'true');
      }
      
      // Track successful load
      audio.addEventListener('canplaythrough', () => {
        loadedSounds.current.add(type as SoundType);
        console.log(`[useCallSounds] Loaded: ${type} (loop: ${config.loop})`);
      });
      
      // Handle load errors gracefully (but ignore aborted loads from HMR)
      audio.addEventListener('error', (e) => {
        const errorCode = audio.error?.code;
        
        // Ignore errors from Hot Module Replacement during development:
        // Code 1 = MEDIA_ERR_ABORTED (reload during HMR)
        // Code 4 = MEDIA_ERR_SRC_NOT_SUPPORTED (empty src during HMR cleanup)
        if (errorCode === 1 || errorCode === 4) {
          return; // Silent ignore - normal during development Fast Refresh
        }
        
        console.warn(`[useCallSounds] Failed to load ${type}:`, errorCode, audio.error?.message);
      });
      
      audioRefs.current.set(type as SoundType, audio);
    });

    // Cleanup on unmount
    return () => {
      audioRefs.current.forEach((audio) => {
        audio.pause();
        audio.src = '';
      });
      audioRefs.current.clear();
      loadedSounds.current.clear();
    };
  }, []);

  /**
   * Play a sound
   */
  const play = useCallback(async (type: SoundType) => {
    console.log(`[useCallSounds] 🔊 Attempting to play: ${type}`);
    
    const audio = audioRefs.current.get(type);
    if (!audio) {
      console.warn(`[useCallSounds] ❌ Sound not found: ${type}`);
      return;
    }

    console.log(`[useCallSounds] Audio element found, readyState: ${audio.readyState}, loop: ${audio.loop}, paused: ${audio.paused}`);

    try {
      // Reset to start if already playing
      if (!audio.paused) {
        console.log(`[useCallSounds] 🔄 Restarting already playing sound: ${type}`);
      }
      audio.currentTime = 0;
      
      // Force reload if not ready
      if (audio.readyState < 2) {
        console.log(`[useCallSounds] ⏳ Sound not ready, loading: ${type}`);
        audio.load();
        // Wait a bit for it to load
        await new Promise(resolve => {
          audio.addEventListener('canplay', resolve, { once: true });
          setTimeout(resolve, 500); // Timeout fallback
        });
      }
      
      const playPromise = audio.play();
      await playPromise;
      
      console.log(`[useCallSounds] ✅ Successfully playing: ${type}, duration: ${audio.duration}s, loop: ${audio.loop}`);
    } catch (error: any) {
      // Check if it's an autoplay policy error
      if (error.name === 'NotAllowedError') {
        console.warn(`[useCallSounds] ⚠️ Autoplay blocked for ${type}. This is normal - click "Enable Call Sounds" banner or anywhere on the page.`);
      } else {
        // Log other errors as actual errors
        console.error(`[useCallSounds] ❌ Failed to play ${type}:`, error.name, error.message);
        console.error(`[useCallSounds] Audio state:`, {
          src: audio.src,
          readyState: audio.readyState,
          networkState: audio.networkState,
          error: audio.error
        });
      }
    }
  }, []);

  /**
   * Stop a sound
   */
  const stop = useCallback((type: SoundType) => {
    const audio = audioRefs.current.get(type);
    if (!audio) return;

    if (!audio.paused) {
      audio.pause();
      audio.currentTime = 0;
      console.log(`[useCallSounds] 🛑 Stopped: ${type}`);
    }
  }, []);

  /**
   * Stop all sounds
   */
  const stopAll = useCallback(() => {
    audioRefs.current.forEach((audio, type) => {
      audio.pause();
      audio.currentTime = 0;
    });
    console.log('[useCallSounds] Stopped all sounds');
  }, []);

  /**
   * Set volume for a specific sound
   */
  const setVolume = useCallback((type: SoundType, volume: number) => {
    const audio = audioRefs.current.get(type);
    if (!audio) return;

    audio.volume = Math.max(0, Math.min(1, volume));
  }, []);

  return {
    play,
    stop,
    stopAll,
    setVolume,
  };
}
