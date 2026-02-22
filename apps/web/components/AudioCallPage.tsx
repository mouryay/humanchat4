'use client';

import { useState, useEffect } from 'react';
import { Mic, MicOff, Phone, Volume2, ChevronDown, MoreVertical } from 'lucide-react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import { useCallContext } from '../context/CallContext';

interface AudioCallPageProps {
  onEndCall: () => void;
}

export default function AudioCallPage({ onEndCall }: AudioCallPageProps) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const {
    participantName,
    participantAvatar,
    status,
    isMinimized,
    connectedAt,
    isMuted,
    toggleMute,
    toggleMinimize,
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

  const handleToggleMute = async () => {
    if (localParticipant) {
      await localParticipant.setMicrophoneEnabled(isMuted);
    }
    toggleMute();
  };

  if (isMinimized) return null;

  return (
    <div className="relative h-full w-full flex flex-col">
      {/* Top Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-1 h-4 bg-blue-500 rounded-full animate-pulse" />
            <div className="w-1 h-4 bg-blue-500 rounded-full animate-pulse delay-75" />
            <div className="w-1 h-4 bg-blue-500 rounded-full animate-pulse delay-150" />
          </div>
          <span className="text-white/90 font-medium text-base tabular-nums">
            {formatTime(elapsed)}
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={toggleMinimize}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/15 transition-colors"
          >
            <ChevronDown className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/15 transition-colors">
            <MoreVertical className="w-5 h-5 text-white" />
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
            {getInitials(participantName || 'User')}
          </div>
        </div>
      </div>

      {/* Center Content */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Avatar */}
        <div className="relative mb-8">
          {/* Pulsing rings - only show when connecting */}
          {status === 'connecting' && (
            <>
              <div className="absolute inset-0 -m-4">
                <div className="w-full h-full rounded-full bg-blue-500/20 animate-ping" />
              </div>
              <div className="absolute inset-0 -m-2">
                <div className="w-full h-full rounded-full bg-blue-500/10 animate-pulse" />
              </div>
            </>
          )}
          
          {/* Avatar circle */}
          <div className="relative w-40 h-40 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border-4 border-white/10 flex items-center justify-center overflow-hidden">
            {participantAvatar ? (
              <img 
                src={participantAvatar} 
                alt={participantName || 'User'} 
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-5xl font-semibold text-white/90">
                {getInitials(participantName || 'User')}
              </span>
            )}
          </div>
        </div>

        {/* Name */}
        <h1 className="text-4xl font-semibold text-white mb-3">
          {participantName || 'Connecting...'}
        </h1>

        {/* Status */}
        <p className="text-lg text-white/60">
          {status === 'connected' ? 'In call...' : 
           status === 'connecting' ? 'Connecting...' : 
           status === 'ending' ? 'Ending call...' :
           'Call ended'}
        </p>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 pb-12">
        <div className="flex items-center justify-center gap-6">
          {/* Mute/Unmute */}
          <button
            onClick={handleToggleMute}
            className={`w-16 h-16 rounded-full backdrop-blur-xl flex items-center justify-center transition-all ${
              isMuted 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-white/10 hover:bg-white/15'
            }`}
          >
            {isMuted ? (
              <MicOff className="w-7 h-7 text-white" />
            ) : (
              <Mic className="w-7 h-7 text-white" />
            )}
          </button>

          {/* Speaker */}
          <button className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/15 transition-colors">
            <Volume2 className="w-7 h-7 text-white" />
          </button>

          {/* End Call */}
          <button
            onClick={onEndCall}
            className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all shadow-lg shadow-red-500/30"
          >
            <Phone className="w-8 h-8 text-white rotate-[135deg]" />
          </button>
        </div>
      </div>
    </div>
  );
}
