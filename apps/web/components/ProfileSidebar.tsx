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
        <p className="text-sm text-white/40">
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
        <div className="px-4 py-3">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            {label ?? 'Recommended people'}
          </p>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
            className="w-full py-2.5 rounded-xl text-sm text-white/50 hover:text-white/80 bg-white/[0.04] hover:bg-white/[0.08] transition-all duration-150"
          >
            Show more ({profiles.length - DEFAULT_VISIBLE})
          </button>
        )}
      </div>
    </div>
  );
}
