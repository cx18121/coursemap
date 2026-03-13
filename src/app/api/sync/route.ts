import { NextResponse, after } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { parseCanvasFeed } from '@/services/icalParser';
import { filterEventsForSync } from '@/services/syncFilter';
import { assignCourseColors } from '@/services/colorAssignment';
import { syncCanvasEvents, type SyncProgress, type SyncSummary } from '@/services/gcalSync';
import { mirrorSchoolCalendars, type MirrorSummary } from '@/services/schoolMirror';

export interface SyncJobState {
  status: 'running' | 'complete' | 'error';
  progress: SyncProgress[];
  canvasSummary?: SyncSummary;
  mirrorSummary?: MirrorSummary;
  error?: string;
  completedAt?: number; // epoch ms for TTL cleanup
}

// In-memory store for sync jobs. Acceptable for manual sync — no concurrent
// sync jobs per user, and progress is acceptable to lose on server restart.
export const syncJobs = new Map<string, SyncJobState>();

// Classify an error into a user-facing actionable message.
export function classifyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes('invalid credentials') || lower.includes('invalid_grant') || lower.includes('no access token')) {
    return 'Your Google account connection has expired. Go to Settings and reconnect your account.';
  }

  if (lower.includes('rate limit') || lower.includes('quota') || lower.includes('usagelimits') || lower.includes('usage limits')) {
    return 'Google Calendar quota exceeded. Please wait a few minutes and try again.';
  }

  if (lower.includes('canvas') || lower.includes('ics') || lower.includes('fetch')) {
    return 'Could not fetch your Canvas feed. Check that the ICS URL is still valid in Settings.';
  }

  return `Sync failed: ${msg}`;
}

// Clean up completed jobs older than 5 minutes
function pruneOldJobs() {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const [jobId, job] of syncJobs.entries()) {
    if (
      (job.status === 'complete' || job.status === 'error') &&
      job.completedAt !== undefined &&
      job.completedAt < fiveMinutesAgo
    ) {
      syncJobs.delete(jobId);
    }
  }
}

async function runSyncJob(jobId: string, userId: number, canvasIcsUrl: string) {
  const job = syncJobs.get(jobId);
  if (!job) return;

  try {
    // Step 1: Parse Canvas feed
    const groupedEvents = await parseCanvasFeed(canvasIcsUrl);
    const courseNames = Object.keys(groupedEvents);

    // Step 2: Filter events by user selections
    const filteredEvents = await filterEventsForSync(userId, groupedEvents);

    // Step 3: Get color map for the courses
    const colorMap = await assignCourseColors(userId, courseNames);

    // Step 4: Sync Canvas events to Google Calendar
    const canvasSummary = await syncCanvasEvents(
      userId,
      filteredEvents,
      colorMap,
      (progress: SyncProgress) => {
        // Store latest progress for this course
        const existingIdx = job.progress.findIndex(
          (p) => p.courseName === progress.courseName
        );
        if (existingIdx >= 0) {
          job.progress[existingIdx] = progress;
        } else {
          job.progress.push(progress);
        }
      }
    );

    // Step 5: Mirror school calendars
    const mirrorSummary = await mirrorSchoolCalendars(userId, (_calendarName, processed, total) => {
      const mirrorProgress: SyncProgress = {
        courseName: `[School Mirror]`,
        processed,
        total,
      };
      const existingIdx = job.progress.findIndex(
        (p) => p.courseName === '[School Mirror]'
      );
      if (existingIdx >= 0) {
        job.progress[existingIdx] = mirrorProgress;
      } else {
        job.progress.push(mirrorProgress);
      }
    });

    // Mark complete
    job.status = 'complete';
    job.canvasSummary = canvasSummary;
    job.mirrorSummary = mirrorSummary;
    job.completedAt = Date.now();
  } catch (err: unknown) {
    job.status = 'error';
    job.error = classifyError(err);
    job.completedAt = Date.now();
  }
}

// POST /api/sync
// Starts a background sync job and returns jobId with 202 Accepted
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.userId;

  // Fetch user's Canvas ICS URL
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user?.canvasIcsUrl) {
    return NextResponse.json(
      { error: 'No Canvas feed URL configured' },
      { status: 400 }
    );
  }

  // Generate unique job ID
  const jobId = crypto.randomUUID();

  // Initialize job state
  const jobState: SyncJobState = {
    status: 'running',
    progress: [],
  };
  syncJobs.set(jobId, jobState);

  // Clean up old completed jobs periodically
  pruneOldJobs();

  // Use after() to run sync after response is sent — ensures background sync
  // completes on Vercel (void promise would be killed when response closes).
  // Errors are caught inside runSyncJob and recorded in job state.
  after(runSyncJob(jobId, userId, user.canvasIcsUrl));

  return NextResponse.json({ jobId }, { status: 202 });
}
