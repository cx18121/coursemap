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
        <span className="text-xs font-semibold text-[--color-text-tertiary] uppercase tracking-wider">
          {label}
        </span>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 justify-end">
          <span className="text-xs text-emerald-600">{s.inserted} created</span>
          <span className="text-xs text-[--color-text-secondary]">{s.updated} updated</span>
          <span className="text-xs text-[--color-text-tertiary]">{s.skipped} unchanged</span>
          {s.failed > 0 && (
            <span className="text-xs text-amber-600">{s.failed} failed</span>
          )}
        </div>
      </div>
      {hasErrors && (
        <div className="mt-1">
          <button
            onClick={() => setShowErrors((v) => !v)}
            className="text-xs text-amber-600 hover:text-amber-700 transition-colors"
          >
            {showErrors ? 'Hide errors' : `Show ${s.errors.length} error${s.errors.length > 1 ? 's' : ''}`}
          </button>
          {showErrors && (
            <ul className="mt-1 space-y-0.5">
              {s.errors.map((err, i) => (
                <li key={i} className="text-xs text-red-600 pl-2 border-l border-red-200">
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
    <div className="bg-white rounded-lg border border-[--color-border] p-4 relative animate-fade-slide-up">
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 p-1.5 rounded-md text-[--color-text-tertiary] hover:text-[--color-text-primary] hover:bg-[--color-surface-raised] transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div className="divide-y divide-[--color-border] pr-8">
        {canvasSummary && (
          <div className="pb-2">
            <SummaryLine label="Canvas" s={canvasSummary} />
          </div>
        )}
        {mirrorSummary && (
          <div className="pt-2">
            <SummaryLine label="School Calendar" s={mirrorSummary} />
          </div>
        )}
      </div>
    </div>
  );
}
