import { describe, it, expect } from "vitest";
import { createTaskSchema, updateTaskSchema } from "@/modules/task/schemas";

describe("createTaskSchema", () => {
  it("accepts a title-only task", () => {
    expect(createTaskSchema.safeParse({ title: "Buy milk" }).success).toBe(true);
  });
  it("rejects an empty title", () => {
    expect(createTaskSchema.safeParse({ title: "" }).success).toBe(false);
  });
  it("accepts optional status/priority", () => {
    const r = createTaskSchema.safeParse({ title: "X", status: "IN_PROGRESS", priority: "HIGH" });
    expect(r.success).toBe(true);
  });
  it("rejects an unknown status", () => {
    expect(createTaskSchema.safeParse({ title: "X", status: "NOPE" }).success).toBe(false);
  });
});

describe("updateTaskSchema", () => {
  it("accepts a partial update", () => {
    expect(updateTaskSchema.safeParse({ status: "DONE" }).success).toBe(true);
  });
  it("accepts dueDate as null (clearing it)", () => {
    expect(updateTaskSchema.safeParse({ dueDate: null }).success).toBe(true);
  });
  it("coerces an ISO dueDate string to a Date", () => {
    const r = updateTaskSchema.safeParse({ dueDate: "2026-02-01" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.dueDate).toBeInstanceOf(Date);
  });
});
