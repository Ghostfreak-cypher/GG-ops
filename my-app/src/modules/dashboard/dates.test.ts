import { describe, it, expect } from "vitest";
import { dueBucket, buildMonthGrid } from "@/modules/dashboard/dates";

describe("dueBucket", () => {
  const now = new Date("2026-06-25T12:00:00Z");
  it("classifies past/today/future and null", () => {
    expect(dueBucket("2026-06-24T00:00:00Z", now)).toBe("OVERDUE");
    expect(dueBucket("2026-06-25T09:00:00Z", now)).toBe("TODAY");
    expect(dueBucket("2026-06-26T00:00:00Z", now)).toBe("UPCOMING");
    expect(dueBucket(null, now)).toBe("NONE");
  });
});

describe("buildMonthGrid", () => {
  it("builds a 42-cell grid starting on the Sunday on/before the 1st", () => {
    const grid = buildMonthGrid(2026, 0); // January 2026 (1st is a Thursday)
    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ iso: "2025-12-28", day: 28, inMonth: false });
    expect(grid[4]).toEqual({ iso: "2026-01-01", day: 1, inMonth: true });
  });
});
