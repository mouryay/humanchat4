"use client";

import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { signOut } from 'firebase/auth';

import { firebaseAuth } from '../lib/firebaseClient';
import { logout } from '../services/authApi';
import { sessionStatusManager } from '../services/sessionStatusManager';
import { AUTH_UPDATED_EVENT } from '../constants/events';
import { db } from '../../../src/lib/db';

interface LogoutButtonProps {
  className?: string;
  children?: ReactNode;
}

const LogoutButton = ({ className, children }: LogoutButtonProps) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      // Clear server session
      try {
        await logout();
      } catch (apiError) {
        console.error('Failed to clear server session', apiError);
      }
      
      // Sign out from Firebase
      try {
        await signOut(firebaseAuth);
      } catch (firebaseError) {
        console.error('Failed to clear Firebase session', firebaseError);
      }
      
      // Clear IndexedDB
      try {
        await db.delete();
        console.log('IndexedDB cleared');
      } catch (dbError) {
        console.error('Failed to clear IndexedDB', dbError);
      }
      
      // Clear all cookies
      if (typeof document !== 'undefined') {
        document.cookie.split(';').forEach((cookie) => {
          const name = cookie.split('=')[0].trim();
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
        });
      }
      
      // Clear localStorage and sessionStorage
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
    } finally {
      sessionStatusManager.setCurrentUserId(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(AUTH_UPDATED_EVENT));
      }
      setIsLoading(false);
      
      // Force a hard reload to clear any cached state
      window.location.href = '/';
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className={clsx(
        'rounded-full border border-white/20 px-4 py-1 text-sm text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
    >
      {children ?? (isLoading ? 'Signing out…' : 'Logout')}
    </button>
  );
};

export default LogoutButton;
