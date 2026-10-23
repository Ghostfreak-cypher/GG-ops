import { describe, it, expect } from "vitest";
import { formatDuration, splitDuration } from "@/modules/dsr/format";

describe("formatDuration", () => {
  it("drops the minutes on a whole hour", () => {
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(480)).toBe("8h");
  });

  it("drops the hours below an hour", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(1)).toBe("1m");
  });

  it("shows both parts when there are both", () => {
    expect(formatDuration(150)).toBe("2h 30m");
    expect(formatDuration(285)).toBe("4h 45m");
  });

  it("renders zero as 0m rather than an empty string", () => {
    expect(formatDuration(0)).toBe("0m");
  });

  it("handles a full day", () => {
    expect(formatDuration(1440)).toBe("24h");
  });
});

describe("splitDuration", () => {
  it("splits into hours and remaining minutes", () => {
    expect(splitDuration(150)).toEqual({ hours: 2, minutes: 30 });
    expect(splitDuration(45)).toEqual({ hours: 0, minutes: 45 });
    expect(splitDuration(120)).toEqual({ hours: 2, minutes: 0 });
    expect(splitDuration(0)).toEqual({ hours: 0, minutes: 0 });
  });

  // The form splits a stored duration into two boxes and recombines them on submit, so a
  // value that doesn't survive that trip would silently change someone's logged time.
  it("round-trips back to the same minute count", () => {
    for (const total of [0, 1, 45, 60, 90, 150, 285, 599, 1440]) {
      const { hours, minutes } = splitDuration(total);
      expect(hours * 60 + minutes).toBe(total);
    }
  });
});
