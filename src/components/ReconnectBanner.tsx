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
      : 'Your school Google connection has expired. Canvas ICS sync still works.';

  const reconnectHref =
    account === 'personal' ? '/login/google' : '/link/school-google';

  const reconnectLabel =
    account === 'personal' ? 'Reconnect Google' : 'Reconnect School Account';

  return (
    <div className="w-full px-4 py-3 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between gap-4">
      <p className="text-amber-200 text-sm">{message}</p>
      <div className="flex items-center gap-3 flex-shrink-0">
        <a
          href={reconnectHref}
          className="text-sm px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-lg transition-colors font-medium border border-amber-500/30"
        >
          {reconnectLabel}
        </a>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="text-amber-200/60 hover:text-amber-200 transition-colors"
          >
            <svg
              className="w-4 h-4"
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
