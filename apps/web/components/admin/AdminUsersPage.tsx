'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { AdminUserSummary, fetchAdminUsers, updateAdminUser } from '../../services/adminApi';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin' | 'manager'>('all');

  useEffect(() => {
    const handler = setTimeout(() => setSearchQuery(searchInput.trim()), 400);
    return () => clearTimeout(handler);
  }, [searchInput]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchAdminUsers({
          q: searchQuery || undefined,
          role: roleFilter === 'all' ? undefined : roleFilter
        });
        if (mounted) {
          setUsers(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unable to load users');
        }
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
  }, [searchQuery, roleFilter]);

  const requestOnlyShare = useMemo(() => {
    if (!users.length) return 0;
    return Math.round((users.filter((user) => user.managed).length / users.length) * 100);
  }, [users]);

  const handleRoleChange = async (userId: string, role: 'user' | 'admin' | 'manager') => {
    try {
      const updated = await updateAdminUser(userId, { role });
      setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, role: updated.role } : user)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update role');
    }
  };

  const handleRequestOnlyToggle = async (userId: string, managed: boolean) => {
    try {
      const updated = await updateAdminUser(userId, { managed });
      setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, managed: updated.managed } : user)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update request-only flag');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">People</h1>
          <p className="text-white/60">Manage host access, roles, and request-only rosters.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            placeholder="Search name or email"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/50 focus:border-white"
          />
          <select
            className="rounded-2xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}
          >
            <option value="all" className="text-black">
              All roles
            </option>
            <option value="admin" className="text-black">
              Admins
            </option>
            <option value="manager" className="text-black">
              Managers
            </option>
          </select>
        </div>
      </div>
      {error && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>}
      <div className="rounded-3xl border border-white/10 bg-white/5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4 text-sm text-white/70">
          <p>Showing {users.length} people</p>
          <p>Request-only share · {requestOnlyShare}%</p>
        </div>
        {loading ? (
          <div className="p-6 text-white/70">Loading users…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead>
                <tr className="text-white/60">
                  <th className="px-6 py-3">Person</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Request-only</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {users.map((user) => (
                  <tr key={user.id} className="text-white/90">
                    <td className="px-6 py-3">
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-white/60">{user.email}</div>
                    </td>
                    <td className="px-6 py-3">
                      <select
                        className="rounded-xl border border-white/20 bg-transparent px-2 py-1 text-sm"
                        value={user.role}
                        onChange={(event) => handleRoleChange(user.id, event.target.value as 'user' | 'admin' | 'manager')}
                      >
                        <option value="user" className="text-black">
                          User
                        </option>
                        <option value="manager" className="text-black">
                          Manager
                        </option>
                        <option value="admin" className="text-black">
                          Admin
                        </option>
                      </select>
                    </td>
                    <td className="px-6 py-3">
                      <button
                        type="button"
                        onClick={() => handleRequestOnlyToggle(user.id, !user.managed)}
                        className={clsx(
                          'inline-flex items-center rounded-full border px-3 py-1 text-xs uppercase tracking-widest',
                          user.managed
                            ? 'border-aqua/50 bg-aqua/20 text-white'
                            : 'border-white/30 text-white/60 hover:border-white/50'
                        )}
                      >
                        {user.managed ? 'Request-only' : 'Direct'}
                      </button>
                    </td>
                    <td className="px-6 py-3 text-xs">
                      <div className={clsx('font-semibold', user.is_online ? 'text-peach' : 'text-white/60')}>
                        {user.is_online ? 'Online' : 'Offline'}
                      </div>
                      <div className="text-white/50">{user.has_active_session ? 'In session' : 'Idle'}</div>
                    </td>
                    <td className="px-6 py-3 text-white/60">{new Date(user.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
