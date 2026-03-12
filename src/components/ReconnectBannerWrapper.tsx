'use client';

import React, { useState, useEffect } from 'react';
import ReconnectBanner from '@/components/ReconnectBanner';

interface Account {
  role: string;
  email: string | null;
  connected: boolean;
  reconnectNeeded: boolean;
}

interface ReconnectBannerWrapperProps {
  isAuthenticated: boolean;
}

export default function ReconnectBannerWrapper({
  isAuthenticated,
}: ReconnectBannerWrapperProps) {
  const [reconnectAccounts, setReconnectAccounts] = useState<Account[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated) return;

    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { accounts?: Account[] } | null) => {
        if (data?.accounts) {
          const needsReconnect = data.accounts.filter((a) => a.reconnectNeeded);
          setReconnectAccounts(needsReconnect);
        }
      })
      .catch(() => null);
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  const visible = reconnectAccounts.filter((a) => !dismissed.has(a.role));

  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((account) => (
        <ReconnectBanner
          key={account.role}
          account={account.role as 'personal' | 'school'}
          onDismiss={() =>
            setDismissed((prev) => new Set([...prev, account.role]))
          }
        />
      ))}
    </>
  );
}
