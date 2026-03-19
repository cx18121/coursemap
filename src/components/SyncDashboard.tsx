'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import CountdownPanel from './CountdownPanel';
import ConflictPanel from './ConflictPanel';
import DedupePanel from './DedupePanel';
import CourseAccordion from './CourseAccordion';
import SchoolCalendarList from './SchoolCalendarList';
import SyncButton from './SyncButton';
import SyncSummary from './SyncSummary';
import { CourseTypeSetting } from './TypeGroupingToggle';

// ---- Constants -----------------------------------------------------------

/** Default Google Calendar colorIds per event type (mirrors gcalSubcalendars.ts). */
const DEFAULT_TYPE_COLORS: Record<string, string> = {
  Assignments:   '9',
  Quizzes:       '11',
  Discussions:   '2',
  Events:        '6',
  Announcements: '8',
  Exams:         '3',
  Labs:          '7',
  Lectures:      '5',
  Projects:      '4',
};

// ---- Types ---------------------------------------------------------------

interface CourseEvent {
  uid: string;
  summary: string;
  cleanedTitle: string;
  description: string;
  start: string;
  end: string;
  excluded: boolean;
  eventType: string;
}

interface Course {
  courseName: string;
  colorId: string;
  enabled: boolean;
  events: CourseEvent[];
}

interface SchoolCalendar {
  calendarId: string;
  name: string;
  selected: boolean;
}

interface SyncProgress {
  courseName: string;
  processed: number;
  total: number;
}

interface SyncJobSummary {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

type SyncStatus = 'idle' | 'running' | 'complete' | 'error';

// ---- Props ---------------------------------------------------------------

interface SyncDashboardProps {
  userName: string;
  hasCanvasUrl: boolean;
  hasSchoolAccount: boolean;
  initialCourseTypeSettings: CourseTypeSetting[];
}

// ---- Component -----------------------------------------------------------

export default function SyncDashboard({ userName, hasCanvasUrl, hasSchoolAccount, initialCourseTypeSettings }: SyncDashboardProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [schoolCalendars, setSchoolCalendars] = useState<SchoolCalendar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncProgress, setSyncProgress] = useState<SyncProgress[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [canvasSummary, setCanvasSummary] = useState<SyncJobSummary | undefined>(undefined);
  const [mirrorSummary, setMirrorSummary] = useState<SyncJobSummary | undefined>(undefined);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastSyncStatus, setLastSyncStatus] = useState<'success' | 'error' | null>(null);
  const [syncVersion, setSyncVersion] = useState(0);

  const [courseTypeSettings, setCourseTypeSettings] = useState<CourseTypeSetting[]>(initialCourseTypeSettings);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Initial data load -------------------------------------------------

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const promises: Promise<void>[] = [];

        if (hasCanvasUrl) {
          promises.push(
            fetch('/api/parse-ics')
              .then((r) => r.json())
              .then((data) => {
                if (data.courses) setCourses(data.courses);
              })
          );
        }

        if (hasSchoolAccount) {
          promises.push(
            fetch('/api/school-calendars')
              .then((r) => r.json())
              .then((data) => {
                if (data.calendars) setSchoolCalendars(data.calendars);
              })
          );
        }

        // Fetch latest courseTypeSettings from API (may have been updated by last sync)
        promises.push(
          fetch('/api/user-settings')
            .then((r) => r.json())
            .then((data) => {
              if (data.courseTypeSettings) setCourseTypeSettings(data.courseTypeSettings);
            })
        );

