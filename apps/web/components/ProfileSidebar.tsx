'use client';

import { useState } from 'react';
import type { ProfileSummary } from '../../../src/lib/db';
import ProfileCard from './ProfileCard';

const DEFAULT_VISIBLE = 5;

interface ProfileSidebarProps {
  profiles: ProfileSummary[];
  onConnectNow?: (profile: ProfileSummary) => void;
  onBookTime?: (profile: ProfileSummary) => void;
  connectingProfileId?: string | null;
  hideHeader?: boolean;
  label?: string;
}

export default function ProfileSidebar({
  profiles,
  onConnectNow,
  onBookTime,
  connectingProfileId,
  hideHeader = false,
  label
}: ProfileSidebarProps) {
  const [expanded, setExpanded] = useState(false);

  if (profiles.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 text-3xl opacity-40">👥</div>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          People Sam recommends will appear here.
        </p>
      </div>
    );
  }

  const visible = expanded ? profiles : profiles.slice(0, DEFAULT_VISIBLE);
  const hasMore = profiles.length > DEFAULT_VISIBLE && !expanded;

  return (
    <div className="flex h-full flex-col">
      {!hideHeader && (
        <div className="px-5 pt-4 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--text-tertiary)' }}>
            {label ?? 'Recommended people'}
          </p>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {visible.map((profile) => (
          <ProfileCard
            key={profile.userId}
            profile={profile}
            onConnectNow={onConnectNow}
            onBookTime={onBookTime}
            isConnecting={connectingProfileId === profile.userId}
          />
        ))}
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="w-full py-2.5 rounded-xl text-sm transition-all duration-150"
            style={{
              color: 'var(--text-tertiary)',
              background: 'color-mix(in srgb, var(--background-tertiary) 65%, transparent)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            Show more ({profiles.length - DEFAULT_VISIBLE})
          </button>
        )}
      </div>
    </div>
  );
}
