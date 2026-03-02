/**
 * Prompt to enable call sounds (fixes browser autoplay policy)
 * Shows a banner after first login to prime audio elements
 */

'use client';

import { useEffect, useState } from 'react';
import { useCallSounds } from '../hooks/useCallSounds';

export default function CallSoundPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const { play } = useCallSounds();

  useEffect(() => {
    // Check if user has already enabled sounds
    const soundsEnabled = localStorage.getItem('call-sounds-enabled');
    
    if (!soundsEnabled) {
      // Show prompt after a short delay
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const handleEnable = () => {
    // Play a silent test sound to prime the audio context
    // This enables future sounds to work
    localStorage.setItem('call-sounds-enabled', 'true');
    setShowPrompt(false);
    
    console.log('[CallSoundPrompt] ✅ Sounds enabled by user');
    
    // Try to play and immediately stop a sound to prime the audio
    // This won't be audible but unlocks autoplay
    play('call-end');
    setTimeout(() => {
      const audio = new Audio('/sounds/call-end.mp3');
      audio.volume = 0; // Silent
      audio.play().then(() => {
        audio.pause();
        console.log('[CallSoundPrompt] Audio context primed');
      }).catch(err => {
        console.log('[CallSoundPrompt] Failed to prime audio:', err);
      });
    }, 100);
  };

  const handleDismiss = () => {
    localStorage.setItem('call-sounds-enabled', 'dismissed');
    setShowPrompt(false);
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 bg-blue-600 text-white rounded-lg shadow-lg p-4 flex items-center gap-3">
      <div className="flex-1">
        <div className="font-semibold mb-1">🔔 Enable Call Sounds</div>
        <div className="text-sm opacity-90">
          Get audio notifications for incoming calls
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleDismiss}
          className="px-3 py-1 text-sm bg-blue-700 hover:bg-blue-800 rounded transition-colors"
        >
          Later
        </button>
        <button
          onClick={handleEnable}
          className="px-3 py-1 text-sm bg-white text-blue-600 hover:bg-gray-100 rounded font-semibold transition-colors"
        >
          Enable
        </button>
      </div>
    </div>
  );
}
