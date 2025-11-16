'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import clsx from 'clsx';
import { AuthUser, fetchCurrentUser } from '../../services/authApi';

const navItems = [
  { label: 'Overview', href: '/admin' },
  { label: 'People', href: '/admin/users' },
  { label: 'Sessions', href: '/admin/sessions' },
  { label: 'Requests', href: '/admin/requests' },
  { label: 'Announcements', href: '/admin/announcements' }
];

interface AdminShellProps {
  children: ReactNode;
}

export default function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const identity = await fetchCurrentUser();
        if (!mounted) return;
        if (!identity) {
          setError('Please sign in to access the admin dashboard.');
          setUser(null);
          return;
        }
        if (identity.role !== 'admin' && identity.role !== 'manager') {
          setError('You need admin access to view this area.');
          setUser(identity);
          return;
        }
        setUser(identity);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Unable to load admin context.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-midnight text-white">
        <div className="animate-pulse text-white/80">Loading admin workspace…</div>
      </div>
    );
  }

  if (error || !user || (user.role !== 'admin' && user.role !== 'manager')) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-midnight px-6 text-center text-white">
        <h1 className="text-3xl font-semibold">Access restricted</h1>
        <p className="max-w-md text-white/70">{error ?? 'You need elevated permissions to use the admin dashboard.'}</p>
        <div className="flex gap-3">
          <button
            type="button"
            className="rounded-full border border-white/40 px-5 py-2 text-sm text-white/80 transition hover:border-white"
            onClick={() => router.push('/')}
          >
            Go home
          </button>
          <button
            type="button"
            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-midnight"
            onClick={() => router.push('/login')}
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-midnight text-white">
      <div className="grid min-h-screen gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-white/10 bg-white/5 px-6 py-8">
          <div className="mb-10">
            <p className="text-sm uppercase tracking-[0.3em] text-white/60">HumanChat</p>
            <h1 className="mt-2 text-2xl font-semibold">Admin</h1>
            <p className="mt-3 text-sm text-white/70">{user.email}</p>
            <span className="mt-2 inline-flex items-center rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-widest text-white/70">
              {user.role}
            </span>
          </div>
          <nav className="space-y-2">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'block rounded-xl px-4 py-3 text-sm transition',
                    active ? 'bg-white text-midnight font-semibold' : 'text-white/80 hover:bg-white/10'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="px-4 py-6 sm:px-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
