import { NextResponse } from 'next/server';

// This endpoint has been superseded by /api/sync (Plan 02-03).
// Kept as a stub to prevent 404 confusion; clients should migrate to /api/sync.
export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Use /api/sync instead.' },
    { status: 410 }
  );
}
