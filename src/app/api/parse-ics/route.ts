import { NextResponse } from 'next/server';
import { parseCanvasFeed } from '@/services/icalParser';

export async function POST(req: Request) {
  try {
    const { feedUrl } = await req.json();

    if (!feedUrl || typeof feedUrl !== 'string') {
      return NextResponse.json(
        { error: 'A valid feedUrl string must be provided format' },
        { status: 400 }
      );
    }

    // Call the parser service
    const groupedEvents = await parseCanvasFeed(feedUrl);

    // Return successfully grouped items
    return NextResponse.json({
      success: true,
      data: groupedEvents
    });

  } catch (error: unknown) {
    console.error('ICS Parsing API Error:', error);

    // Differentiate between known URL format errors and parser errors
    const errorMessage = error instanceof Error ? error.message : 'Failed to parse ICS feed';
    const status = errorMessage.includes('Invalid') ? 400 : 500;

    return NextResponse.json(
      { error: errorMessage },
      { status }
    );
  }
}
