'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import CountdownPanel, { getBucket } from './CountdownPanel';
import ConflictPanel from './ConflictPanel';
import DedupePanel from './DedupePanel';
import SchoolCalendarList from './SchoolCalendarList';
import SyncButton from './SyncButton';
import SyncSummary from './SyncSummary';
import { CourseTypeSetting } from './TypeGroupingToggle';
import StatCard from './StatCard';
import CourseRow from './CourseRow';
import CourseDrawer from './CourseDrawer';

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

  // Panel/drawer state
  const [expandedPanel, setExpandedPanel] = useState<'countdown' | 'dedupe' | 'conflicts' | null>(null);
  const [openCourseDrawer, setOpenCourseDrawer] = useState<string | null>(null);
  const [dedupeCount, setDedupeCount] = useState<number | string>('--');
  const [conflictCount, setConflictCount] = useState<number | string>('--');

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

        promises.push(
          fetch('/api/user-settings')
            .then((r) => r.json())
            .then((data) => {
              if (data.courseTypeSettings) setCourseTypeSettings(data.courseTypeSettings);
            })
        );

        promises.push(
          fetch('/api/sync/preview')
            .then((r) => r.json())
            .then((data) => {
              if (data.summary) {
                const total = (data.summary.created ?? 0) + (data.summary.updated ?? 0) + (data.summary.unchanged ?? 0);
                setDedupeCount(total);
              }
            })
            .catch(() => { /* Non-fatal */ })
        );

        promises.push(
          fetch('/api/sync/conflicts')
            .then((r) => r.json())
            .then((data) => {
              if (Array.isArray(data.conflicts)) {
                setConflictCount(data.conflicts.length);
              }
            })
            .catch(() => { /* Non-fatal */ })
        );

        await Promise.all(promises);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Couldn\'t load your courses. Refresh the page to try again.');
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
      .catch(() => {});
  }, []);

  // ---- Cleanup polling on unmount ----------------------------------------

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
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
    const previousSettings = courseTypeSettings;
    setCourseTypeSettings((prev) => {
      const exists = prev.some((s) => s.courseName === courseName && s.eventType === eventType);
      if (exists) {
        return prev.map((s) =>
          s.courseName === courseName && s.eventType === eventType ? { ...s, enabled } : s
        );
      }
      const defaultColorId = DEFAULT_TYPE_COLORS[eventType] ?? '1';
      return [...prev, { courseName, eventType, enabled, colorId: defaultColorId }];
    });
    clearSummary();

    await fetch('/api/user-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseName, eventType, enabled }),
    }).catch(() => {
      setCourseTypeSettings(previousSettings);
    });
  }, [courseTypeSettings]);

  const handleChangeEventTypeColor = useCallback(async (courseName: string, eventType: string, colorId: string) => {
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

    pollTimeoutRef.current = setTimeout(() => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setSyncStatus('error');
      setSyncError('Sync is taking too long. Check your connection and try again.');
    }, 5 * 60 * 1000);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusRes = await fetch(`/api/sync/status?jobId=${jobId}`);
        const statusData = await statusRes.json();

        if (statusData.progress) setSyncProgress(statusData.progress);

        if (statusData.status === 'complete') {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          if (pollTimeoutRef.current) { clearTimeout(pollTimeoutRef.current); pollTimeoutRef.current = null; }
          setSyncStatus('complete');
          if (statusData.canvasSummary) setCanvasSummary(statusData.canvasSummary);
          if (statusData.mirrorSummary) setMirrorSummary(statusData.mirrorSummary);

          fetch('/api/sync/last')
            .then((r) => r.json())
            .then((data) => {
              if (data.lastSyncedAt) setLastSyncedAt(data.lastSyncedAt);
              if (data.lastSyncStatus) setLastSyncStatus(data.lastSyncStatus);
            })
            .catch(() => {});

          fetch('/api/user-settings')
            .then((r) => r.json())
            .then((data) => {
              if (data.courseTypeSettings) setCourseTypeSettings(data.courseTypeSettings);
            })
            .catch(() => {});

          setSyncVersion((v) => v + 1);

          fetch('/api/sync/preview').then((r) => r.json()).then((data) => {
            if (data.summary) {
              const total = (data.summary.created ?? 0) + (data.summary.updated ?? 0) + (data.summary.unchanged ?? 0);
              setDedupeCount(total);
            }
          }).catch(() => {});
          fetch('/api/sync/conflicts').then((r) => r.json()).then((data) => {
            if (Array.isArray(data.conflicts)) setConflictCount(data.conflicts.length);
          }).catch(() => {});
        } else if (statusData.status === 'error') {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          if (pollTimeoutRef.current) { clearTimeout(pollTimeoutRef.current); pollTimeoutRef.current = null; }
          setSyncStatus('error');
          setSyncError(statusData.error ?? 'Sync failed');
        }
      } catch (pollErr) {
        console.error('Polling error:', pollErr);
      }
    }, 500);

    return jobId;
  }, []);

  // ---- Panel/drawer handlers ---------------------------------------------

  const handleCountdownClick = useCallback(() => setExpandedPanel((p) => (p === 'countdown' ? null : 'countdown')), []);
  const handleDedupeClick    = useCallback(() => setExpandedPanel((p) => (p === 'dedupe'    ? null : 'dedupe')),    []);
  const handleConflictsClick = useCallback(() => setExpandedPanel((p) => (p === 'conflicts' ? null : 'conflicts')), []);

  // ---- Derived state -----------------------------------------------------

  const hasAnyCourseEnabled = courses.some((c) => c.enabled);

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

  const upcomingDeadlineCount = useMemo(() => {
    if (!countdownEvents.length) return 0;
    return countdownEvents.filter((e) => {
      if (e.excluded || !e.courseEnabled) return false;
      const dueDate = new Date(e.end || e.start);
      const bucket = getBucket(dueDate);
      return bucket !== null && bucket !== 'later';
    }).length;
  }, [countdownEvents]);

  // ---- Render ------------------------------------------------------------

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 pt-4 md:pt-8 pb-8">
        {/* Page header */}
        <div className="space-y-1.5 mb-8">
          <h1 className="text-3xl font-semibold text-[--color-text-primary] tracking-tight break-words">
            {(() => {
              const h = new Date().getHours();
              return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
            })()}, {userName}
          </h1>
          {lastSyncedAt !== null && (
            <p className="text-xs text-[--color-text-tertiary]">
              Last synced {new Date(lastSyncedAt).toLocaleString()}
              {lastSyncStatus === 'error' && (
                <span className="text-red-600 ml-1">(failed)</span>
              )}
            </p>
          )}
        </div>

        {/* Loading state */}
        {isLoading && hasCanvasUrl && (
          <div className="flex items-center gap-3 py-8 justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-[--color-accent] border-t-transparent animate-spin" />
            <span className="text-sm text-[--color-text-secondary]">Loading your courses...</span>
          </div>
        )}

        {/* Load error */}
        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-700">{loadError}</p>
          </div>
        )}

        {/* No Canvas URL message */}
        {!isLoading && !hasCanvasUrl && (
          <div className="bg-white rounded-lg border border-[--color-border] p-5 mb-4">
            <p className="text-sm text-[--color-text-primary] font-medium">Canvas feed not set up</p>
            <p className="text-xs text-[--color-text-secondary] mt-1">
              Add your Canvas feed URL in Settings to start syncing assignments.
            </p>
          </div>
        )}

        {/* Two-column horizontal layout */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 items-start">

            {/* ── LEFT RAIL: stat cards + expanded panel + sync ── */}
            <aside className="flex flex-col gap-4 order-2 md:order-1">
              {/* Stat cards — horizontal 3-up on mobile, stacked on desktop */}
              {hasCanvasUrl && courses.length > 0 && (
                <div className="grid grid-cols-3 gap-2 md:flex md:flex-col md:gap-2">
                  <StatCard
                    label="Deadlines"
                    value={upcomingDeadlineCount}
                    active={expandedPanel === 'countdown'}
                    onClick={handleCountdownClick}
                  />
                  <StatCard
                    label="Synced"
                    value={dedupeCount}
                    active={expandedPanel === 'dedupe'}
                    onClick={handleDedupeClick}
                  />
                  <StatCard
                    label="Conflicts"
                    value={conflictCount}
                    active={expandedPanel === 'conflicts'}
                    onClick={handleConflictsClick}
                  />
                </div>
              )}

              {/* Expanded detail panel — below stat card stack */}
              {expandedPanel === 'countdown' && (
                <div className="animate-fade-slide-up"><CountdownPanel events={countdownEvents} /></div>
              )}
              {expandedPanel === 'dedupe' && (
                <div className="animate-fade-slide-up"><DedupePanel /></div>
              )}
              {expandedPanel === 'conflicts' && (
                <div className="animate-fade-slide-up"><ConflictPanel key={syncVersion} /></div>
              )}

              {/* Sync button + summary — always last in left rail */}
              <div className="flex flex-col gap-2">
                {(canvasSummary || mirrorSummary) && (
                  <SyncSummary
                    canvasSummary={canvasSummary}
                    mirrorSummary={mirrorSummary}
                    onDismiss={clearSummary}
                    inline
                  />
                )}
                <SyncButton
                  onSync={handleSync}
                  syncStatus={syncStatus}
                  progress={syncProgress}
                  syncError={syncError}
                  disabled={!hasAnyCourseEnabled || syncStatus === 'running'}
                  inline
                />
              </div>
            </aside>

            {/* ── RIGHT COLUMN: course rows + school calendars ── */}
            <main className="flex flex-col order-1 md:order-2">
              {/* Canvas courses — compact rows */}
              {hasCanvasUrl && courses.length > 0 && (
                <section className="space-y-0.5">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-[--color-text-tertiary] px-3 mb-3">
                    Canvas Courses
                  </h2>
                  {courses.map((course, i) => (
                    <div
                      key={course.courseName}
                      className="stagger-item"
                      style={{ animationDelay: `${i * 35}ms` }}
                    >
                      <CourseRow
                        courseName={course.courseName}
                        colorId={course.colorId}
                        enabled={course.enabled}
                        eventCount={course.events.length}
                        onOpen={setOpenCourseDrawer}
                        onToggle={handleToggleCourse}
                      />
                    </div>
                  ))}
                </section>
              )}

              {/* No courses found */}
              {hasCanvasUrl && courses.length === 0 && !loadError && (
                <div className="bg-white rounded-lg border border-[--color-border] p-5">
                  <p className="text-sm text-[--color-text-secondary]">No courses found in your Canvas feed.</p>
                </div>
              )}

              {/* School calendars — below course list */}
              {hasSchoolAccount && (
                <section className="mt-8 space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-[--color-text-tertiary] px-3 mb-3">
                    School Calendars
                  </h2>
                  <SchoolCalendarList
                    calendars={schoolCalendars}
                    onToggle={handleToggleSchoolCalendar}
                  />
                </section>
              )}
            </main>
          </div>
        )}
      </div>

      {/* Course drawer */}
      {openCourseDrawer && (() => {
        const course = courses.find((c) => c.courseName === openCourseDrawer);
        if (!course) return null;
        return (
          <CourseDrawer
            courseName={course.courseName}
            colorId={course.colorId}
            enabled={course.enabled}
            events={course.events}
            courseTypeSettings={derivedCourseTypeSettings.filter(
              (s) => s.courseName === openCourseDrawer
            )}
            onClose={() => setOpenCourseDrawer(null)}
            onToggleCourse={handleToggleCourse}
            onToggleEvent={handleToggleEvent}
            onChangeColor={handleChangeColor}
            onToggleEventType={handleToggleEventType}
            onChangeEventTypeColor={handleChangeEventTypeColor}
          />
        );
      })()}
    </div>
  );
}
