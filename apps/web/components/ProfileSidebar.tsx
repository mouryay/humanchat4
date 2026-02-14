'use client';

import type { ProfileSummary } from '../../../src/lib/db';
import ProfileCard from './ProfileCard';

interface ProfileSidebarProps {
  profiles: ProfileSummary[];
  onConnectNow?: (profile: ProfileSummary) => void;
  onBookTime?: (profile: ProfileSummary) => void;
  connectingProfileId?: string | null;
  hideHeader?: boolean;
}

export default function ProfileSidebar({
  profiles,
  onConnectNow,
  onBookTime,
  connectingProfileId,
  hideHeader = false
}: ProfileSidebarProps) {
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

  return (
    <div className="flex h-full flex-col">
      {!hideHeader && (
        <div className="border-b border-white/10 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            Recommended people
          </p>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.userId}
            profile={profile}
            onConnectNow={onConnectNow}
            onBookTime={onBookTime}
            isConnecting={connectingProfileId === profile.userId}
          />
        ))}
      </div>
    </div>
  );
}
