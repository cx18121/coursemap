import { getBucket } from '../CountdownPanel';

describe('getBucket', () => {
  // Fix "now" for deterministic tests using jest.useFakeTimers
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 2, 16, 12, 0, 0)); // March 16, 2026 noon
  });
  afterEach(() => jest.useRealTimers());

  it('returns overdue for yesterday', () => {
    expect(getBucket(new Date(2026, 2, 15))).toBe('overdue');
  });

  it('returns overdue for 30 days in the past', () => {
    expect(getBucket(new Date(2026, 1, 14))).toBe('overdue');
  });

  it('returns today for same calendar day (midnight)', () => {
    expect(getBucket(new Date(2026, 2, 16, 0, 0))).toBe('today');
  });

  it('returns today for same calendar day', () => {
    expect(getBucket(new Date(2026, 2, 16, 23, 59))).toBe('today');
  });

  it('returns tomorrow for next day', () => {
    expect(getBucket(new Date(2026, 2, 17))).toBe('tomorrow');
  });

  it('returns this_week for 2 days ahead', () => {
    expect(getBucket(new Date(2026, 2, 18))).toBe('this_week');
  });

  it('returns this_week for 7 days ahead', () => {
    expect(getBucket(new Date(2026, 2, 23))).toBe('this_week');
  });

  it('returns later for 8 days ahead', () => {
    expect(getBucket(new Date(2026, 2, 24))).toBe('later');
  });
});
