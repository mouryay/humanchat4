'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AdminAnnouncement, fetchAdminAnnouncements, publishAdminAnnouncement } from '../../services/adminApi';

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminAnnouncements();
      setAnnouncements(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load announcements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim()) return;
    try {
      setSubmitting(true);
      await publishAdminAnnouncement(message.trim());
      setMessage('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">Announcements</h1>
        <p className="text-white/60">Share ops updates with the broader team.</p>
      </div>
      <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Shipping new request workflow…"
          className="w-full rounded-2xl border border-white/20 bg-transparent px-4 py-3 text-white placeholder:text-white/40 focus:border-white"
          rows={4}
        />
        <button
          type="submit"
          disabled={submitting || !message.trim()}
          className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-midnight disabled:cursor-not-allowed disabled:bg-white/40"
        >
          {submitting ? 'Publishing…' : 'Publish'}
        </button>
      </form>
      {error && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>}
      <div className="space-y-4">
        {loading && <div className="text-white/70">Loading announcements…</div>}
        {!loading && announcements.length === 0 && <div className="text-white/60">No announcements yet.</div>}
        {announcements.map((announcement) => (
          <div key={announcement.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-white/50">{new Date(announcement.createdAt).toLocaleString()}</p>
            <p className="mt-2 text-white">{announcement.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
