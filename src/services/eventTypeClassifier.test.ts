import { classifyEventType, CanvasEventType } from './eventTypeClassifier';

describe('classifyEventType', () => {
  // --- assignment ---
  it("returns 'assignment' for 'Submit Assignment: Homework 1 [CS 201]'", () => {
    expect(classifyEventType('Submit Assignment: Homework 1 [CS 201]')).toBe('assignment');
  });

  it("returns 'assignment' for 'Submit Assignment Homework 1 [CS 201]' (no colon variant)", () => {
    expect(classifyEventType('Submit Assignment Homework 1 [CS 201]')).toBe('assignment');
  });

  // --- quiz ---
  it("returns 'quiz' for 'Quiz 1 [Math 101]'", () => {
    expect(classifyEventType('Quiz 1 [Math 101]')).toBe('quiz');
  });

  it("returns 'quiz' for 'Quiz: Chapter 3 [Math 101]'", () => {
    expect(classifyEventType('Quiz: Chapter 3 [Math 101]')).toBe('quiz');
  });

  // --- discussion ---
  it("returns 'discussion' for 'Discussion: Week 2 [ENG 100]'", () => {
    expect(classifyEventType('Discussion: Week 2 [ENG 100]')).toBe('discussion');
  });

  it("returns 'discussion' for 'Discussion Week 2 [ENG 100]'", () => {
    expect(classifyEventType('Discussion Week 2 [ENG 100]')).toBe('discussion');
  });

  // --- announcement ---
  it("returns 'announcement' for 'Announcement: Midterm Reminder [CS 201]'", () => {
    expect(classifyEventType('Announcement: Midterm Reminder [CS 201]')).toBe('announcement');
  });

  // --- event (catch-all) ---
  it("returns 'event' for 'Midterm Exam [CS 201]' (catch-all)", () => {
    expect(classifyEventType('Midterm Exam [CS 201]')).toBe('event');
  });

  it("returns 'event' for 'CS 201 Office Hours' (no bracket prefix)", () => {
    expect(classifyEventType('CS 201 Office Hours')).toBe('event');
  });

  // --- safety ---
  it("returns 'event' for empty string — never throws", () => {
    expect(classifyEventType('')).toBe('event');
  });

  // --- exhaustiveness / type contract ---
  it('always returns one of the 5 CanvasEventType literal values', () => {
    const validTypes: CanvasEventType[] = ['assignment', 'quiz', 'discussion', 'announcement', 'event'];
    const inputs = [
      'Submit Assignment: HW1 [CS 201]',
      'Quiz 1 [Math 101]',
      'Discussion: Week 2 [ENG 100]',
      'Announcement: Midterm [CS 201]',
      'Random Event [HIST 300]',
      '',
      'anything goes here',
    ];
    for (const input of inputs) {
      const result = classifyEventType(input);
      expect(validTypes).toContain(result);
    }
  });
});
