/// <reference types="jest" />
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VideoCallPanel from '../VideoCallPanel';
import type { VideoCallState } from '../../services/videoCall';

const startSpy = jest.fn(async () => undefined);
const toggleMuteSpy = jest.fn(() => false);
const toggleVideoSpy = jest.fn(() => false);
const endCallSpy = jest.fn();

const listeners: Record<string, Array<(value: unknown) => void>> = {
  state: [],
  localStream: [],
  remoteStream: [],
  error: [],
  metric: []
};

function createMockVideoCall() {
  return class MockVideoCall {
    constructor(_options: unknown) {}
    start = startSpy;
    toggleMute = toggleMuteSpy;
    toggleVideo = toggleVideoSpy;
    endCall = endCallSpy;
    on(event: keyof typeof listeners, handler: (payload: unknown) => void) {
      listeners[event].push(handler);
      return () => {
        listeners[event] = listeners[event].filter((cb) => cb !== handler);
      };
    }
  };
}

const emit = <T,>(event: keyof typeof listeners, payload: T) => {
  listeners[event].forEach((handler) => handler(payload));
};

jest.mock('../../services/videoCall', () => ({
  VideoCall: createMockVideoCall()
}));

describe('VideoCallPanel', () => {
  beforeEach(() => {
    startSpy.mockClear();
    toggleMuteSpy.mockClear();
    toggleVideoSpy.mockClear();
    endCallSpy.mockClear();
    (Object.keys(listeners) as Array<keyof typeof listeners>).forEach((event) => {
      listeners[event] = [];
    });
  });

  it('auto starts call and toggles media controls', async () => {
    render(
      <VideoCallPanel sessionId="session-1" userId="guest" isInitiator participantLabel="Jordan" />
    );

    expect(startSpy).toHaveBeenCalled();

    act(() => {
      emit<VideoCallState>('state', 'connected');
    });

    expect(screen.getByText(/you are connected/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /mute/i }));
    expect(toggleMuteSpy).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /unmute/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /stop video/i }));
    expect(toggleVideoSpy).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /start video/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /end call/i }));
    expect(endCallSpy).toHaveBeenCalled();
    expect(screen.getByText(/call ended/i)).toBeInTheDocument();
  });
});
