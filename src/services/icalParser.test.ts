import { parseCanvasFeed, CanvasEvent } from './icalParser';
import ical from 'node-ical';

jest.mock('./eventTypeClassifier', () => ({
  classifyEventsWithCache: jest.fn(async (summaries: string[]) => {
    const map = new Map<string, string>();
    for (const s of summaries) {
      if (/quiz/i.test(s)) map.set(s, 'Quizzes');
      else if (/submit\s+assignment/i.test(s)) map.set(s, 'Assignments');
      else if (/discussion/i.test(s)) map.set(s, 'Discussions');
      else if (/announcement/i.test(s)) map.set(s, 'Announcements');
      else map.set(s, 'Events');
    }
    return map;
  }),
}));

jest.mock('node-ical', () => {
  return {
    __esModule: true,
    default: {
      async: {
        fromURL: jest.fn(),
      },
    },
  };
});

// Satisfy TypeScript — CanvasEvent is used implicitly via parseCanvasFeed return type
type _Unused = CanvasEvent;

describe('icalParser Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch and parse a Canvas ICS feed and return grouped events', async () => {
    // Mock the response from node-ical
    const mockIcalData = {
      'event-1': {
        type: 'VEVENT',
        uid: 'event-1',
        summary: 'Quiz 1 [Math 101]',
        start: new Date('2026-03-12T10:00:00Z'),
        end: new Date('2026-03-12T11:00:00Z'),
        description: 'First quiz',
      },
      'event-2': {
        type: 'VEVENT',
        uid: 'event-2',
        summary: 'Final Exam [Science 202]',
        start: new Date('2026-05-15T08:00:00Z'),
        end: new Date('2026-05-15T10:00:00Z'),
        description: 'Comprehensive exam',
      },
      'ignored-item': {
        type: 'VTODO',
        summary: 'Ignored',
      },
      'event-3-no-course': {
        type: 'VEVENT',
        uid: 'event-3',
        summary: 'Personal Event',
        start: new Date('2026-04-01T12:00:00Z'),
        end: new Date('2026-04-01T13:00:00Z'),
        description: 'Should be classified as Unknown Course',
      }
    };

    (ical.async.fromURL as jest.Mock).mockResolvedValue(mockIcalData);

    const testUrl = 'https://canvas.example.edu/feeds/calendars/user_xxxxx.ics';
    const result = await parseCanvasFeed(testUrl);

    // Verify it called the correct URL
    expect(ical.async.fromURL).toHaveBeenCalledWith(testUrl);

    // Verify properties of the result grouping
    expect(Object.keys(result)).toHaveLength(3);

    // Check Math 101 Course grouping
    expect(result['Math 101']).toBeDefined();
    expect(result['Math 101'][0].summary).toBe('Quiz 1 [Math 101]');
    expect(result['Math 101'][0].courseName).toBe('Math 101');
    expect(result['Math 101'][0].eventType).toBe('Quizzes');

    // Check Science 202 Course grouping
    expect(result['Science 202']).toBeDefined();
    expect(result['Science 202'][0].eventType).toBe('Events');

    // Check Unknown Course grouping fallback
    expect(result['Unknown Course']).toBeDefined();
    expect(result['Unknown Course'][0].summary).toBe('Personal Event');
    expect(result['Unknown Course'][0].eventType).toBe('Events');
  });

  it('should classify assignment events correctly', async () => {
    const mockIcalData = {
      'event-assign': {
        type: 'VEVENT',
        uid: 'event-assign',
        summary: 'Submit Assignment: Problem Set 1 [CS 201]',
        start: new Date('2026-04-10T23:59:00Z'),
        end: new Date('2026-04-10T23:59:00Z'),
        description: 'Problem set submission',
      },
    };

    (ical.async.fromURL as jest.Mock).mockResolvedValue(mockIcalData);

    const testUrl = 'https://canvas.example.edu/feeds/calendars/user_xxxxx.ics';
    const result = await parseCanvasFeed(testUrl);

    expect(result['CS 201']).toBeDefined();
    expect(result['CS 201'][0].eventType).toBe('Assignments');
  });

  it('should throw an error if the URL is invalid', async () => {
    await expect(parseCanvasFeed('not-a-url')).rejects.toThrow('Invalid feed URL');
  });
});
