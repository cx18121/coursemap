import { getCleanedTitle, cleanTitlesBatch } from "./titleCleanup";

// Mock Anthropic SDK
jest.mock("@anthropic-ai/sdk", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn(),
      },
    })),
  };
});

// Mock DB module
jest.mock("@/lib/db", () => ({
  db: {
    query: {
      eventTitleCache: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    },
    insert: jest.fn(),
  },
}));

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

const mockDb = db as {
  query: {
    eventTitleCache: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
  };
  insert: jest.Mock;
};

// Build a chainable insert mock
function buildInsertMock() {
  return {
    values: jest.fn().mockReturnThis(),
    onConflictDoNothing: jest.fn().mockResolvedValue(undefined),
  };
}

// Get the mocked Anthropic constructor
const MockAnthropic = Anthropic as jest.MockedClass<typeof Anthropic>;

describe("getCleanedTitle", () => {
  const ORIGINAL_API_KEY = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.insert.mockReturnValue(buildInsertMock());
    // Default: no cached result
    mockDb.query.eventTitleCache.findFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    // Restore env
    if (ORIGINAL_API_KEY !== undefined) {
      process.env.ANTHROPIC_API_KEY = ORIGINAL_API_KEY;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it("returns cached result without calling AI", async () => {
    mockDb.query.eventTitleCache.findFirst.mockResolvedValue({
      originalTitle: "Submit Assignment [CS 201]",
      cleanedTitle: "Assignment",
    });

    const result = await getCleanedTitle("Submit Assignment [CS 201]");

    expect(result).toBe("Assignment");
    expect(mockDb.insert).not.toHaveBeenCalled();
    // Anthropic should not have been instantiated
    expect(MockAnthropic).not.toHaveBeenCalled();
  });

  it("calls AI when ANTHROPIC_API_KEY is set and title is not cached", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-123";

    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: "text", text: "Quiz 1" }],
    });

    MockAnthropic.mockImplementationOnce(() => ({
      messages: { create: mockCreate },
    }) as unknown as Anthropic);

    const result = await getCleanedTitle("Quiz 1 [Math 101-001 Spring 2026]");

    expect(result).toBe("Quiz 1");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-3-haiku-20240307",
        max_tokens: 80,
      })
    );
    // Should cache the result
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("falls back to regex when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const result = await getCleanedTitle(
      "Submit Assignment: Homework 1 [CS 201-001 Spring 2026]"
    );

    // Regex strips trailing bracket and leading "Submit Assignment: "
    expect(result).toBe("Homework 1");
    expect(MockAnthropic).not.toHaveBeenCalled();
    // Should still cache
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("regex removes trailing brackets", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const result = await getCleanedTitle("Final Exam [Biology 301-002]");

    expect(result).toBe("Final Exam");
  });

  it("regex removes 'Submit ' prefix", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const result = await getCleanedTitle("Submit Midterm Paper [Art 101]");

    expect(result).toBe("Midterm Paper");
  });

  it("falls back to regex when AI call throws", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-123";

    MockAnthropic.mockImplementationOnce(() => ({
      messages: {
        create: jest.fn().mockRejectedValue(new Error("API error")),
      },
    }) as unknown as Anthropic);

    const result = await getCleanedTitle("Quiz 2 [CS 201]");

    // Should fall back to regex
    expect(result).toBe("Quiz 2");
  });

  it("caches the cleaned result in eventTitleCache", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    await getCleanedTitle("Reading Response [History 101]");

    expect(mockDb.insert).toHaveBeenCalled();
    const insertValues = mockDb.insert.mock.results[0].value.values;
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        originalTitle: "Reading Response [History 101]",
        cleanedTitle: "Reading Response",
      })
    );
  });
});

describe("cleanTitlesBatch", () => {
  const ORIGINAL_API_KEY = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
    mockDb.insert.mockReturnValue(buildInsertMock());
    mockDb.query.eventTitleCache.findFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    if (ORIGINAL_API_KEY !== undefined) {
      process.env.ANTHROPIC_API_KEY = ORIGINAL_API_KEY;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it("returns empty object for empty input", async () => {
    mockDb.query.eventTitleCache.findMany.mockResolvedValue([]);

    const result = await cleanTitlesBatch([]);

    expect(result).toEqual({});
  });

  it("uses bulk cache lookup and returns cached titles", async () => {
    mockDb.query.eventTitleCache.findMany.mockResolvedValue([
      { originalTitle: "Quiz 1 [CS 201]", cleanedTitle: "Quiz 1" },
      { originalTitle: "Exam 1 [Math 101]", cleanedTitle: "Exam 1" },
    ]);

    const result = await cleanTitlesBatch([
      "Quiz 1 [CS 201]",
      "Exam 1 [Math 101]",
    ]);

    expect(result["Quiz 1 [CS 201]"]).toBe("Quiz 1");
    expect(result["Exam 1 [Math 101]"]).toBe("Exam 1");
    // findFirst should NOT have been called since we use findMany for batch
    expect(mockDb.query.eventTitleCache.findMany).toHaveBeenCalledTimes(1);
  });

  it("cleans uncached titles via regex (no API key)", async () => {
    // Only one cached; one needs cleaning
    mockDb.query.eventTitleCache.findMany.mockResolvedValue([
      { originalTitle: "Quiz 1 [CS 201]", cleanedTitle: "Quiz 1" },
    ]);
    // getCleanedTitle calls findFirst for uncached titles
    mockDb.query.eventTitleCache.findFirst.mockResolvedValue(null);

    const result = await cleanTitlesBatch([
      "Quiz 1 [CS 201]",
      "Submit Homework 2 [Math 101]",
    ]);

    expect(result["Quiz 1 [CS 201]"]).toBe("Quiz 1");
    expect(result["Submit Homework 2 [Math 101]"]).toBe("Homework 2");
  });

  it("deduplicates duplicate titles in input", async () => {
    mockDb.query.eventTitleCache.findMany.mockResolvedValue([]);
    mockDb.query.eventTitleCache.findFirst.mockResolvedValue(null);

    const result = await cleanTitlesBatch([
      "Quiz 1 [CS 201]",
      "Quiz 1 [CS 201]",
    ]);

    // Only one key in result
    expect(Object.keys(result)).toHaveLength(1);
  });
});
