'use client';

import { useState } from 'react';

interface SyncJobSummary {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

interface SyncSummaryProps {
  canvasSummary?: SyncJobSummary;
  mirrorSummary?: SyncJobSummary;
  onDismiss: () => void;
  inline?: boolean;
}

function SummaryLine({ label, s }: { label: string; s: SyncJobSummary }) {
  const [showErrors, setShowErrors] = useState(false);
  const hasErrors = s.errors && s.errors.length > 0;

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-[--color-text-secondary] uppercase tracking-wider">
          {label}
        </span>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 justify-end">
          <span className="text-xs text-emerald-400">{s.inserted} created</span>
          <span className="text-xs text-sky-400">{s.updated} updated</span>
          <span className="text-xs text-[--color-text-secondary]">{s.skipped} unchanged</span>
          {s.failed > 0 && (
            <span className="text-xs text-amber-400">{s.failed} failed</span>
          )}
        </div>
      </div>
      {hasErrors && (
        <div className="mt-1">
          <button
            onClick={() => setShowErrors((v) => !v)}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            {showErrors ? 'Hide errors' : `Show ${s.errors.length} error${s.errors.length > 1 ? 's' : ''}`}
          </button>
          {showErrors && (
            <ul className="mt-1 space-y-0.5">
              {s.errors.map((err, i) => (
                <li key={i} className="text-xs text-red-400 pl-2 border-l border-red-500/30">
                  {err}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function SyncSummary({ canvasSummary, mirrorSummary, onDismiss }: SyncSummaryProps) {
  if (!canvasSummary && !mirrorSummary) return null;

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-[--color-border] p-4 space-y-3 animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-sm font-semibold text-[--color-text-primary]">Sync complete</span>
        </div>
        <button
          onClick={onDismiss}
          className="text-[--color-text-secondary] hover:text-[--color-text-primary] transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Summaries */}
      <div className="space-y-2 divide-y divide-[--color-border]">
        {canvasSummary && (
          <div className="pt-2 first:pt-0">
            <SummaryLine label="Canvas" s={canvasSummary} />
          </div>
        )}
        {mirrorSummary && (
          <div className="pt-2">
            <SummaryLine label="School Mirror" s={mirrorSummary} />
          </div>
        )}
      </div>
    </div>
  );
}
