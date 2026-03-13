// Mock out heavy dependencies before importing route.ts
jest.mock('@/lib/db', () => ({
  db: { query: { users: { findFirst: jest.fn() } } },
}));
jest.mock('@/lib/session', () => ({
  getSession: jest.fn(),
}));
jest.mock('@/services/icalParser', () => ({ parseCanvasFeed: jest.fn() }));
jest.mock('@/services/syncFilter', () => ({ filterEventsForSync: jest.fn() }));
jest.mock('@/services/colorAssignment', () => ({ assignCourseColors: jest.fn() }));
jest.mock('@/services/gcalSync', () => ({ syncCanvasEvents: jest.fn() }));
jest.mock('@/services/schoolMirror', () => ({ mirrorSchoolCalendars: jest.fn() }));

import { classifyError } from '../route';

describe('classifyError', () => {
  test('returns reconnect message for "Invalid Credentials"', () => {
    const err = new Error('Invalid Credentials');
    const result = classifyError(err);
    expect(result).toMatch(/reconnect/i);
  });

  test('returns reconnect message for "invalid_grant"', () => {
    const err = new Error('invalid_grant: token has been expired or revoked');
    const result = classifyError(err);
    expect(result).toMatch(/reconnect/i);
  });

  test('returns quota/wait message for "Rate Limit Exceeded"', () => {
    const err = new Error('Rate Limit Exceeded');
    const result = classifyError(err);
    expect(result).toMatch(/quota/i);
    expect(result).toMatch(/wait/i);
  });

  test('returns quota message for "quotaExceeded"', () => {
    const err = new Error('quotaExceeded: Calendar quota exceeded');
    const result = classifyError(err);
    expect(result).toMatch(/quota/i);
  });

  test('returns quota message for "Calendar usage limits exceeded"', () => {
    const err = new Error('Calendar usage limits exceeded');
    const result = classifyError(err);
    expect(result).toMatch(/quota/i);
  });

  test('returns Canvas feed / ICS URL message for error containing "fetch"', () => {
    const err = new Error('Failed to fetch the resource');
    const result = classifyError(err);
    expect(result).toMatch(/Canvas feed/i);
    expect(result).toMatch(/ICS URL/i);
  });

  test('returns Canvas feed / ICS URL message for error containing "canvas"', () => {
    const err = new Error('canvas request failed');
    const result = classifyError(err);
    expect(result).toMatch(/Canvas feed/i);
    expect(result).toMatch(/ICS URL/i);
  });

  test('returns generic Sync failed for unknown error', () => {
    const err = new Error('Something completely unknown happened');
    const result = classifyError(err);
    expect(result).toBe('Sync failed: Something completely unknown happened');
  });

  test('returns Sync failed with string when non-Error is passed', () => {
    const result = classifyError('plain string error');
    expect(result).toBe('Sync failed: plain string error');
  });
});
