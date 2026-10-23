import { describe, it, expect } from "vitest";
import { createSectionSchema } from "@/modules/section/schemas";

describe("createSectionSchema", () => {
  it("accepts a name", () => {
    expect(createSectionSchema.safeParse({ name: "To Do" }).success).toBe(true);
  });
  it("rejects an empty name", () => {
    expect(createSectionSchema.safeParse({ name: "" }).success).toBe(false);
  });
});
