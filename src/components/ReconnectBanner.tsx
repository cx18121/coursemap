'use client';

import React from 'react';

interface ReconnectBannerProps {
  account: 'personal' | 'school';
  onDismiss?: () => void;
}

export default function ReconnectBanner({ account, onDismiss }: ReconnectBannerProps) {
  const message =
    account === 'personal'
      ? 'Your Google connection has expired.'
      : 'Your school Google connection has expired.';

  const reconnectHref =
    account === 'personal' ? '/login/google' : '/link/school-google';

  return (
    <div className="w-full px-6 py-2.5 bg-amber-500/[0.06] border-b border-amber-500/10 flex items-center justify-between gap-4">
      <p className="text-amber-300/80 text-xs">{message}</p>
      <div className="flex items-center gap-2 flex-shrink-0">
        <a
          href={reconnectHref}
          className="text-xs px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-md transition-colors font-medium border border-amber-500/20"
        >
          Reconnect
        </a>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="text-amber-300/40 hover:text-amber-300/70 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
