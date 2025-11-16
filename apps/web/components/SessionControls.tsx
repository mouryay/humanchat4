'use client';

import clsx from 'clsx';
import styles from './ConversationView.module.css';

interface SessionControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  disabled?: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
}

const icon = (type: 'mic' | 'cam' | 'end', active: boolean) => {
  switch (type) {
    case 'mic':
      return active ? '🎙️' : '🔇';
    case 'cam':
      return active ? '🎥' : '📷✖️';
    case 'end':
    default:
      return '📞✖️';
  }
};

export default function SessionControls({ isMuted, isVideoOff, disabled, onToggleMute, onToggleVideo, onEndCall }: SessionControlsProps) {
  return (
    <div className={styles.controlsRow}>
      <button type="button" className={clsx(styles.controlButton, isMuted && styles.controlButtonMuted)} onClick={onToggleMute} disabled={disabled}>
        {icon('mic', !isMuted)} {isMuted ? 'Unmute' : 'Mute'}
      </button>
      <button type="button" className={clsx(styles.controlButton, isVideoOff && styles.controlButtonMuted)} onClick={onToggleVideo} disabled={disabled}>
        {icon('cam', !isVideoOff)} {isVideoOff ? 'Camera On' : 'Camera Off'}
      </button>
      <button type="button" className={clsx(styles.controlButton, styles.controlButtonDanger)} onClick={onEndCall} disabled={disabled}>
        {icon('end', false)} End Call
      </button>
    </div>
  );
}
