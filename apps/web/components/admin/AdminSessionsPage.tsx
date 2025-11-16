'use client';

import { useEffect, useState } from 'react';
import { AdminSessionSummary, fetchAdminSessions } from '../../services/adminApi';

const statusColor = (status: AdminSessionSummary['status']) => {
  switch (status) {
    case 'in_progress':
      return 'text-peach';
    case 'complete':
      return 'text-aqua';
    default:
      return 'text-white/70';
  }
};

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<AdminSessionSummary[]>([]);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchAdminSessions(limit);
        if (mounted) {
          setSessions(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unable to load sessions');
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
  }, [limit]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Sessions</h1>
          <p className="text-white/60">Monitor live and recent activity.</p>
        </div>
        <select
          value={limit}
          onChange={(event) => setLimit(Number(event.target.value))}
          className="w-32 rounded-2xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
        >
          {[25, 50, 100, 150].map((value) => (
            <option key={value} value={value} className="text-black">
              Last {value}
            </option>
          ))}
        </select>
      </div>
      {error && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>}
      <div className="rounded-3xl border border-white/10 bg-white/5">
        {loading ? (
          <div className="p-6 text-white/70">Loading sessions…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead>
                <tr className="text-white/60">
                  <th className="px-6 py-3">Host</th>
                  <th className="px-6 py-3">Guest</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Duration</th>
                  <th className="px-6 py-3">Agreed rate</th>
                  <th className="px-6 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {sessions.map((session) => (
                  <tr key={session.id} className="text-white/90">
                    <td className="px-6 py-3">{session.host_name}</td>
                    <td className="px-6 py-3">{session.guest_name}</td>
                    <td className={`px-6 py-3 text-xs font-semibold ${statusColor(session.status)}`}>
                      {session.status.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-3 text-white/70">{session.type}</td>
                    <td className="px-6 py-3 text-white/70">{session.duration_minutes} min</td>
                    <td className="px-6 py-3">${(session.agreed_price / 100).toFixed(2)}</td>
                    <td className="px-6 py-3 text-white/60">{new Date(session.updated_at).toLocaleString()}</td>
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
