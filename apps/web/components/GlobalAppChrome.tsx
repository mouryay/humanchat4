'use client';

import NotificationBell from './NotificationBell';
import UserSettingsMenu from './UserSettingsMenu';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useAuthIdentity } from '../hooks/useAuthIdentity';

/**
 * Fixed top-right app chrome: notifications + account. Lives outside page content (Option A).
 */
export default function GlobalAppChrome() {
  const { isMobile } = useBreakpoint();
  const { identity, loading } = useAuthIdentity();

  if (!loading && !identity) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[9998] flex justify-end pt-[calc(env(safe-area-inset-top,0px)+10px)]"
      aria-label="App controls"
    >
      <div
        className="pointer-events-auto mr-[max(0.75rem,env(safe-area-inset-right))] ml-3 flex min-h-[44px] items-center gap-2 rounded-full border border-white/10 bg-black/55 px-2.5 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-xl md:mr-[calc(var(--sidebar-width)+1rem+env(safe-area-inset-right))]"
      >
        <NotificationBell compact={isMobile} />
        <UserSettingsMenu variant="global" />
      </div>
    </div>
  );
}
