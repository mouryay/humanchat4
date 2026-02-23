'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Phone, 
  MonitorUp,
  MoreVertical,
  ChevronDown,
  Maximize2,
  Settings,
  Users,
  Info
} from 'lucide-react';
import { useTracks, VideoTrack, useRoomContext, useLocalParticipant, isTrackReference } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useCallContext } from '../context/CallContext';
import { useAuthIdentity } from '../hooks/useAuthIdentity';

interface VideoCallPageProps {
  onEndCall: () => void;
}

export default function VideoCallPage({ onEndCall }: VideoCallPageProps) {
  const router = useRouter();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const { identity } = useAuthIdentity();
  const {
    participantName,
    status,
    isMinimized,
    connectedAt,
    isMuted,
    isCameraOff,
    isScreenSharing,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    toggleMinimize,
    conversationId,
    returnUrl,
  } = useCallContext();

  const [elapsed, setElapsed] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const hideControlsTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
  const menuRef = useRef<HTMLDivElement>(null);

  // Get video tracks
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const publishedTracks = tracks.filter(isTrackReference);

  const remoteVideoTrack = publishedTracks.find(
    t => !t.participant.isLocal && t.source === Track.Source.Camera
  );
  
  const localVideoTrack = publishedTracks.find(
    t => t.participant.isLocal && t.source === Track.Source.Camera
  );

  const screenShareTrack = publishedTracks.find(
    t => t.source === Track.Source.ScreenShare
  );

  // Timer
  useEffect(() => {
    if (!connectedAt || status !== 'connected') return;

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - connectedAt) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [connectedAt, status]);

  // Auto-hide controls
  useEffect(() => {
    const resetTimeout = () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
      setShowControls(true);
      hideControlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    resetTimeout();
    const handleMouseMove = () => resetTimeout();
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

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

  const handleToggleCamera = async () => {
    if (localParticipant) {
      await localParticipant.setCameraEnabled(isCameraOff);
    }
    toggleCamera();
  };

  const handleMinimize = () => {
    toggleMinimize();
    // Navigate to return URL (where call was initiated from)
    const targetUrl = returnUrl || `/chat${conversationId ? `?conversationId=${conversationId}` : ''}`;
    router.push(targetUrl);
  };

  const handleToggleScreenShare = async () => {
    if (localParticipant) {
      await localParticipant.setScreenShareEnabled(!isScreenSharing);
    }
    toggleScreenShare();
  };

  return (
    <div className={`relative h-full w-full ${isMinimized ? 'hidden' : ''}`}>
      {/* Main Video Stage */}
      <div className="absolute inset-0">
        {remoteVideoTrack ? (
          <VideoTrack
            trackRef={remoteVideoTrack}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
            <div className="text-center">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center mx-auto mb-4">
                <span className="text-5xl font-semibold text-white/80">
                  {getInitials(participantName || 'User')}
                </span>
              </div>
              <p className="text-white/60 text-lg">
                {status === 'connecting' ? 'Connecting...' : 'Waiting for video...'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Screen Share Overlay (if active) */}
      {screenShareTrack && (
        <div className="absolute inset-0 bg-black z-10">
          <VideoTrack
            trackRef={screenShareTrack}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Top Header */}
      <div
        className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-5 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl rounded-full px-4 py-2">
          <div className="flex gap-1">
            <div className="w-1 h-4 bg-green-500 rounded-full animate-pulse" />
            <div className="w-1 h-4 bg-green-500 rounded-full animate-pulse delay-75" />
            <div className="w-1 h-4 bg-green-500 rounded-full animate-pulse delay-150" />
          </div>
          <span className="text-white/90 font-medium text-base tabular-nums">
            {formatTime(elapsed)}
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleMinimize}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <ChevronDown className="w-5 h-5 text-white" />
          </button>
          
          {/* Menu dropdown */}
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl flex items-center justify-center hover:bg-black/50 transition-colors"
            >
              <MoreVertical className="w-5 h-5 text-white" />
            </button>
            
            {showMenu && (
              <div className="absolute right-0 top-12 w-56 bg-slate-800/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 overflow-hidden z-50">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    // Add call info action
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
                >
                  <Info className="w-5 h-5 text-blue-400" />
                  <span className="text-white text-sm">Call Information</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    // Add participants action
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
                >
                  <Users className="w-5 h-5 text-green-400" />
                  <span className="text-white text-sm">View Participants</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    // Add settings action
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left border-t border-white/5"
                >
                  <Settings className="w-5 h-5 text-gray-400" />
                  <span className="text-white text-sm">Call Settings</span>
                </button>
              </div>
            )}
          </div>
          
          {/* Current user avatar */}
          {identity?.avatar ? (
            <img 
              src={identity.avatar} 
              alt={identity.name || 'You'} 
              className="w-10 h-10 rounded-full border-2 border-white/20 object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 border-2 border-white/20 flex items-center justify-center text-white font-semibold text-sm">
              {getInitials(identity?.name || 'User')}
            </div>
          )}
        </div>
      </div>

      {/* Picture-in-Picture (Local Video) */}
      {localVideoTrack && !isCameraOff && (
        <div className="absolute top-20 right-6 z-20 w-48 h-36 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20">
          <VideoTrack
            trackRef={localVideoTrack}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Participant Name Overlay */}
      {!showControls && participantName && (
        <div className="absolute bottom-24 left-6 z-20 bg-black/60 backdrop-blur-xl rounded-full px-4 py-2">
          <p className="text-white/90 font-medium">{participantName}</p>
        </div>
      )}

      {/* Bottom Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 pb-12 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center justify-center gap-5">
          {/* Mute/Unmute */}
          <button
            onClick={handleToggleMute}
            className={`w-16 h-16 rounded-full backdrop-blur-xl flex items-center justify-center transition-all shadow-lg ${
              isMuted 
                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' 
                : 'bg-white/15 hover:bg-white/20'
            }`}
          >
            {isMuted ? (
              <MicOff className="w-7 h-7 text-white" />
            ) : (
              <Mic className="w-7 h-7 text-white" />
            )}
          </button>

          {/* Camera Toggle */}
          <button
            onClick={handleToggleCamera}
            className={`w-16 h-16 rounded-full backdrop-blur-xl flex items-center justify-center transition-all shadow-lg ${
              isCameraOff 
                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' 
                : 'bg-white/15 hover:bg-white/20'
            }`}
          >
            {isCameraOff ? (
              <VideoOff className="w-7 h-7 text-white" />
            ) : (
              <Video className="w-7 h-7 text-white" />
            )}
          </button>

          {/* Screen Share */}
          <button
            onClick={handleToggleScreenShare}
            className={`w-16 h-16 rounded-full backdrop-blur-xl flex items-center justify-center transition-all shadow-lg ${
              isScreenSharing 
                ? 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/30' 
                : 'bg-white/15 hover:bg-white/20'
            }`}
          >
            <MonitorUp className="w-7 h-7 text-white" />
          </button>

          {/* End Call */}
          <button
            onClick={onEndCall}
            className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all shadow-xl shadow-red-500/40"
          >
            <Phone className="w-8 h-8 text-white rotate-[135deg]" />
          </button>
        </div>
      </div>
    </div>
  );
}
