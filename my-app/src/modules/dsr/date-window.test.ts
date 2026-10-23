import { describe, it, expect } from "vitest";
import {
  monthBounds,
  clampDatesToMonth,
  weeksInMonth,
  dsrDateCondition,
} from "@/modules/dsr/date-window";

describe("monthBounds", () => {
  it("returns a half-open range over the month", () => {
    expect(monthBounds("2026-09")).toEqual({ from: "2026-09-01", to: "2026-10-01" });
  });

  it("rolls the year over December", () => {
    expect(monthBounds("2026-12")).toEqual({ from: "2026-12-01", to: "2027-01-01" });
  });

  it("keeps months zero-padded", () => {
    expect(monthBounds("2026-01")).toEqual({ from: "2026-01-01", to: "2026-02-01" });
  });
});

describe("clampDatesToMonth", () => {
  it("drops days from another month", () => {
    // The exact case MonthSwitcher creates: it preserves `?d=` across a month change, so
    // September's days arrive while August is being viewed.
    expect(clampDatesToMonth(["2026-09-03", "2026-08-11"], "2026-08")).toEqual(["2026-08-11"]);
    expect(clampDatesToMonth(["2026-09-03"], "2026-08")).toEqual([]);
  });

  it("keeps the first and last day of the month", () => {
    expect(clampDatesToMonth(["2026-09-01", "2026-09-30"], "2026-09")).toEqual([
      "2026-09-01",
      "2026-09-30",
    ]);
  });

  it("drops a day the month does not have", () => {
    // "2026-09-31" passes the YYYY-MM-DD regex and sorts inside September, so only a real
    // day-count check rejects it.
    expect(clampDatesToMonth(["2026-09-31"], "2026-09")).toEqual([]);
    expect(clampDatesToMonth(["2026-02-29"], "2026-02")).toEqual([]);
    expect(clampDatesToMonth(["2028-02-29"], "2028-02")).toEqual(["2028-02-29"]);
  });

  it("dedupes and sorts", () => {
    expect(clampDatesToMonth(["2026-09-10", "2026-09-02", "2026-09-10"], "2026-09")).toEqual([
      "2026-09-02",
      "2026-09-10",
    ]);
  });
});

describe("weeksInMonth", () => {
  it("clips the first and last week to the month", () => {
    // 1 September 2026 is a Tuesday, so the first week starts mid-week and the last stops
    // on the 30th.
    const weeks = weeksInMonth("2026-09");
    expect(weeks).toHaveLength(5);
    expect(weeks[0].dates[0]).toBe("2026-09-01");
    expect(weeks.at(-1)?.dates.at(-1)).toBe("2026-09-30");
  });

  it("covers every day of the month exactly once", () => {
    // One assertion that catches any off-by-one in the generator, on months that start and
    // end on different weekdays, a short February, and a leap one.
    for (const month of ["2026-09", "2026-10", "2026-02", "2028-02", "2026-11"]) {
      const flat = weeksInMonth(month).flatMap((w) => w.dates);
      const [year, m] = month.split("-").map(Number);
      const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
      const expected = Array.from(
        { length: last },
        (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
      );
      expect(flat).toEqual(expected);
    }
  });

  it("labels a week by its span, and a one-day week by that day", () => {
    expect(weeksInMonth("2026-09")[0].label).toBe("1 – 6 Sep");
    // February 2026 starts on a Sunday, so its first week is that day alone.
    expect(weeksInMonth("2026-02")[0]).toEqual({ label: "1 Feb", dates: ["2026-02-01"] });
  });
});

describe("dsrDateCondition", () => {
  it("uses the month range when no days are selected", () => {
    expect(dsrDateCondition({ month: "2026-09", dates: [] })).toEqual({
      $gte: "2026-09-01",
      $lt: "2026-10-01",
    });
  });

  it("matches exactly the selected days when there are some", () => {
    expect(dsrDateCondition({ month: "2026-09", dates: ["2026-09-02", "2026-09-04"] })).toEqual({
      $in: ["2026-09-02", "2026-09-04"],
    });
  });
});
