'use client';

import { useState, useEffect, useMemo } from 'react';

type Bucket = 'today' | 'tomorrow' | 'this_week' | 'later';

interface CountdownEvent {
  uid: string;
  summary: string;
  cleanedTitle: string;
  start: string;
  end: string;
  excluded: boolean;
  eventType: string;
  courseName: string;
  courseEnabled: boolean;
}

interface CountdownPanelProps {
  events: CountdownEvent[];
}

export function getBucket(dueDate: Date): Bucket | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) return null;
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays <= 7) return 'this_week';
  return 'later';
}

const BUCKET_LABELS: Record<Bucket, string> = {
  today: 'Due Today',
  tomorrow: 'Due Tomorrow',
  this_week: 'Due This Week',
  later: 'Later',
};

const BUCKET_ORDER: Bucket[] = ['today', 'tomorrow', 'this_week'];

/** Visual urgency treatment per bucket — all semantic, no decoration */
const BUCKET_STYLES: Record<Bucket, {
  card: string;
  header: string;
  date: string;
}> = {
  today: {
    card: 'border-rose-200 bg-rose-50/70',
    header: 'text-rose-600',
    date: 'text-rose-400',
  },
  tomorrow: {
    card: 'border-amber-200 bg-amber-50/70',
    header: 'text-amber-600',
    date: 'text-amber-400',
  },
  this_week: {
    card: 'border-[--color-border] bg-white',
    header: 'text-[--color-text-tertiary]',
    date: 'text-[--color-text-tertiary]',
  },
  later: {
    card: 'border-[--color-border] bg-white',
    header: 'text-[--color-text-tertiary]',
    date: 'text-[--color-text-tertiary]',
  },
};

export default function CountdownPanel({ events }: CountdownPanelProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const bucketed = useMemo(() => {
    if (!mounted) return null;
    const active = events.filter((e) => !e.excluded && e.courseEnabled);
    const groups: Record<Bucket, CountdownEvent[]> = {
      today: [], tomorrow: [], this_week: [], later: [],
    };
    for (const event of active) {
      const dueDate = new Date(event.end || event.start);
      const bucket = getBucket(dueDate);
      if (bucket !== null) groups[bucket].push(event);
    }
    return groups;
  }, [events, mounted]);

  if (!mounted || !bucketed) return null;

  const hasBucketedEvents = BUCKET_ORDER.some((b) => bucketed[b].length > 0);
  if (!hasBucketedEvents) {
    return (
      <div className="bg-white rounded-lg border border-[--color-border] p-4 flex items-center gap-2.5">
        <svg
          className="w-4 h-4 text-emerald-500 flex-shrink-0"
          fill="none"
          viewBox="0 0 16 16"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <circle cx="8" cy="8" r="6.5" strokeOpacity={0.35} />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 8l1.75 1.75L10.5 6.25" />
        </svg>
        <p className="text-sm text-[--color-text-secondary]">All caught up</p>
      </div>
    );
  }

  return (
    <section className="space-y-2">
      {BUCKET_ORDER.map((bucket) => {
        const items = bucketed[bucket];
        if (items.length === 0) return null;
        const styles = BUCKET_STYLES[bucket];
        return (
          <div key={bucket} className={`rounded-lg border p-3 space-y-2 ${styles.card}`}>
            <h3 className={`text-xs font-semibold uppercase tracking-wider ${styles.header}`}>
              {BUCKET_LABELS[bucket]} ({items.length})
            </h3>
            <ul className="space-y-1">
              {items.map((e) => (
                <li key={e.uid} className="flex items-center justify-between gap-2 text-sm min-w-0">
                  <span className="text-[--color-text-primary] truncate min-w-0 flex-1">
                    {e.cleanedTitle || e.summary}
                  </span>
                  <span className={`text-xs whitespace-nowrap tabular-nums flex-shrink-0 ${styles.date}`}>
                    {new Date(e.end || e.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
