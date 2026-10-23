import { describe, it, expect } from "vitest";
import { createLabelSchema } from "@/modules/label/schemas";

describe("createLabelSchema", () => {
  it("accepts a name (and optional color)", () => {
    expect(createLabelSchema.safeParse({ name: "Bug" }).success).toBe(true);
    expect(createLabelSchema.safeParse({ name: "Bug", color: "#f00" }).success).toBe(true);
  });
  it("rejects an empty name", () => {
    expect(createLabelSchema.safeParse({ name: "" }).success).toBe(false);
  });
});
