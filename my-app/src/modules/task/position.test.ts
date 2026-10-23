import { describe, it, expect } from "vitest";
import { nextPosition, reindexPositions, POSITION_STEP } from "@/modules/task/position";

describe("nextPosition", () => {
  it("returns the base step for an empty list", () => {
    expect(nextPosition([])).toBe(POSITION_STEP);
  });

  it("returns max + step (gap-based, order-independent)", () => {
    expect(nextPosition([1000])).toBe(2000);
    expect(nextPosition([1000, 3000, 2000])).toBe(4000);
  });
});

describe("reindexPositions", () => {
  it("assigns evenly spaced positions in order", () => {
    expect(reindexPositions(["a", "b", "c"])).toEqual([
      { id: "a", position: 1000 },
      { id: "b", position: 2000 },
      { id: "c", position: 3000 },
    ]);
  });

  it("handles an empty list", () => {
    expect(reindexPositions([])).toEqual([]);
  });
});
