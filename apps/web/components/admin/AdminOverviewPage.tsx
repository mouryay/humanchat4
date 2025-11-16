'use client';

import { useEffect, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AdminOverviewMetrics, fetchAdminOverview } from '../../services/adminApi';

const StatCard = ({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) => (
  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
    <p className="text-sm uppercase tracking-[0.4em] text-white/60">{label}</p>
    <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    {sublabel && <p className="mt-1 text-sm text-white/50">{sublabel}</p>}
  </div>
);

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await fetchAdminOverview();
        if (mounted) {
          setMetrics(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unable to load metrics');
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
  }, []);

  if (loading) {
    return <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-white/70">Loading overview…</div>;
  }

  if (error || !metrics) {
    return <div className="rounded-3xl border border-red-400/40 bg-red-500/10 p-6 text-red-100">{error ?? 'Metrics unavailable.'}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">Overview</h1>
        <p className="text-white/60">Live pulse of hosts, sessions, and revenue.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={metrics.totals.users} sublabel={`Admins: ${metrics.totals.admins}`} />
        <StatCard label="Managed" value={metrics.totals.managed} sublabel={`${metrics.requests.pending} pending requests`} />
        <StatCard label="Active sessions" value={metrics.sessions.active} sublabel={`${metrics.sessions.pending} pending`} />
        <StatCard label="Revenue (7d)" value={`$${metrics.revenue.last7Days.toLocaleString()}`} sublabel={`Today $${metrics.revenue.today}`} />
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-white/60">Trajectory</p>
            <p className="text-2xl font-semibold text-white">Sessions & revenue · 10 days</p>
          </div>
          <div className="text-sm text-white/60">
            Donations 30d · <span className="text-white font-semibold">${metrics.revenue.donations30d.toLocaleString()}</span>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.sparkline} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5bf4ff" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#5bf4ff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="sessionGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a58bff" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#a58bff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#05050b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} labelStyle={{ color: '#fff' }} />
              <Area yAxisId="left" type="monotone" dataKey="activeSessions" stroke="#a58bff" fillOpacity={1} fill="url(#sessionGradient)" />
              <Area yAxisId="right" type="monotone" dataKey="revenue" stroke="#5bf4ff" fillOpacity={1} fill="url(#revenueGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
