'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type CallType = 'audio' | 'video';
export type CallStatus = 'connecting' | 'connected' | 'ending' | 'disconnected' | 'failed';

interface CallContextValue {
  // Call metadata
  callId: string | null;
  callType: CallType | null;
  conversationId: string | null;
  participantName: string | null;
  participantAvatar: string | null;
  returnUrl: string | null;
  
  // Call state
  status: CallStatus;
  isMinimized: boolean;
  connectedAt: number | null;
  
  // Media state
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn: boolean;
  isScreenSharing: boolean;
  
  // Actions
  startCall: (params: StartCallParams) => void;
  endCall: () => void;
  toggleMinimize: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleSpeaker: () => void;
  toggleScreenShare: () => void;
  updateStatus: (status: CallStatus) => void;
  updateConnectedAt: (timestamp: number) => void;
}

interface StartCallParams {
  callId: string;
  callType: CallType;
  conversationId: string;
  participantName: string;
  participantAvatar?: string;
  returnUrl: string;
}

const CallContext = createContext<CallContextValue | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [callId, setCallId] = useState<string | null>(null);
  const [callType, setCallType] = useState<CallType | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState<string | null>(null);
  const [participantAvatar, setParticipantAvatar] = useState<string | null>(null);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  
  const [status, setStatus] = useState<CallStatus>('disconnected');
  const [isMinimized, setIsMinimized] = useState(false);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const startCall = useCallback((params: StartCallParams) => {
    setCallId(params.callId);
    setCallType(params.callType);
    setConversationId(params.conversationId);
    setParticipantName(params.participantName);
    setParticipantAvatar(params.participantAvatar || null);
    setReturnUrl(params.returnUrl);
    setStatus('connecting');
    setConnectedAt(null); // Will be set when actually connected
    setIsMinimized(false);
  }, []);

  const endCall = useCallback(() => {
    setCallId(null);
    setCallType(null);
    setConversationId(null);
    setParticipantName(null);
    setParticipantAvatar(null);
    setReturnUrl(null);
    setStatus('disconnected');
    setConnectedAt(null);
    setIsMinimized(false);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized(prev => !prev);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const toggleCamera = useCallback(() => {
    setIsCameraOff(prev => !prev);
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn(prev => !prev);
  }, []);

  const toggleScreenShare = useCallback(() => {
    setIsScreenSharing(prev => !prev);
  }, []);

  const updateStatus = useCallback((newStatus: CallStatus) => {
    setStatus(newStatus);
  }, []);

  const updateConnectedAt = useCallback((timestamp: number) => {
    setConnectedAt(timestamp);
  }, []);

  const value: CallContextValue = {
    callId,
    callType,
    conversationId,
    participantName,
    participantAvatar,
    returnUrl,
    status,
    isMinimized,
    connectedAt,
    isMuted,
    isCameraOff,
    isSpeakerOn,
    isScreenSharing,
    startCall,
    endCall,
    toggleMinimize,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
    toggleScreenShare,
    updateStatus,
    updateConnectedAt,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCallContext() {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCallContext must be used within a CallProvider');
  }
  return context;
}