        await Promise.all(promises);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [hasCanvasUrl, hasSchoolAccount]);

  // ---- Read last synced timestamp from DB on mount ------------------------

  useEffect(() => {
    fetch('/api/sync/last')
      .then((r) => r.json())
      .then((data) => {
        if (data.lastSyncedAt) setLastSyncedAt(data.lastSyncedAt);
        if (data.lastSyncStatus) setLastSyncStatus(data.lastSyncStatus);
      })
      .catch(() => {
        // Non-fatal: timestamp will appear after first sync
      });
  }, []);

  // ---- Cleanup polling on unmount ----------------------------------------

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // ---- Clear summary when user makes changes ------------------------------

  function clearSummary() {
    setCanvasSummary(undefined);
    setMirrorSummary(undefined);
  }

  // ---- Course/event handlers ---------------------------------------------

  const handleToggleCourse = useCallback(async (courseName: string, enabled: boolean) => {
    setCourses((prev) =>
      prev.map((c) =>
        c.courseName === courseName ? { ...c, enabled } : c
      )
    );
    clearSummary();
    await fetch('/api/user-selections', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseSelections: [{ courseName, enabled }],
      }),
    }).catch(console.error);
  }, []);

  const handleToggleEvent = useCallback(async (uid: string, wasIncluded: boolean) => {
    // wasIncluded is the old state; we're toggling, so new excluded = wasIncluded
    const newExcluded = wasIncluded;
    setCourses((prev) =>
      prev.map((c) => ({
        ...c,
        events: c.events.map((e) =>
          e.uid === uid ? { ...e, excluded: newExcluded } : e
        ),
      }))
    );
    clearSummary();
    await fetch('/api/user-selections', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventOverrides: [{ eventUid: uid, enabled: !newExcluded }],
      }),
    }).catch(console.error);
  }, []);

  const handleChangeColor = useCallback(async (courseName: string, colorId: string) => {
    setCourses((prev) =>
      prev.map((c) =>
        c.courseName === courseName ? { ...c, colorId } : c
      )
    );
    clearSummary();
    await fetch('/api/user-selections', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseSelections: [{ courseName, colorId }],
      }),
    }).catch(console.error);
  }, []);

  const handleToggleEventType = useCallback(async (courseName: string, eventType: string, enabled: boolean) => {
    // Optimistic update — add row if it doesn't exist in DB state yet
    const previousSettings = courseTypeSettings;
    setCourseTypeSettings((prev) => {
      const exists = prev.some((s) => s.courseName === courseName && s.eventType === eventType);
      if (exists) {
        return prev.map((s) =>
          s.courseName === courseName && s.eventType === eventType ? { ...s, enabled } : s
        );
      }
      // New row: use type-specific default color for the optimistic entry
      const defaultColorId = DEFAULT_TYPE_COLORS[eventType] ?? '1';
      return [...prev, { courseName, eventType, enabled, colorId: defaultColorId }];
    });
    clearSummary();

    await fetch('/api/user-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseName, eventType, enabled }),
    }).catch(() => {
      // Silent revert on failure
      setCourseTypeSettings(previousSettings);
    });
  }, [courseTypeSettings]);

  const handleChangeEventTypeColor = useCallback(async (courseName: string, eventType: string, colorId: string) => {
    // Optimistic update
    const previousSettings = courseTypeSettings;
    setCourseTypeSettings((prev) => {
      const exists = prev.some((s) => s.courseName === courseName && s.eventType === eventType);
      if (exists) {
        return prev.map((s) =>
          s.courseName === courseName && s.eventType === eventType ? { ...s, colorId } : s
        );
      }
      return [...prev, { courseName, eventType, enabled: true, colorId }];
    });
    clearSummary();

    await fetch('/api/user-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseName, eventType, colorId }),
    }).catch(() => {
      // Silent revert on failure
      setCourseTypeSettings(previousSettings);
    });
  }, [courseTypeSettings]);

  const handleToggleSchoolCalendar = useCallback(
    async (calendarId: string, calendarName: string, enabled: boolean) => {
      setSchoolCalendars((prev) =>
        prev.map((c) =>
          c.calendarId === calendarId ? { ...c, selected: enabled } : c
        )
      );
      clearSummary();
      await fetch('/api/school-calendars', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId, calendarName, enabled }),
      }).catch(console.error);
    },
    []
  );

  // ---- Sync handler ------------------------------------------------------

  const handleSync = useCallback(async (): Promise<string> => {
    setSyncStatus('running');
    setSyncProgress([]);
    setSyncError(null);
    clearSummary();

    const res = await fetch('/api/sync', { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = data.error ?? 'Failed to start sync';
      setSyncStatus('error');
      setSyncError(msg);
      throw new Error(msg);
    }

    const { jobId } = await res.json();

    // Start polling
    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusRes = await fetch(`/api/sync/status?jobId=${jobId}`);
        const statusData = await statusRes.json();

        if (statusData.progress) setSyncProgress(statusData.progress);

        if (statusData.status === 'complete') {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          setSyncStatus('complete');
          if (statusData.canvasSummary) setCanvasSummary(statusData.canvasSummary);
          if (statusData.mirrorSummary) setMirrorSummary(statusData.mirrorSummary);

          // Re-fetch sync status from DB (manual sync now writes to syncLog too)
          fetch('/api/sync/last')
            .then((r) => r.json())
            .then((data) => {
              if (data.lastSyncedAt) setLastSyncedAt(data.lastSyncedAt);
              if (data.lastSyncStatus) setLastSyncStatus(data.lastSyncStatus);
            })
            .catch(() => {});

          // Refresh courseTypeSettings after sync — new types may have been discovered
          fetch('/api/user-settings')
            .then((r) => r.json())
            .then((data) => {
              if (data.courseTypeSettings) setCourseTypeSettings(data.courseTypeSettings);
            })
            .catch(() => {
              // Non-fatal: settings will refresh on next page load
            });

          // Bump syncVersion to force ConflictPanel remount — clears cached conflict data
          setSyncVersion((v) => v + 1);
        } else if (statusData.status === 'error') {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          setSyncStatus('error');
          setSyncError(statusData.error ?? 'Sync failed');
        }
      } catch (pollErr) {
        console.error('Polling error:', pollErr);
      }
    }, 500);

    return jobId;
  }, []);

  // ---- Derived state -----------------------------------------------------

  const hasAnyCourseEnabled = courses.some((c) => c.enabled);

  // Derive per-course type settings from the actual events in each course,
  // merged with any saved DB preferences (courseTypeSettings).
  // This means checkboxes appear immediately after courses load, with categories
  // specific to each course based on its actual event titles.
  const derivedCourseTypeSettings = useMemo<CourseTypeSetting[]>(() => {
    const savedMap = new Map(
      courseTypeSettings.map((s) => [
        `${s.courseName}:${s.eventType}`,
        { enabled: s.enabled, colorId: s.colorId },
      ])
    );

    const result: CourseTypeSetting[] = [];
    for (const course of courses) {
      const seenTypes = new Set<string>();
      for (const event of course.events) {
        if (!seenTypes.has(event.eventType)) {
          seenTypes.add(event.eventType);
          const key = `${course.courseName}:${event.eventType}`;
          const saved = savedMap.get(key);
          result.push({
            courseName: course.courseName,
            eventType: event.eventType,
            enabled: saved?.enabled ?? true,
            colorId: saved?.colorId ?? DEFAULT_TYPE_COLORS[event.eventType] ?? '1',
          });
        }
      }
    }
    return result;
  }, [courses, courseTypeSettings]);

  const countdownEvents = useMemo(() => {
    const enabledTypeMap = new Map<string, boolean>();
    for (const s of derivedCourseTypeSettings) {
      enabledTypeMap.set(`${s.courseName}:${s.eventType}`, s.enabled);
    }
    return courses.flatMap((course) =>
      course.events
        .filter((event) => {
          const key = `${course.courseName}:${event.eventType}`;
          return enabledTypeMap.get(key) !== false;
        })
        .map((event) => ({
          ...event,
          courseName: course.courseName,
          courseEnabled: course.enabled,
        }))
    );
  }, [courses, derivedCourseTypeSettings]);

  // ---- Render ------------------------------------------------------------

  return (
    <div className="min-h-screen pb-32">
      {/* Background glow */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-500/[0.03] rounded-full blur-[120px]" />
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-12 space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-[--color-text-primary] tracking-tight">
            Welcome, {userName}
          </h1>
          <p className="text-sm text-[--color-text-secondary]">
            Manage your Canvas courses and sync them to Google Calendar.
          </p>
          {lastSyncedAt !== null && (
            <p className="text-xs text-[--color-text-secondary]">
              Last synced {new Date(lastSyncedAt).toLocaleString()}
              {lastSyncStatus === 'error' && (
                <span className="text-red-400 ml-1">(failed)</span>
              )}
            </p>
          )}
        </div>

        {/* Countdown panel — upcoming deadlines */}
        {!isLoading && hasCanvasUrl && courses.length > 0 && (
          <CountdownPanel events={countdownEvents} />
        )}

        {/* Dedup preview panel — Canvas sync preview */}
        {!isLoading && hasCanvasUrl && courses.length > 0 && (
          <DedupePanel />
        )}

        {/* Conflict detection panel — GCal edits since last sync */}
        {!isLoading && hasCanvasUrl && courses.length > 0 && (
          <ConflictPanel key={syncVersion} />
        )}

        {/* No Canvas URL message */}
        {!hasCanvasUrl && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-[--color-border] p-5">
            <p className="text-sm text-[--color-text-primary] font-medium">Canvas feed not configured</p>
            <p className="text-xs text-[--color-text-secondary] mt-1">
              Add your Canvas ICS URL in Settings to start syncing assignments.
            </p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && hasCanvasUrl && (
          <div className="flex items-center gap-3 py-8 justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
            <span className="text-sm text-[--color-text-secondary]">Loading your courses…</span>
          </div>
        )}

        {/* Load error */}
        {loadError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
            <p className="text-sm text-red-400">{loadError}</p>
          </div>
        )}

        {/* Canvas courses section */}
        {!isLoading && hasCanvasUrl && courses.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[--color-text-secondary] px-1">
              Canvas Courses
            </h2>
            {courses.map((course) => (
              <CourseAccordion
                key={course.courseName}
                courseName={course.courseName}
                colorId={course.colorId}
                enabled={course.enabled}
                events={course.events}
                courseTypeSettings={derivedCourseTypeSettings.filter((s) => s.courseName === course.courseName)}
                onToggleCourse={handleToggleCourse}
                onToggleEvent={handleToggleEvent}
                onChangeColor={handleChangeColor}
                onToggleEventType={handleToggleEventType}
                onChangeEventTypeColor={handleChangeEventTypeColor}
              />
            ))}
          </section>
        )}

        {/* No courses found */}
        {!isLoading && hasCanvasUrl && courses.length === 0 && !loadError && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-[--color-border] p-5">
            <p className="text-sm text-[--color-text-secondary]">No courses found in your Canvas feed.</p>
          </div>
        )}

        {/* School calendars section */}
        {hasSchoolAccount && !isLoading && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[--color-text-secondary] px-1">
              School Calendars
            </h2>
            <SchoolCalendarList
              calendars={schoolCalendars}
              onToggle={handleToggleSchoolCalendar}
            />
          </section>
        )}
      </div>

      {/* Sync summary (shown above sync button) */}
      {(canvasSummary || mirrorSummary) && (
        <div className="fixed bottom-24 left-0 right-0 flex justify-center px-4 z-40">
          <div className="w-full max-w-2xl">
            <SyncSummary
              canvasSummary={canvasSummary}
              mirrorSummary={mirrorSummary}
              onDismiss={clearSummary}
            />
          </div>
        </div>
      )}

      {/* Sync button (fixed bottom) */}
      <SyncButton
        onSync={handleSync}
        syncStatus={syncStatus}
        progress={syncProgress}
        syncError={syncError}
        disabled={!hasAnyCourseEnabled || syncStatus === 'running'}
      />
    </div>
  );
}
