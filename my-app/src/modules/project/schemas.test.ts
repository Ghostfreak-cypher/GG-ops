import { describe, it, expect } from "vitest";
import { createProjectSchema } from "@/modules/project/schemas";

describe("createProjectSchema", () => {
  it("accepts a valid name", () => {
    expect(createProjectSchema.safeParse({ name: "Website Revamp" }).success).toBe(true);
  });
  it("rejects an empty name", () => {
    expect(createProjectSchema.safeParse({ name: "" }).success).toBe(false);
  });
});
