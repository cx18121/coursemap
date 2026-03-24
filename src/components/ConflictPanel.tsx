'use client';

import { useEffect, useState } from 'react';

interface ConflictEvent {
  uid: string;
  summary: string;
  startAt: string;
  gcalUpdatedAt: string;
}

interface ConflictData {
  conflictCount: number;
  conflicts: ConflictEvent[];
}

function safeDate(iso: string, opts: Intl.DateTimeFormatOptions): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, opts);
}

export default function ConflictPanel() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ConflictData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/sync/conflicts')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load conflicts');
        return r.json();
      })
      .then((d) => setData(d))
      .catch((err) => setError(err instanceof Error ? err.message : 'Error loading conflicts'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-[--color-border] p-4 flex items-center gap-2">
        <div className="w-4 h-4 rounded-full border-2 border-[--color-accent] border-t-transparent animate-spin" />
        <span className="text-xs text-[--color-text-secondary]">Checking for conflicts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-[--color-border] p-4">
        <p className="text-xs text-red-600">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  if (data.conflictCount === 0) {
    return (
      <div className="bg-white rounded-lg border border-[--color-border] p-4 flex items-center gap-2.5">
        <svg
          className="w-4 h-4 text-emerald-500 flex-shrink-0"
          fill="none"
          viewBox="0 0 16 16"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <circle cx="8" cy="8" r="6.5" strokeOpacity={0.35} />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 8l1.75 1.75L10.5 6.25" />
        </svg>
        <p className="text-sm text-[--color-text-secondary]">No conflicts</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-[--color-border] overflow-hidden">
      <ul className="divide-y divide-[--color-border]">
        {data.conflicts.map((c) => (
          <li key={c.uid} className="px-4 py-3 flex flex-col gap-1 min-w-0">
            <span className="text-sm font-medium text-[--color-text-primary] truncate">{c.summary}</span>
            <div className="flex gap-3 text-xs text-[--color-text-secondary]">
              <span>Due: {safeDate(c.startAt, { month: 'short', day: 'numeric' })}</span>
              <span>GCal edited: {safeDate(c.gcalUpdatedAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
