'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchRequestedPeople, RequestedPerson, RequestedPersonStatus, updateRequestedPerson } from '../services/requestedPeopleApi';

const STATUS_OPTIONS: RequestedPersonStatus[] = ['pending', 'contacted', 'declined', 'onboarded'];

const statusLabel = (status: RequestedPersonStatus) => {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'contacted':
      return 'Contacted';
    case 'declined':
      return 'Declined';
    case 'onboarded':
      return 'Onboarded';
    default:
      return status;
  }
};

const formatDate = (value: string) => new Date(value).toLocaleString();

export default function AdminRequestedPeopleTable() {
  const [people, setPeople] = useState<RequestedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RequestedPersonStatus | 'all'>('pending');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRequestedPeople(statusFilter === 'all' ? undefined : statusFilter);
      setPeople(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const totalRequests = useMemo(() => people.reduce((sum, person) => sum + (person.request_count ?? 0), 0), [people]);

  const handleStatusChange = async (normalizedName: string, status: RequestedPersonStatus) => {
    try {
      const updated = await updateRequestedPerson(normalizedName, status);
      setPeople((prev) => prev.map((person) => (person.normalized_name === updated.normalized_name ? updated : person)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update status');
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl rounded-3xl border border-white/10 bg-white/5 p-6 text-white">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Requested People</h1>
          <p className="text-sm text-white/70">Track who members ask for even if they are not on HumanChat yet.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', ...STATUS_OPTIONS] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatusFilter(option)}
              className={`rounded-full border px-4 py-1 text-sm ${statusFilter === option ? 'border-white bg-white/20' : 'border-white/30 text-white/80'}`}
            >
              {option === 'all' ? 'All' : statusLabel(option)}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-white/80">Loading…</div>}
      {error && <div className="mb-4 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

      {!loading && people.length === 0 && <div className="text-white/70">No requests yet.</div>}

      {!loading && people.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead>
              <tr className="text-white/60">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Requests</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Requested</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {people.map((person) => (
                <tr key={person.normalized_name}>
                  <td className="px-4 py-3 font-medium">{person.name}</td>
                  <td className="px-4 py-3">{person.request_count}</td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-xl border border-white/30 bg-transparent px-2 py-1 text-sm"
                      value={person.status}
                      onChange={(event) => handleStatusChange(person.normalized_name, event.target.value as RequestedPersonStatus)}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status} className="text-black">
                          {statusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-white/80">{formatDate(person.last_requested_at)}</td>
                  <td className="px-4 py-3 text-white/50">{formatDate(person.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 text-sm text-white/70">
        Total individual requests captured in this view: <strong className="text-white">{totalRequests}</strong>
      </div>
    </div>
  );
}
