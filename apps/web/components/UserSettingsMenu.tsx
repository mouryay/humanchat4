"use client";

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

import LogoutButton from './LogoutButton';
import { useAuthIdentity } from '../hooks/useAuthIdentity';
import { useBreakpoint } from '../hooks/useBreakpoint';

const getInitials = (name?: string | null, email?: string | null) => {
  if (name) {
    const parts = name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '');
    const joined = parts.join('');
    if (joined) {
      return joined;
    }
  }
  return email?.[0]?.toUpperCase() ?? 'HC';
};

interface UserSettingsMenuProps {
  variant?: 'default' | 'header';
}

export default function UserSettingsMenu({ variant = 'default' }: UserSettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { identity, loading } = useAuthIdentity();
  const pathname = usePathname();
  const { isMobile } = useBreakpoint();
  
  // Hide in layout when on mobile on home page (where chat shows when logged in)
  // Chat interface is on '/' not '/chat' (which redirects to '/')
  // Also hide when logged out (no identity) - the login overlay handles that state
  const shouldHide = variant === 'default' && (
    (isMobile && identity && (pathname === '/' || pathname?.startsWith('/chat'))) ||
    (!identity && !loading)
  );

  const clearHoverTimeout = () => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
  };

  const openWithHover = () => {
    clearHoverTimeout();
    setOpen(true);
  };

  const closeWithDelay = () => {
    clearHoverTimeout();
    hoverTimeout.current = setTimeout(() => setOpen(false), 150);
  };

  const statusLabel = identity ? `Account menu for ${identity.name}` : 'Open account menu';
  const initials = getInitials(identity?.name ?? null, identity?.email ?? null);

  useEffect(() => {
    return () => {
      clearHoverTimeout();
    };
  }, []);

  // Close menu when clicking outside on mobile
  useEffect(() => {
    if (!open || !isMobile) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setOpen(false);
      }
    };

    // Use a small delay to avoid closing immediately when opening
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [open, isMobile]);

  // Hide in layout when on mobile in chat view
  if (shouldHide) {
    return null;
  }

  const isHeaderVariant = variant === 'header';
  const buttonClassName = isHeaderVariant
    ? 'relative flex h-10 w-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-[10px] border border-white/15 bg-white/5 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10 touch-action: manipulation'
    : 'relative flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/5 text-sm font-semibold text-white transition hover:border-white/50';

  return (
    <div
      ref={menuRef}
      className="relative user-settings-menu-container"
      onMouseEnter={!isMobile ? openWithHover : undefined}
      onMouseLeave={!isMobile ? closeWithDelay : undefined}
      onFocusCapture={() => {
        clearHoverTimeout();
        setOpen(true);
      }}
      onBlurCapture={(event) => {
        // Don't close immediately on blur - let click-outside handler manage it on mobile
        if (!isMobile) {
          const relatedTarget = event.relatedTarget as Node | null;
          if (!event.currentTarget.contains(relatedTarget)) {
            clearHoverTimeout();
            setOpen(false);
          }
        }
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          clearHoverTimeout();
          setOpen((prev) => !prev);
        }}
        onTouchStart={(e) => {
          // Prevent mouse events from firing on touch devices
          e.stopPropagation();
        }}
        className={buttonClassName}
        aria-label={statusLabel}
        style={{ touchAction: 'manipulation' }}
      >
        <span className="sr-only">{statusLabel}</span>
        <span aria-hidden>{initials}</span>
      </button>
      <div
        className={clsx(
          'absolute top-full right-0 mt-2 w-56 rounded-2xl border border-white/10 bg-[#0a0e1a]/90 p-3 text-sm text-white shadow-2xl backdrop-blur-2xl transition duration-150 z-[99999]',
          open ? 'visible translate-y-0 opacity-100 pointer-events-auto' : 'invisible translate-y-1 opacity-0 pointer-events-none'
        )}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="mb-3 rounded-xl bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.35em] text-white/70">
          Account status
        </div>
        {identity ? (
          <div className="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <p className="text-white">{identity.name}</p>
            {identity.email && <p className="text-xs text-white/60">{identity.email}</p>}
          </div>
        ) : (
          <p className="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
            Not signed in — open the login panel or continue from signup.
          </p>
        )}
        <div className="space-y-2">
          {identity ? (
            <>
              <Link
                href="/account"
                className="block rounded-xl px-3 py-2 text-white/90 transition hover:bg-white/10 min-h-[44px] flex items-center touch-action: manipulation relative z-[10000]"
                onClick={(e) => {
                  e.stopPropagation();
                  // Close menu after a short delay to allow navigation
                  setTimeout(() => setOpen(false), 200);
                }}
              >
                Account
              </Link>
              <div className="relative z-[10000]">
                <LogoutButton className="w-full rounded-xl border border-white/10 px-3 py-2 text-left text-white/90 hover:bg-white/10 min-h-[44px] touch-action: manipulation" />
              </div>
            </>
          ) : (
            <Link
              href="/"
              className="block rounded-xl border border-white/15 px-3 py-2 text-center text-white/90 transition hover:border-white"
            >
              Go to login panel
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
