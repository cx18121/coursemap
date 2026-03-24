'use client';

import React, { useState, useEffect, useRef } from 'react';

interface Account {
  role: string;
  email: string | null;
  connected: boolean;
  reconnectNeeded: boolean;
}

interface MeResponse {
  user: {
    id: number;
    name: string;
    email: string;
    canvasIcsUrl: string | null;
  };
  accounts: Account[];
  setupComplete: boolean;
}

export default function AccountDropdown() {
  const [meData, setMeData] = useState<MeResponse | null>(null);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MeResponse | null) => setMeData(data))
      .catch(() => null);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSignOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    window.location.href = '/';
  };

  if (!meData) return null;

  const { user, accounts } = meData;
  const schoolConnected = accounts.some((a) => a.role === 'school');
  const displayName = user.name || user.email;
  const truncatedName =
    displayName.length > 20 ? displayName.slice(0, 18) + '\u2026' : displayName;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-2 md:py-1.5 text-[--color-text-secondary] hover:text-[--color-text-primary] rounded-lg transition-colors text-sm border border-transparent hover:border-[--color-border] hover:bg-[--color-surface-raised]"
      >
        <span>{truncatedName}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-60 bg-white border border-[--color-border] rounded-lg shadow-lg shadow-black/6 py-1 z-[60]">
          {accounts.map((account) => (
            <div
              key={account.role}
              className="px-3 py-2 flex items-center justify-between"
            >
              <p className="text-[--color-text-secondary] text-xs truncate min-w-0 flex-1">
                {account.email ?? 'Unknown email'}
              </p>
              <span
                className={`ml-2 flex-shrink-0 text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${
                  account.role === 'personal'
                    ? 'bg-[--color-accent-dim] text-[--color-accent]'
                    : 'bg-[--color-surface-raised] text-[--color-text-secondary] border border-[--color-border]'
                }`}
              >
                {account.role === 'personal' ? 'Personal' : 'School'}
              </span>
            </div>
          ))}

          {!schoolConnected && (
            <>
              <div className="my-1 border-t border-[--color-border]" />
              <a
                href="/link/school-google"
                className="block px-3 py-2 text-[--color-text-tertiary] hover:text-[--color-text-primary] hover:bg-[--color-surface-raised] text-xs transition-colors"
                onClick={() => setOpen(false)}
              >
                + Link school account
              </a>
            </>
          )}

          <div className="my-1 border-t border-[--color-border]" />

          <button
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2 text-[--color-text-tertiary] hover:text-[--color-text-primary] hover:bg-[--color-surface-raised] text-xs transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
