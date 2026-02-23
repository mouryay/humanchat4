'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, MicOff, Phone, Maximize2, Video } from 'lucide-react';
import { useCallContext } from '../context/CallContext';

export default function MinimizedCallBar() {
  const router = useRouter();
  const {
    callId,
    callType,
    participantName,
    participantAvatar,
    status,
    isMinimized,
    connectedAt,
    isMuted,
    toggleMute,
    toggleMinimize,
    endCall,
  } = useCallContext();

  const [elapsed, setElapsed] = useState(0);

  // Timer
  useEffect(() => {
    if (!connectedAt || status !== 'connected') return;

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - connectedAt) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [connectedAt, status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleExpand = () => {
    // Just toggle minimize - GlobalCallRoom will show the full UI
    toggleMinimize();
  };

  const handleEndCall = () => {
    endCall();
  };

  // Only show when call is active and minimized
  if (!callId || !isMinimized || status === 'disconnected') {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl border-b border-white/10 shadow-xl">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between py-3">
          {/* Left: Call Info (Clickable to expand) */}
          <button
            onClick={handleExpand}
            className="flex items-center gap-4 hover:opacity-80 transition-opacity group"
          >
            {/* Avatar */}
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center overflow-hidden border-2 border-white/10">
                {participantAvatar ? (
                  <img 
                    src={participantAvatar} 
                    alt={participantName || 'User'} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-semibold text-white/90">
                    {getInitials(participantName || 'User')}
                  </span>
                )}
              </div>
              {/* Pulsing indicator */}
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900 animate-pulse" />
            </div>

            {/* Info */}
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold">{participantName || 'User'}</span>
                {callType === 'video' && (
                  <Video className="w-4 h-4 text-blue-400" />
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <span>In call</span>
                <span>•</span>
                <span className="tabular-nums">{formatTime(elapsed)}</span>
              </div>
            </div>

            {/* Waveform animation (for audio calls) */}
            {callType === 'audio' && status === 'connected' && (
              <div className="flex items-center gap-1 ml-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-0.5 bg-blue-500 rounded-full animate-waveform"
                    style={{
                      height: '16px',
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </button>

          {/* Right: Quick Actions */}
          <div className="flex items-center gap-3">
            {/* Mute/Unmute */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
              className={`w-10 h-10 rounded-full backdrop-blur-xl flex items-center justify-center transition-all ${
                isMuted 
                  ? 'bg-red-500/90 hover:bg-red-600' 
                  : 'bg-white/10 hover:bg-white/15'
              }`}
            >
              {isMuted ? (
                <MicOff className="w-5 h-5 text-white" />
              ) : (
                <Mic className="w-5 h-5 text-white" />
              )}
            </button>

            {/* Expand */}
            <button
              onClick={handleExpand}
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/15 transition-colors"
            >
              <Maximize2 className="w-5 h-5 text-white" />
            </button>

            {/* End Call */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEndCall();
              }}
              className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all"
            >
              <Phone className="w-4 h-4 text-white rotate-[135deg]" />
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes waveform {
          0%, 100% {
            height: 8px;
          }
          50% {
            height: 20px;
          }
        }
        .animate-waveform {
          animation: waveform 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
