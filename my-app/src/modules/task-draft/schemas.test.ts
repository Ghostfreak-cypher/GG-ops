import { describe, it, expect } from "vitest";
import { createDraftSchema, approveDraftSchema } from "@/modules/task-draft/schemas";

describe("createDraftSchema", () => {
  const valid = { title: "Follow up on pricing" };

  it("accepts just a title — everything else is optional", () => {
    expect(createDraftSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an empty or missing title", () => {
    expect(createDraftSchema.safeParse({ title: "" }).success).toBe(false);
    expect(createDraftSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a title over 300 characters", () => {
    expect(createDraftSchema.safeParse({ title: "x".repeat(301) }).success).toBe(false);
    expect(createDraftSchema.safeParse({ title: "x".repeat(300) }).success).toBe(true);
  });

  it("rejects due dates that aren't YYYY-MM-DD", () => {
    for (const dueDate of ["18-08-2026", "2026/08/18", "today"]) {
      expect(createDraftSchema.safeParse({ ...valid, dueDate }).success).toBe(false);
    }
  });

  it("allows an explicit null due date", () => {
    expect(createDraftSchema.safeParse({ ...valid, dueDate: null }).success).toBe(true);
  });

  it("bounds confidence to 0-1", () => {
    expect(createDraftSchema.safeParse({ ...valid, confidence: 0.8 }).success).toBe(true);
    expect(createDraftSchema.safeParse({ ...valid, confidence: 1.1 }).success).toBe(false);
    expect(createDraftSchema.safeParse({ ...valid, confidence: -0.1 }).success).toBe(false);
  });
});

describe("approveDraftSchema", () => {
  const valid = {
    projectId: "507f1f77bcf86cd799439011",
    title: "Follow up on pricing",
    priority: "MEDIUM" as const,
  };

  it("accepts a well-formed approval", () => {
    expect(approveDraftSchema.safeParse(valid).success).toBe(true);
  });

  it("requires a project, unlike create", () => {
    expect(approveDraftSchema.safeParse({ ...valid, projectId: "" }).success).toBe(false);
    const { projectId: _projectId, ...withoutProject } = valid;
    expect(approveDraftSchema.safeParse(withoutProject).success).toBe(false);
  });

  it("requires priority — the reviewer confirms it rather than accepting a default", () => {
    const { priority: _priority, ...withoutPriority } = valid;
    expect(approveDraftSchema.safeParse(withoutPriority).success).toBe(false);
  });

  it("rejects a priority outside the enum", () => {
    expect(approveDraftSchema.safeParse({ ...valid, priority: "CRITICAL" }).success).toBe(false);
  });
});
