// Mock DB modules before importing the classifier (which imports db at module level)
jest.mock('@/lib/db', () => ({
  db: {
    query: { classifierCache: { findFirst: jest.fn() } },
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        onConflictDoNothing: jest.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));
jest.mock('@/lib/db/schema', () => ({
  classifierCache: { eventNamePattern: 'eventNamePattern', category: 'category' },
}));
jest.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn() },
  }));
  return { __esModule: true, default: MockAnthropic };
});

import { classifyByRegex } from './eventTypeClassifier';

describe('classifyByRegex', () => {
  // --- Assignments ---
  it("returns 'Assignments' for 'Submit Assignment: Homework 1 [CS 201]'", () => {
    expect(classifyByRegex('Submit Assignment: Homework 1 [CS 201]')).toBe('Assignments');
  });

  it("returns 'Assignments' for 'Submit Assignment Homework 1 [CS 201]' (no colon variant)", () => {
    expect(classifyByRegex('Submit Assignment Homework 1 [CS 201]')).toBe('Assignments');
  });

  // --- Quizzes ---
  it("returns 'Quizzes' for 'Quiz 1 [Math 101]'", () => {
    expect(classifyByRegex('Quiz 1 [Math 101]')).toBe('Quizzes');
  });

  it("returns 'Quizzes' for 'Quiz: Chapter 3 [Math 101]'", () => {
    expect(classifyByRegex('Quiz: Chapter 3 [Math 101]')).toBe('Quizzes');
  });

  // --- Discussions ---
  it("returns 'Discussions' for 'Discussion: Week 2 [ENG 100]'", () => {
    expect(classifyByRegex('Discussion: Week 2 [ENG 100]')).toBe('Discussions');
  });

  it("returns 'Discussions' for 'Discussion Week 2 [ENG 100]'", () => {
    expect(classifyByRegex('Discussion Week 2 [ENG 100]')).toBe('Discussions');
  });

  // --- Announcements ---
  it("returns 'Announcements' for 'Announcement: Midterm Reminder [CS 201]'", () => {
    expect(classifyByRegex('Announcement: Midterm Reminder [CS 201]')).toBe('Announcements');
  });

  // --- Exams ---
  it("returns 'Exams' for 'Midterm Exam [CS 201]'", () => {
    expect(classifyByRegex('Midterm Exam [CS 201]')).toBe('Exams');
  });

  it("returns null for 'CS 201 Office Hours' (no known prefix)", () => {
    expect(classifyByRegex('CS 201 Office Hours')).toBeNull();
  });

  // --- safety ---
  it("returns null for empty string — never throws", () => {
    expect(classifyByRegex('')).toBeNull();
  });

  // --- other matched categories ---
  it("returns 'Exams' for 'Exam: Final [CS 201]'", () => {
    expect(classifyByRegex('Exam: Final [CS 201]')).toBe('Exams');
  });

  it("returns 'Labs' for 'Lab Report 2 [CHEM 101]'", () => {
    expect(classifyByRegex('Lab Report 2 [CHEM 101]')).toBe('Labs');
  });

  it("returns 'Lectures' for 'Lecture: Intro to Sorting [CS 201]'", () => {
    expect(classifyByRegex('Lecture: Intro to Sorting [CS 201]')).toBe('Lectures');
  });

  it("returns 'Projects' for 'Project: Final Capstone [CS 201]'", () => {
    expect(classifyByRegex('Project: Final Capstone [CS 201]')).toBe('Projects');
  });
});
