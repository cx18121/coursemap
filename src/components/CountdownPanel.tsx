'use client';

import { useState, useEffect, useMemo } from 'react';

type Bucket = 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'later';

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

export function getBucket(dueDate: Date): Bucket {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays <= 7) return 'this_week';
  return 'later';
}

const BUCKET_LABELS: Record<Bucket, string> = {
  overdue: 'Overdue',
  today: 'Due Today',
  tomorrow: 'Due Tomorrow',
  this_week: 'Due This Week',
  later: 'Later',
};

const BUCKET_ORDER: Bucket[] = ['overdue', 'today', 'tomorrow', 'this_week'];
// Exclude 'later' from display — only show actionable deadlines

export default function CountdownPanel({ events }: CountdownPanelProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const bucketed = useMemo(() => {
    if (!mounted) return null;
    // Filter: only include non-excluded events from enabled courses
    const active = events.filter((e) => !e.excluded && e.courseEnabled);
    const groups: Record<Bucket, CountdownEvent[]> = {
      overdue: [], today: [], tomorrow: [], this_week: [], later: [],
    };
    for (const event of active) {
      const dueDate = new Date(event.end || event.start);
      const bucket = getBucket(dueDate);
      groups[bucket].push(event);
    }
    return groups;
  }, [events, mounted]);

  if (!mounted || !bucketed) return null;

  const hasBucketedEvents = BUCKET_ORDER.some((b) => bucketed[b].length > 0);
  if (!hasBucketedEvents) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-[--color-border] p-5">
        <p className="text-sm text-[--color-text-secondary]">No upcoming deadlines</p>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[--color-text-secondary] px-1">
        Upcoming Deadlines
      </h2>
      {BUCKET_ORDER.map((bucket) => {
        const items = bucketed[bucket];
        if (items.length === 0) return null;
        const isOverdue = bucket === 'overdue';
        return (
          <div key={bucket} className={`rounded-2xl border p-4 space-y-2 ${isOverdue ? 'bg-red-500/10 border-red-500/30' : 'bg-white/10 backdrop-blur-lg border-[--color-border]'}`}>
            <h3 className={`text-xs font-semibold uppercase tracking-wider ${isOverdue ? 'text-red-400' : 'text-[--color-text-secondary]'}`}>
              {BUCKET_LABELS[bucket]} ({items.length})
            </h3>
            <ul className="space-y-1">
              {items.map((e) => (
                <li key={e.uid} className="flex items-center justify-between text-sm">
                  <span className="text-[--color-text-primary] truncate mr-2">
                    {e.cleanedTitle || e.summary}
                  </span>
                  <span className="text-xs text-[--color-text-secondary] whitespace-nowrap">
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
