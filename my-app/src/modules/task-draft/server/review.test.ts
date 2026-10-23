import { describe, it, expect, vi, beforeEach } from "vitest";

const DRAFT_ID = "507f1f77bcf86cd799439011";
const WORKSPACE_ID = "507f1f77bcf86cd799439033";
const OTHER_WORKSPACE_ID = "507f1f77bcf86cd799439099";
const USER_ID = "507f1f77bcf86cd799439044";
const PROJECT_ID = "507f1f77bcf86cd799439022";
const TASK_ID = "507f1f77bcf86cd799439055";

type FakeDraft = {
  _id: string;
  workspaceId: string;
  status: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdTaskId?: string;
};

const mocks = vi.hoisted(() => ({
  createTaskForActor: vi.fn(),
}));

// A tiny in-memory TaskDraft double. findOneAndUpdate honors the same filter the real query
// uses (id + workspace + status:"PENDING"), which is what makes "second approve rejected"
// and "wrong workspace" behave like the real atomic claim would.
let store: FakeDraft;

function matches(filter: Record<string, unknown>, draft: FakeDraft): boolean {
  if (String(filter._id) !== draft._id) return false;
  if (String(filter.workspaceId) !== draft.workspaceId) return false;
  if (filter.status !== undefined && filter.status !== draft.status) return false;
  return true;
}

type Update = { $set?: Record<string, unknown>; $unset?: Record<string, unknown> };

function applyUpdate(update: Update) {
  if (update.$set) Object.assign(store, update.$set);
  if (update.$unset) {
    for (const key of Object.keys(update.$unset)) delete (store as Record<string, unknown>)[key];
  }
}

vi.mock("@/lib/db", () => ({ connectDB: async () => undefined }));
vi.mock("@/models/TaskDraft", () => ({
  TaskDraft: {
    findOneAndUpdate: vi.fn(async (filter: Record<string, unknown>, update: Update) => {
      if (!matches(filter, store)) return null;
      applyUpdate(update);
      return { ...store };
    }),
    updateOne: vi.fn(async (filter: Record<string, unknown>, update: Update) => {
      if (String(filter._id) !== store._id) return { matchedCount: 0 };
      applyUpdate(update);
      return { matchedCount: 1 };
    }),
  },
}));
vi.mock("@/modules/task/server/create-task-core", () => ({
  createTaskForActor: mocks.createTaskForActor,
}));

const { approveDraftFor, rejectDraftFor } = await import("@/modules/task-draft/server/review");

const reviewer = { workspaceId: WORKSPACE_ID, userId: USER_ID, userName: "Ada", role: "MEMBER" as const };
const approval = { projectId: PROJECT_ID, title: "Ship it", priority: "MEDIUM" as const };

beforeEach(() => {
  vi.clearAllMocks();
  store = { _id: DRAFT_ID, workspaceId: WORKSPACE_ID, status: "PENDING" };
  mocks.createTaskForActor.mockResolvedValue({ ok: true, data: { id: TASK_ID } });
});

describe("approveDraftFor", () => {
  it("creates the task as the reviewer and marks the draft APPROVED", async () => {
    const result = await approveDraftFor(reviewer, DRAFT_ID, approval);

    expect(result).toEqual({ ok: true, data: { id: TASK_ID } });
    expect(store.status).toBe("APPROVED");
    expect(store.createdTaskId).toBe(TASK_ID);
    expect(mocks.createTaskForActor).toHaveBeenCalledWith(
      { id: USER_ID, name: "Ada" },
      PROJECT_ID,
      expect.objectContaining({ title: "Ship it" }),
    );
  });

  it("rejects a second approve of the same draft", async () => {
    expect((await approveDraftFor(reviewer, DRAFT_ID, approval)).ok).toBe(true);

    const second = await approveDraftFor(reviewer, DRAFT_ID, approval);
    expect(second).toEqual({ ok: false, error: "Draft not found, or already reviewed." });
    expect(mocks.createTaskForActor).toHaveBeenCalledTimes(1);
  });

  it("does not find a draft belonging to a different workspace", async () => {
    const result = await approveDraftFor(
      { ...reviewer, workspaceId: OTHER_WORKSPACE_ID },
      DRAFT_ID,
      approval,
    );
    expect(result).toEqual({ ok: false, error: "Draft not found, or already reviewed." });
    expect(mocks.createTaskForActor).not.toHaveBeenCalled();
  });

  it("puts the draft back to PENDING if task creation fails", async () => {
    mocks.createTaskForActor.mockResolvedValue({ ok: false, error: "You don't have permission." });

    const result = await approveDraftFor(reviewer, DRAFT_ID, approval);

    expect(result).toEqual({ ok: false, error: "You don't have permission." });
    expect(store.status).toBe("PENDING");
    expect(store.reviewedBy).toBeUndefined();
  });

  it("rejects a reviewer who can't edit tasks", async () => {
    const result = await approveDraftFor({ ...reviewer, role: "GUEST" }, DRAFT_ID, approval);
    expect(result).toEqual({ ok: false, error: "You don't have permission to approve drafts." });
    expect(mocks.createTaskForActor).not.toHaveBeenCalled();
  });
});

describe("rejectDraftFor", () => {
  it("marks a pending draft REJECTED", async () => {
    expect(await rejectDraftFor(reviewer, DRAFT_ID)).toEqual({ ok: true });
    expect(store.status).toBe("REJECTED");
  });

  it("rejects reviewing an already-reviewed draft", async () => {
    await rejectDraftFor(reviewer, DRAFT_ID);
    const second = await rejectDraftFor(reviewer, DRAFT_ID);
    expect(second).toEqual({ ok: false, error: "Draft not found, or already reviewed." });
  });
});
