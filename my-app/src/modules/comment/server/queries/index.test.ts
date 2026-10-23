import { describe, it, expect, vi, beforeEach } from "vitest";

const TASK_ID = "507f1f77bcf86cd799439011";
const PROJECT_ID = "507f1f77bcf86cd799439022";
const MEMBER_ID = "507f1f77bcf86cd799439033";
const OUTSIDER_ID = "507f1f77bcf86cd799439044";
const COMMENT_ID = "507f1f77bcf86cd799439055";

const mocks = vi.hoisted(() => ({
  getProjectForUser: vi.fn(),
  taskFindById: vi.fn(),
  commentFind: vi.fn(),
  attachmentFind: vi.fn(),
  reactionFind: vi.fn(),
  userFind: vi.fn(),
}));

/** `.select(...).lean()` — the chain `Task.findById()` is called with. */
function selectLean(value: unknown) {
  return { select: () => ({ lean: async () => value }) };
}
/** `.sort(...).lean()` — the chain `Comment.find()` is called with. */
function sortLean(value: unknown) {
  return { sort: () => ({ lean: async () => value }) };
}
/** `.select(...).lean()` for the parallel author/attachment/reaction fetches. */
function selectLeanList(value: unknown[]) {
  return { select: () => ({ lean: async () => value }) };
}

vi.mock("@/lib/db", () => ({ connectDB: async () => undefined }));
vi.mock("@/modules/project/server/access", () => ({
  getProjectForUser: mocks.getProjectForUser,
}));
vi.mock("@/models/Task", () => ({ Task: { findById: mocks.taskFindById } }));
vi.mock("@/models/Comment", () => ({ Comment: { find: mocks.commentFind } }));
vi.mock("@/models/Attachment", () => ({ Attachment: { find: mocks.attachmentFind } }));
vi.mock("@/models/CommentReaction", () => ({
  CommentReaction: { find: mocks.reactionFind },
}));
vi.mock("@/models/User", () => ({ User: { find: mocks.userFind } }));

const { listComments } = await import("@/modules/comment/server/queries");

beforeEach(() => {
  vi.clearAllMocks();

  mocks.taskFindById.mockReturnValue(selectLean({ _id: TASK_ID, projectId: PROJECT_ID }));
  mocks.commentFind.mockReturnValue(
    sortLean([
      {
        _id: COMMENT_ID,
        body: "the secret plan",
        authorId: MEMBER_ID,
        parentCommentId: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]),
  );
  mocks.userFind.mockReturnValue(selectLeanList([{ _id: MEMBER_ID, name: "Ada", image: null }]));
  mocks.attachmentFind.mockReturnValue(selectLeanList([]));
  mocks.reactionFind.mockReturnValue(selectLeanList([]));
});

describe("listComments access control", () => {
  it("returns comments to an active workspace member", async () => {
    mocks.getProjectForUser.mockResolvedValue({
      project: { id: PROJECT_ID, workspaceId: "w1", name: "Proj" },
      role: "MEMBER",
    });

    const result = await listComments(TASK_ID, MEMBER_ID);

    expect(result).toHaveLength(1);
    expect(result[0]?.body).toBe("the secret plan");
    expect(mocks.getProjectForUser).toHaveBeenCalledWith(PROJECT_ID, MEMBER_ID);
  });

  it("returns [] to a non-member and never queries comments", async () => {
    // getProjectForUser returning null is exactly what a non-member gets.
    mocks.getProjectForUser.mockResolvedValue(null);

    const result = await listComments(TASK_ID, OUTSIDER_ID);

    expect(result).toEqual([]);
    // The real guarantee: we bail before reading any comment body at all.
    expect(mocks.commentFind).not.toHaveBeenCalled();
  });

  it("returns [] for a task that does not exist", async () => {
    mocks.taskFindById.mockReturnValue(selectLean(null));

    expect(await listComments(TASK_ID, MEMBER_ID)).toEqual([]);
    expect(mocks.getProjectForUser).not.toHaveBeenCalled();
    expect(mocks.commentFind).not.toHaveBeenCalled();
  });

  it("rejects a malformed taskId before touching the database", async () => {
    await expect(listComments("not-an-object-id", MEMBER_ID)).rejects.toThrow(/Invalid ObjectId/);
    expect(mocks.taskFindById).not.toHaveBeenCalled();
  });
});
