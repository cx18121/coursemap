import { filterEventsForSync, ensureCourseSelections } from "./syncFilter";
import type { GroupedEvents } from "./icalParser";

// Mock the DB module
jest.mock("@/lib/db", () => ({
  db: {
    query: {
      courseSelections: {
        findMany: jest.fn(),
      },
      eventOverrides: {
        findMany: jest.fn(),
      },
    },
    insert: jest.fn(),
  },
}));

import { db } from "@/lib/db";

const mockDb = db as {
  query: {
    courseSelections: { findMany: jest.Mock };
    eventOverrides: { findMany: jest.Mock };
  };
  insert: jest.Mock;
};

const makeEvent = (uid: string, courseName: string) => ({
  summary: `Event ${uid}`,
  description: "",
  start: new Date("2026-03-01T10:00:00Z"),
  end: new Date("2026-03-01T11:00:00Z"),
  courseName,
  uid,
});

const groupedEvents: GroupedEvents = {
  "Math 101": [makeEvent("uid-1", "Math 101"), makeEvent("uid-2", "Math 101")],
  "CS 201": [makeEvent("uid-3", "CS 201"), makeEvent("uid-4", "CS 201")],
  "History 101": [makeEvent("uid-5", "History 101")],
};

describe("filterEventsForSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no overrides
    mockDb.query.eventOverrides.findMany.mockResolvedValue([]);
  });

  it("includes all events when no course selections exist (auto-include default)", async () => {
    mockDb.query.courseSelections.findMany.mockResolvedValue([]);

    const result = await filterEventsForSync(1, groupedEvents);

    // All 5 events should be included
    expect(result).toHaveLength(5);
  });

  it("includes events for enabled courses", async () => {
    mockDb.query.courseSelections.findMany.mockResolvedValue([
      { courseName: "Math 101", enabled: true },
      { courseName: "CS 201", enabled: true },
    ]);

    const result = await filterEventsForSync(1, groupedEvents);

    // History 101 has no row so it defaults to enabled — all 5 events included
    expect(result).toHaveLength(5);
  });

  it("excludes ALL events from a disabled course", async () => {
    mockDb.query.courseSelections.findMany.mockResolvedValue([
      { courseName: "Math 101", enabled: false },
    ]);

    const result = await filterEventsForSync(1, groupedEvents);

    // Math 101 (2 events) should be excluded; CS 201 (2) and History 101 (1) included
    expect(result).toHaveLength(3);
    expect(result.map((e) => e.courseName)).not.toContain("Math 101");
  });

  it("excludes individual events via eventOverrides when enabled=false", async () => {
    mockDb.query.courseSelections.findMany.mockResolvedValue([
      { courseName: "CS 201", enabled: true },
    ]);
    mockDb.query.eventOverrides.findMany.mockResolvedValue([
      { eventUid: "uid-3", enabled: false },
    ]);

    const result = await filterEventsForSync(1, groupedEvents);

    // uid-3 from CS 201 excluded; uid-4 from CS 201 still included
    const uids = result.map((e) => e.uid);
    expect(uids).not.toContain("uid-3");
    expect(uids).toContain("uid-4");
  });

  it("does NOT exclude an event if its eventOverride has enabled=true", async () => {
    mockDb.query.courseSelections.findMany.mockResolvedValue([]);
    mockDb.query.eventOverrides.findMany.mockResolvedValue([
      { eventUid: "uid-1", enabled: true },
    ]);

    const result = await filterEventsForSync(1, groupedEvents);

    // uid-1 still included (override explicitly enables it)
    const uids = result.map((e) => e.uid);
    expect(uids).toContain("uid-1");
    expect(result).toHaveLength(5);
  });

  it("excludes event via override even when its course is enabled", async () => {
    mockDb.query.courseSelections.findMany.mockResolvedValue([
      { courseName: "Math 101", enabled: true },
    ]);
    mockDb.query.eventOverrides.findMany.mockResolvedValue([
      { eventUid: "uid-1", enabled: false },
    ]);

    const result = await filterEventsForSync(1, groupedEvents);

    const uids = result.map((e) => e.uid);
    expect(uids).not.toContain("uid-1");
    expect(uids).toContain("uid-2"); // other Math 101 event still in
  });

  it("returns empty array when all courses are disabled", async () => {
    mockDb.query.courseSelections.findMany.mockResolvedValue([
      { courseName: "Math 101", enabled: false },
      { courseName: "CS 201", enabled: false },
      { courseName: "History 101", enabled: false },
    ]);

    const result = await filterEventsForSync(1, groupedEvents);

    expect(result).toHaveLength(0);
  });

  it("handles empty groupedEvents", async () => {
    mockDb.query.courseSelections.findMany.mockResolvedValue([]);

    const result = await filterEventsForSync(1, {});

    expect(result).toHaveLength(0);
  });
});

describe("ensureCourseSelections", () => {
  const mockInsert = jest.fn().mockReturnValue({
    values: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.insert.mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    });
  });

  it("inserts new courses not yet in DB", async () => {
    mockDb.query.courseSelections.findMany.mockResolvedValue([
      { courseName: "Math 101" },
    ]);

    await ensureCourseSelections(1, ["Math 101", "CS 201", "History 101"]);

    // db.insert should have been called (for CS 201 and History 101)
    expect(mockDb.insert).toHaveBeenCalled();
    const insertValues = mockDb.insert.mock.results[0].value.values;
    expect(insertValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ courseName: "CS 201" }),
        expect.objectContaining({ courseName: "History 101" }),
      ])
    );
  });

  it("does nothing when all courses already exist", async () => {
    mockDb.query.courseSelections.findMany.mockResolvedValue([
      { courseName: "Math 101" },
      { courseName: "CS 201" },
    ]);

    await ensureCourseSelections(1, ["Math 101", "CS 201"]);

    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("does nothing for empty course list", async () => {
    mockDb.query.courseSelections.findMany.mockResolvedValue([]);

    await ensureCourseSelections(1, []);

    expect(mockDb.query.courseSelections.findMany).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
