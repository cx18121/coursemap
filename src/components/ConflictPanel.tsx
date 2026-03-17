'use client';

import { useState } from 'react';

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

export default function ConflictPanel() {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ConflictData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (data !== null) return; // already loaded, just re-expand
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sync/conflicts');
      if (!res.ok) throw new Error('Failed to load conflicts');
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading conflicts');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white/[0.04] backdrop-blur-lg rounded-2xl border border-[--color-border] overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[--color-text-primary]">
            GCal Conflicts
          </span>
          {data !== null && !loading && data.conflictCount > 0 && (
            <span className="text-xs font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
              {data.conflictCount}
            </span>
          )}
          {data !== null && !loading && data.conflictCount === 0 && (
            <span className="text-xs text-[--color-text-secondary]">
              (none)
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-[--color-text-secondary] transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Body — only when expanded */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-[--color-border]">
          {loading && (
            <div className="flex items-center gap-2 py-3">
              <div className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              <span className="text-xs text-[--color-text-secondary]">Checking for conflicts...</span>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 py-3">{error}</p>
          )}

          {data !== null && !loading && data.conflictCount === 0 && (
            <p className="text-xs text-[--color-text-secondary] py-3">
              No conflicts detected. All synced events match their Canvas source.
            </p>
          )}

          {data !== null && !loading && data.conflicts.length > 0 && (
            <ul className="divide-y divide-[--color-border]">
              {data.conflicts.map((c) => (
                <li key={c.uid} className="py-3 flex flex-col gap-1">
                  <span className="text-sm font-medium text-[--color-text-primary]">{c.summary}</span>
                  <div className="flex gap-3 text-xs text-[--color-text-secondary]">
                    <span>Due: {new Date(c.startAt).toLocaleDateString()}</span>
                    <span>GCal edited: {new Date(c.gcalUpdatedAt).toLocaleString()}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
