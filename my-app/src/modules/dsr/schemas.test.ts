import { describe, it, expect } from "vitest";
import { upsertDsrSchema, deleteDsrSchema, dsrMonthSchema } from "@/modules/dsr/schemas";

const valid = {
  date: "2026-08-18",
  entries: [
    { task: "Shipped the invite flow", minutes: 150 },
    { task: "Cleared the review comments", minutes: 75 },
  ],
  tomorrowPlan: "Start on the roster aggregation.",
};

describe("upsertDsrSchema", () => {
  it("accepts a well-formed report", () => {
    const result = upsertDsrSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects dates that aren't YYYY-MM-DD", () => {
    for (const date of ["18-08-2026", "2026/08/18", "2026-8-18", "today", ""]) {
      expect(upsertDsrSchema.safeParse({ ...valid, date }).success).toBe(false);
    }
  });

  it("requires the tomorrow plan to say something", () => {
    expect(upsertDsrSchema.safeParse({ ...valid, tomorrowPlan: "" }).success).toBe(false);
    expect(upsertDsrSchema.safeParse({ ...valid, tomorrowPlan: "   " }).success).toBe(false);
  });

  it("rejects a tomorrow plan longer than 4000 characters", () => {
    expect(upsertDsrSchema.safeParse({ ...valid, tomorrowPlan: "x".repeat(4001) }).success).toBe(false);
    expect(upsertDsrSchema.safeParse({ ...valid, tomorrowPlan: "x".repeat(4000) }).success).toBe(true);
  });

  it("requires at least one thing done", () => {
    expect(upsertDsrSchema.safeParse({ ...valid, entries: [] }).success).toBe(false);
  });

  it("caps the log at 20 items", () => {
    const row = { task: "Standup", minutes: 5 };
    expect(upsertDsrSchema.safeParse({ ...valid, entries: Array(20).fill(row) }).success).toBe(true);
    expect(upsertDsrSchema.safeParse({ ...valid, entries: Array(21).fill(row) }).success).toBe(false);
  });

  it("requires every item to describe something", () => {
    const entries = [{ task: "   ", minutes: 30 }];
    expect(upsertDsrSchema.safeParse({ ...valid, entries }).success).toBe(false);
  });

  it("trims each item's task", () => {
    const entries = [{ task: "  Fixed the bug.  ", minutes: 30 }];
    const result = upsertDsrSchema.safeParse({ ...valid, entries });
    expect(result.success && result.data.entries[0].task).toBe("Fixed the bug.");
  });

  it("requires time against every item", () => {
    expect(upsertDsrSchema.safeParse({ ...valid, entries: [{ task: "Standup", minutes: 0 }] }).success).toBe(false);
    expect(upsertDsrSchema.safeParse({ ...valid, entries: [{ task: "Standup", minutes: 1 }] }).success).toBe(true);
  });

  it("rejects fractional minutes", () => {
    const entries = [{ task: "Standup", minutes: 12.5 }];
    expect(upsertDsrSchema.safeParse({ ...valid, entries }).success).toBe(false);
  });

  // The form holds its two time boxes as strings and combines them into a number, but
  // coercion means a stray string still lands as a number rather than a type error.
  it("coerces a numeric string for minutes", () => {
    const entries = [{ task: "Standup", minutes: "90" }];
    const result = upsertDsrSchema.safeParse({ ...valid, entries });
    expect(result.success && result.data.entries[0].minutes).toBe(90);
  });

  it("rejects minutes that aren't a number at all", () => {
    const entries = [{ task: "Standup", minutes: "all day" }];
    expect(upsertDsrSchema.safeParse({ ...valid, entries }).success).toBe(false);
  });

  // Each row passes its own cap here; only the sum catches the impossible day.
  it("rejects rows that add up to more than 24 hours", () => {
    const entries = [
      { task: "Migration", minutes: 23 * 60 },
      { task: "Retro", minutes: 2 * 60 },
    ];
    expect(upsertDsrSchema.safeParse({ ...valid, entries }).success).toBe(false);
  });

  it("accepts a day that adds up to exactly 24 hours", () => {
    const entries = [
      { task: "Migration", minutes: 23 * 60 },
      { task: "Retro", minutes: 60 },
    ];
    expect(upsertDsrSchema.safeParse({ ...valid, entries }).success).toBe(true);
  });

  /**
   * Only the *shape* of a linked task id is checked here. Whether that id names a task in
   * the report's own workspace is `upsertDsrFor`'s job — it's the only layer that knows
   * whose report this is, and it's the check that stops a cross-workspace link.
   */
  describe("linked task ids", () => {
    const withTaskId = (taskId: unknown) => ({
      ...valid,
      entries: [{ task: "Fixed the checkout timeout", minutes: 90, taskId }],
    });

    it("accepts a well-formed ObjectId", () => {
      expect(upsertDsrSchema.safeParse(withTaskId("507f1f77bcf86cd799439011")).success).toBe(true);
    });

    it("treats an absent, null, or undefined id as unlinked", () => {
      // No key at all — every entry filed before linking existed.
      expect(upsertDsrSchema.safeParse(valid).success).toBe(true);
      // The form sends null to unlink a row; MCP omits the field entirely.
      expect(upsertDsrSchema.safeParse(withTaskId(null)).success).toBe(true);
      expect(upsertDsrSchema.safeParse(withTaskId(undefined)).success).toBe(true);
    });

    it("rejects anything that isn't an ObjectId", () => {
      // "" and a 23-char hex string matter most: both are close enough to reach a query.
      for (const bad of ["", "not-an-id", "507f1f77bcf86cd79943901", "507f1f77bcf86cd799439011x"]) {
        expect(upsertDsrSchema.safeParse(withTaskId(bad)).success, bad).toBe(false);
      }
    });

    it("keeps the id on the parsed output", () => {
      const result = upsertDsrSchema.safeParse(withTaskId("507f1f77bcf86cd799439011"));
      expect(result.success && result.data.entries[0]?.taskId).toBe("507f1f77bcf86cd799439011");
    });
  });
});

