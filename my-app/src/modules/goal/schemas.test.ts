import { describe, expect, it } from "vitest";
import { createGoalSchema, updateGoalSchema } from "@/modules/goal/schemas";

describe("goal schemas", () => {
  it("create defaults status and progress", () => {
    expect(createGoalSchema.parse({ title: "Ship v1" })).toMatchObject({
      title: "Ship v1",
      status: "ON_TRACK",
      progress: 0,
    });
  });

  // Regression: updateGoalSchema used to be createGoalSchema.partial(), which kept the
  // defaults, so renaming a goal reset its status and progress.
  it("update only carries the fields it was given", () => {
    expect(updateGoalSchema.parse({ title: "Renamed" })).toEqual({ title: "Renamed" });
    expect(updateGoalSchema.parse({ status: "AT_RISK" })).toEqual({ status: "AT_RISK" });
  });
});
