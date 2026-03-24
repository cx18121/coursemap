'use client';

import { useEffect, useState } from 'react';

interface DedupeSummary {
  wouldCreate: number;
  wouldUpdate: number;
  wouldSkip: number;
}

export default function DedupePanel() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DedupeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/sync/preview')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load preview');
        return r.json();
      })
      .then((data) => setSummary(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Error loading preview'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-[--color-border] p-4 flex items-center gap-2">
        <div className="w-4 h-4 rounded-full border-2 border-[--color-accent] border-t-transparent animate-spin" />
        <span className="text-xs text-[--color-text-secondary]">Analyzing Canvas feed...</span>
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

  if (!summary) return null;

  return (
    <div className="bg-white rounded-lg border border-[--color-border] px-4 py-3">
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-semibold tabular-nums text-emerald-600">{summary.wouldCreate}</p>
          <p className="text-xs text-[--color-text-tertiary] mt-1">New</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold tabular-nums text-[--color-text-secondary]">{summary.wouldUpdate}</p>
          <p className="text-xs text-[--color-text-tertiary] mt-1">Changed</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold tabular-nums text-[--color-text-secondary]">{summary.wouldSkip}</p>
          <p className="text-xs text-[--color-text-tertiary] mt-1">Unchanged</p>
        </div>
      </div>
    </div>
  );
}