describe("deleteDsrSchema", () => {
  it("requires a non-empty id", () => {
    expect(deleteDsrSchema.safeParse({ dsrId: "abc" }).success).toBe(true);
    expect(deleteDsrSchema.safeParse({ dsrId: "" }).success).toBe(false);
  });
});

describe("dsrMonthSchema", () => {
  it("accepts a YYYY-MM month or nothing at all", () => {
    expect(dsrMonthSchema.safeParse({ month: "2026-08" }).success).toBe(true);
    expect(dsrMonthSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a malformed month", () => {
    expect(dsrMonthSchema.safeParse({ month: "2026-8" }).success).toBe(false);
    expect(dsrMonthSchema.safeParse({ month: "August" }).success).toBe(false);
  });

  it("strips unknown search params", () => {
    const result = dsrMonthSchema.safeParse({ month: "2026-08", userId: "sneaky" });
    expect(result.success && result.data).toEqual({ month: "2026-08", d: [], take: 7 });
  });
});

describe("dsrMonthSchema day filter", () => {
  const days = (input: unknown) => {
    const result = dsrMonthSchema.safeParse(input);
    return result.success ? result.data.d : null;
  };

  it("normalises one `?d=` and several to the same shape", () => {
    expect(days({ d: "2026-09-04" })).toEqual(["2026-09-04"]);
    expect(days({ d: ["2026-09-04", "2026-09-05"] })).toEqual(["2026-09-04", "2026-09-05"]);
    expect(days({})).toEqual([]);
  });

  it("drops a malformed day without losing the valid ones or the month", () => {
    const result = dsrMonthSchema.safeParse({
      month: "2026-09",
      d: ["2026-09-04", "not-a-date", "2026-09-05"],
    });
    expect(result.success && result.data).toEqual({
      month: "2026-09",
      d: ["2026-09-04", "2026-09-05"],
      take: 7,
    });
  });
});

describe("dsrMonthSchema take", () => {
  const take = (input: unknown) => {
    const result = dsrMonthSchema.safeParse(input);
    return result.success ? result.data.take : null;
  };

  it("defaults to a page and coerces the string the URL carries", () => {
    expect(take({})).toBe(7);
    expect(take({ take: "14" })).toBe(14);
  });

  it("falls back rather than failing the parse, so junk can't cost the reader their month", () => {
    const result = dsrMonthSchema.safeParse({ month: "2026-09", take: "abc" });
    expect(result.success && result.data.month).toBe("2026-09");
    expect(result.success && result.data.take).toBe(7);
  });

  it("clamps out-of-range values", () => {
    expect(take({ take: "0" })).toBe(7);
    expect(take({ take: "100000" })).toBe(7);
  });
});
