import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { syncJobs } from '../route';

// GET /api/sync/status?jobId=<uuid>
// Returns current sync job state for polling
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
  }

  const job = syncJobs.get(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const response = {
    status: job.status,
    progress: job.progress,
    canvasSummary: job.canvasSummary,
    mirrorSummary: job.mirrorSummary,
    error: job.error,
  };

  // Clean up map entry once terminal state is returned to client
  if (job.status === 'complete' || job.status === 'error') {
    syncJobs.delete(jobId);
  }

  return NextResponse.json(response);
}
