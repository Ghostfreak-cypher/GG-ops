import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ACTOR_ID = "507f1f77bcf86cd799439011";
const OUTSIDER_ID = "507f1f77bcf86cd799439012";
const PROJECT_ID = "507f1f77bcf86cd799439022";
const WORKSPACE_ID = "507f1f77bcf86cd799439033";
const ASSIGNEE_ID = "507f1f77bcf86cd799439044";
const NEW_TASK_ID = "507f1f77bcf86cd799439055";

const mocks = vi.hoisted(() => ({
  getProjectForUser: vi.fn(),
  assertSectionInProject: vi.fn(),
  taskFind: vi.fn(),
  taskCreate: vi.fn(),
  logActivity: vi.fn(),
  publish: vi.fn(),
  enqueueTaskAssignedEmails: vi.fn(),
  notify: vi.fn(),
  notifyDescriptionMentions: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ connectDB: async () => undefined }));
vi.mock("@/modules/project/server/access", () => ({
  getProjectForUser: mocks.getProjectForUser,
  assertSectionInProject: mocks.assertSectionInProject,
}));
vi.mock("@/models/Task", () => ({
  Task: { find: mocks.taskFind, create: mocks.taskCreate },
}));
vi.mock("@/modules/activity/log", () => ({ logActivity: mocks.logActivity }));
vi.mock("@/lib/pusher", () => ({ publish: mocks.publish }));
vi.mock("@/lib/jobs/task-email", () => ({
  enqueueTaskAssignedEmails: mocks.enqueueTaskAssignedEmails,
}));
vi.mock("@/modules/notification/server/create", () => ({ notify: mocks.notify }));
vi.mock("@/modules/task/server/description-mentions", () => ({
  notifyDescriptionMentions: mocks.notifyDescriptionMentions,
}));

const { createTaskForActor } = await import("@/modules/task/server/create-task-core");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProjectForUser.mockResolvedValue({
    project: { id: PROJECT_ID, workspaceId: WORKSPACE_ID, name: "Proj" },
    role: "MEMBER",
  });
  mocks.assertSectionInProject.mockResolvedValue(true);
  mocks.taskFind.mockReturnValue({ select: () => ({ lean: async () => [] }) });
  mocks.taskCreate.mockImplementation(async (doc: Record<string, unknown>) => ({
    _id: NEW_TASK_ID,
    ...doc,
  }));
});

describe("createTaskForActor", () => {
  it("attributes the task to the supplied actor, not an ambient session", async () => {
    const result = await createTaskForActor(
      { id: ACTOR_ID, name: "Ada" },
      PROJECT_ID,
      { title: "Ship it" },
    );

    expect(result).toEqual({ ok: true, data: { id: NEW_TASK_ID } });

    const created = mocks.taskCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(String(created.createdBy)).toBe(ACTOR_ID);
    expect(String(created.workspaceId)).toBe(WORKSPACE_ID);
    expect(created.title).toBe("Ship it");

    // The actor is what authorization was evaluated against.
    expect(mocks.getProjectForUser).toHaveBeenCalledWith(PROJECT_ID, ACTOR_ID);
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: ACTOR_ID, action: "TASK_CREATED" }),
    );
  });

  it("rejects an actor who is not a member of the project's workspace", async () => {
    mocks.getProjectForUser.mockResolvedValue(null);

    const result = await createTaskForActor(
      { id: OUTSIDER_ID, name: "Mallory" },
      PROJECT_ID,
      { title: "Sneaky" },
    );

    expect(result).toEqual({ ok: false, error: "Project not found." });
    expect(mocks.taskCreate).not.toHaveBeenCalled();
  });

  it("rejects an actor whose role cannot edit tasks", async () => {
    mocks.getProjectForUser.mockResolvedValue({
      project: { id: PROJECT_ID, workspaceId: WORKSPACE_ID, name: "Proj" },
      role: "GUEST",
    });

    const result = await createTaskForActor({ id: ACTOR_ID, name: "Ada" }, PROJECT_ID, {
      title: "Nope",
    });

    expect(result).toEqual({ ok: false, error: "You don't have permission." });
    expect(mocks.taskCreate).not.toHaveBeenCalled();
  });

  it("validates input and does not write on a schema failure", async () => {
    const result = await createTaskForActor({ id: ACTOR_ID, name: "Ada" }, PROJECT_ID, {
      title: "",
    });

    expect(result.ok).toBe(false);
    expect(mocks.taskCreate).not.toHaveBeenCalled();
  });

  it("uses the actor's name for notifications and skips self-notification", async () => {
    await createTaskForActor({ id: ACTOR_ID, name: "Ada" }, PROJECT_ID, {
      title: "Review",
      assigneeIds: [ASSIGNEE_ID, ACTOR_ID],
    });

    expect(mocks.enqueueTaskAssignedEmails).toHaveBeenCalledWith(
      expect.objectContaining({ assigneeIds: [ASSIGNEE_ID] }),
      "Ada",
    );
    const notified = mocks.notify.mock.calls[0]?.[0] as { userId: string; title: string }[];
    expect(notified).toHaveLength(1);
    expect(notified[0]?.userId).toBe(ASSIGNEE_ID);
    expect(notified[0]?.title).toContain("Ada");
  });
});

describe("create-task-core module safety", () => {
  it("does NOT carry the \"use server\" directive", () => {
    // If this file ever becomes a Server Action module, `createTaskForActor(actor, ...)`
    // becomes an unauthenticated public endpoint that creates tasks as ANY user.
    const source = readFileSync(
      fileURLToPath(new URL("./create-task-core.ts", import.meta.url)),
      "utf8",
    );
    expect(source).not.toMatch(/^\s*["']use server["']/m);
  });
});
