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
    <div className="w-full px-4 md:px-6 py-2.5 bg-amber-50 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
      <p className="text-amber-800 text-xs">{message}</p>
      <div className="flex items-center gap-2 flex-shrink-0">
        <a
          href={reconnectHref}
          className="text-xs px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg transition-colors font-medium border border-amber-300"
        >
          Reconnect
        </a>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="text-amber-400 hover:text-amber-600 transition-colors"
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
