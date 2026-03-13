import {
  assignCourseColors,
  GOOGLE_CALENDAR_COLORS,
} from "./colorAssignment";

// Mock the DB module
jest.mock("@/lib/db", () => ({
  db: {
    query: {
      courseSelections: {
        findMany: jest.fn(),
      },
    },
    insert: jest.fn(),
  },
}));

import { db } from "@/lib/db";

const mockDb = db as {
  query: { courseSelections: { findMany: jest.Mock } };
  insert: jest.Mock;
};

// Build a chainable insert mock
function buildInsertMock() {
  const chain = {
    values: jest.fn().mockReturnThis(),
    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
  };
  return chain;
}

describe("GOOGLE_CALENDAR_COLORS", () => {
  it("has exactly 11 colors", () => {
    expect(Object.keys(GOOGLE_CALENDAR_COLORS)).toHaveLength(11);
  });

  it("maps colorId strings '1' through '11'", () => {
    for (let i = 1; i <= 11; i++) {
      expect(GOOGLE_CALENDAR_COLORS[String(i)]).toBeDefined();
    }
  });

  it("includes expected color names", () => {
    expect(GOOGLE_CALENDAR_COLORS["1"]).toBe("Lavender");
    expect(GOOGLE_CALENDAR_COLORS["9"]).toBe("Blueberry");
    expect(GOOGLE_CALENDAR_COLORS["11"]).toBe("Tomato");
  });
});

describe("assignCourseColors", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const insertChain = buildInsertMock();
    mockDb.insert.mockReturnValue(insertChain);
  });

  it("returns empty object for empty course list", async () => {
    mockDb.query.courseSelections.findMany.mockResolvedValue([]);

    const result = await assignCourseColors(1, []);

    expect(result).toEqual({});
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("assigns distinct colorIds to new courses", async () => {
    mockDb.query.courseSelections.findMany.mockResolvedValue([]);

    const result = await assignCourseColors(1, ["Math 101", "CS 201", "History 101"]);

    const assigned = Object.values(result);
    // All colorIds should be distinct
    expect(new Set(assigned).size).toBe(3);
    // All should be valid Google Calendar colorIds
    assigned.forEach((id) => {
      expect(GOOGLE_CALENDAR_COLORS[id]).toBeDefined();
    });
  });

  it("preserves existing colorIds for courses already in DB", async () => {
    mockDb.query.courseSelections.findMany.mockResolvedValue([
      { courseName: "Math 101", colorId: "3" },
      { courseName: "CS 201", colorId: "7" },
    ]);

    const result = await assignCourseColors(1, ["Math 101", "CS 201", "History 101"]);

    // Existing courses keep their color
    expect(result["Math 101"]).toBe("3");
    expect(result["CS 201"]).toBe("7");
    // New course gets a different colorId
    expect(result["History 101"]).toBeDefined();
    expect(result["History 101"]).not.toBe("3");
    expect(result["History 101"]).not.toBe("7");
  });

  it("assigns colors that avoid already-used colorIds", async () => {
    // Existing courses using colorIds 1-8
    const existingSelections = Array.from({ length: 8 }, (_, i) => ({
      courseName: `Course ${i + 1}`,
      colorId: String(i + 1),
    }));
    mockDb.query.courseSelections.findMany.mockResolvedValue(existingSelections);

    const result = await assignCourseColors(1, [
      ...existingSelections.map((c) => c.courseName),
      "New Course A",
      "New Course B",
      "New Course C",
    ]);

    // New courses should get colorIds 9, 10, 11 (the remaining unused ones)
    const newAssigned = ["New Course A", "New Course B", "New Course C"].map(
      (name) => result[name]
    );
    expect(newAssigned).toContain("9");
    expect(newAssigned).toContain("10");
    expect(newAssigned).toContain("11");
  });

  it("round-robins from beginning if all 11 colorIds are used", async () => {
    // All 11 slots taken
    const existingSelections = Array.from({ length: 11 }, (_, i) => ({
      courseName: `Course ${i + 1}`,
      colorId: String(i + 1),
    }));
    mockDb.query.courseSelections.findMany.mockResolvedValue(existingSelections);

    const result = await assignCourseColors(1, [
      ...existingSelections.map((c) => c.courseName),
      "Extra Course",
    ]);

    // Extra course should get a valid colorId (round-robin from beginning)
    expect(GOOGLE_CALENDAR_COLORS[result["Extra Course"]]).toBeDefined();
  });

  it("upserts new courses via db.insert", async () => {
    mockDb.query.courseSelections.findMany.mockResolvedValue([]);

    await assignCourseColors(1, ["Math 101"]);

    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("does not call db.insert if all courses already have assignments", async () => {
    mockDb.query.courseSelections.findMany.mockResolvedValue([
      { courseName: "Math 101", colorId: "5" },
    ]);

    await assignCourseColors(1, ["Math 101"]);

    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
