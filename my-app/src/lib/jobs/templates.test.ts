import { describe, it, expect } from "vitest";
import { inviteEmail, mentionEmail, taskAssignedEmail, taskDueEmail } from "@/lib/jobs/templates";

describe("inviteEmail", () => {
  it("includes the workspace name and invite url", () => {
    const e = inviteEmail({ inviterName: "Alice", workspaceName: "Acme", inviteUrl: "https://app/invite/tok" });
    expect(e.subject).toContain("Acme");
    expect(e.text).toContain("https://app/invite/tok");
  });
});

describe("mentionEmail", () => {
  it("includes who mentioned, the task title, and a link", () => {
    const e = mentionEmail({ by: "Jane", taskTitle: "Ship it", taskUrl: "https://app/t/1" });
    expect(e.subject).toContain("Jane");
    expect(e.subject).toContain("Ship it");
    expect(e.text).toContain("https://app/t/1");
  });
});

describe("taskAssignedEmail", () => {
  it("includes assignment context and task link", () => {
    const e = taskAssignedEmail({
      assignedBy: "Alex",
      taskTitle: "Draft launch plan",
      workspaceName: "Acme",
      projectName: "Launch",
      taskUrl: "https://app/t/2",
      dueDate: "Jun 30, 2026",
    });
    expect(e.subject).toContain("Alex");
    expect(e.subject).toContain("Draft launch plan");
    expect(e.text).toContain("Launch");
    expect(e.text).toContain("https://app/t/2");
    expect(e.text).toContain("Jun 30, 2026");
  });
});

describe("taskDueEmail", () => {
  it("includes due context and task link", () => {
    const e = taskDueEmail({
      taskTitle: "Submit budget",
      workspaceName: "Acme",
      projectName: "Finance",
      taskUrl: "https://app/t/3",
      dueDate: "Jun 28, 2026",
    });
    expect(e.subject).toContain("Due today");
    expect(e.text).toContain("Submit budget");
    expect(e.text).toContain("https://app/t/3");
    expect(e.text).toContain("Jun 28, 2026");
  });
});
