'use client';

import { useState } from 'react';

interface DedupeSummary {
  wouldCreate: number;
  wouldUpdate: number;
  wouldSkip: number;
}

export default function DedupePanel() {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<DedupeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (summary !== null) return; // already loaded, just re-expand
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sync/preview');
      if (!res.ok) throw new Error('Failed to load preview');
      const data: DedupeSummary = await res.json();
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading preview');
    } finally {
      setLoading(false);
    }
  }

  const total = summary ? summary.wouldCreate + summary.wouldUpdate + summary.wouldSkip : 0;

  return (
    <div className="bg-white/[0.04] backdrop-blur-lg rounded-2xl border border-[--color-border] overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[--color-text-primary]">
            Canvas Sync Preview
          </span>
          {summary !== null && !loading && (
            <span className="text-xs text-[--color-text-secondary]">
              ({total} events)
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-[--color-text-secondary] transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Body — only when expanded */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-[--color-border]">
          {loading && (
            <div className="flex items-center gap-2 py-3">
              <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              <span className="text-xs text-[--color-text-secondary]">Analyzing Canvas feed...</span>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 py-3">{error}</p>
          )}

          {summary !== null && !loading && (
            <div className="grid grid-cols-3 gap-4 py-3">
              <div className="text-center">
                <p className="text-2xl font-semibold text-emerald-400">{summary.wouldCreate}</p>
                <p className="text-xs text-[--color-text-secondary] mt-1">New</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold text-sky-400">{summary.wouldUpdate}</p>
                <p className="text-xs text-[--color-text-secondary] mt-1">Changed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold text-[--color-text-secondary]">{summary.wouldSkip}</p>
                <p className="text-xs text-[--color-text-secondary] mt-1">Unchanged</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
