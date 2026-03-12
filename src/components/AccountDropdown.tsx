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

  // Close on outside click
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

  if (!meData) {
    return null;
  }

  const { user, accounts } = meData;
  const schoolConnected = accounts.some((a) => a.role === 'school');
  const displayName = user.name || user.email;
  // Truncate to reasonable length
  const truncatedName =
    displayName.length > 20 ? displayName.slice(0, 18) + '…' : displayName;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors text-sm font-medium border border-white/10"
      >
        <span>{truncatedName}</span>
        <svg
          className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-zinc-900/90 backdrop-blur-lg border border-white/10 rounded-xl shadow-2xl py-2 z-50">
          {/* Connected accounts */}
          {accounts.map((account) => (
            <div
              key={account.role}
              className="px-4 py-2 flex items-center justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="text-white/80 text-sm truncate">
                  {account.email ?? 'Unknown email'}
                </p>
              </div>
              <span
                className={`ml-2 flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                  account.role === 'personal'
                    ? 'bg-indigo-500/20 text-indigo-300'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {account.role === 'personal' ? 'Personal' : 'School'}
              </span>
            </div>
          ))}

          {/* Link school account option */}
          {!schoolConnected && (
            <a
              href="/link/school-google"
              className="block px-4 py-2 text-white/60 hover:text-white hover:bg-white/5 text-sm transition-colors"
              onClick={() => setOpen(false)}
            >
              + Link school account
            </a>
          )}

          {/* Divider */}
          <div className="my-2 border-t border-white/10" />

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2 text-white/60 hover:text-white hover:bg-white/5 text-sm transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
