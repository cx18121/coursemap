import { NextResponse } from 'next/server';
import { syncToGoogleCalendar } from '@/services/gcalSync';

export async function POST(req: Request) {
  try {
    const { accessToken, events, courseColorMap } = await req.json();

    if (!accessToken || !events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: 'Missing required sync parameters: accessToken or events' },
        { status: 400 }
      );
    }

    const map = courseColorMap || {};

    const syncResults = await syncToGoogleCalendar({
      accessToken,
      events,
      courseColorMap: map,
    });

    // Count failures
    const failedCount = syncResults.filter(r => r.action === 'failed').length;

    return NextResponse.json({
      success: true,
      message: `Sync completed. ${syncResults.length - failedCount} successful, ${failedCount} failed.`,
      results: syncResults
    });

  } catch (error: unknown) {
    console.error('Google Calendar Sync API Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to complete synchronization';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
