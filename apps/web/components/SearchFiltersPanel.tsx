'use client';

import type { ConversationTypeFilter, PeopleSearchFilters, SortMode } from './peopleSearchTypes';

interface SearchFiltersPanelProps {
  filters: PeopleSearchFilters;
  onChange: (next: PeopleSearchFilters) => void;
  onReset?: () => void;
}

export default function SearchFiltersPanel({ filters, onChange, onReset }: SearchFiltersPanelProps) {
  const update = <K extends keyof PeopleSearchFilters>(key: K, value: PeopleSearchFilters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const activeCount = Number(filters.onlineOnly) + Number(filters.conversationType !== 'all') + Number(filters.sort !== 'active');

  return (
    <div className="flex h-full flex-col px-4 py-4">
      <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Filters</h3>
          <span className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-0.5 text-xs text-white/70">
            {activeCount} active
          </span>
        </div>
        <p className="mt-1 text-xs text-white/55">Refine who appears in your search results.</p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-white/45">Conversation type</span>
            <select
              value={filters.conversationType}
              onChange={(event) => update('conversationType', event.target.value as ConversationTypeFilter)}
              className="h-10 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white focus:border-blue-400 focus:outline-none"
            >
              <option value="all">All types</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
              <option value="charity">Charity</option>
            </select>
          </label>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-white/45">Sort by</span>
            <select
              value={filters.sort}
              onChange={(event) => update('sort', event.target.value as SortMode)}
              className="h-10 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white focus:border-blue-400 focus:outline-none"
            >
              <option value="active">Most active</option>
              <option value="default">Online first</option>
              <option value="recent">Recently joined</option>
            </select>
          </label>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <label className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white/90">
            <input
              type="checkbox"
              checked={filters.onlineOnly}
              onChange={(event) => update('onlineOnly', event.target.checked)}
              className="h-4 w-4 rounded border-white/30 bg-transparent"
            />
            Online only
          </label>
        </div>
      </div>

      <div className="mt-auto pt-4">
        <button
          type="button"
          onClick={onReset}
          className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/[0.07]"
        >
          Reset filters
        </button>
      </div>
    </div>
  );
}
