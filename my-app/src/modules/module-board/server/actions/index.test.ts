import { beforeEach, describe, expect, it, vi } from "vitest";

const OWNER_ID = "507f1f77bcf86cd799439011";
const VALIDATOR_ID = "507f1f77bcf86cd799439012";
const WORKSPACE_ID = "507f191e810c19729de860ea";
const TASK_ID = "507f191e810c19729de860eb";

type FakeBoard = {
  workspaceId: string;
  finishLines: Array<{ id: string; title: string; note: string; status: string; updatedBy: unknown; updatedAt: Date | null }>;
  masterGate: unknown[];
  scopeHolds: unknown[];
  modules: Array<Record<string, unknown>>;
  pilotRoadmap: Array<Record<string, unknown>>;
  openItems: Array<Record<string, unknown>>;
  outreachPipeline: Array<Record<string, unknown>>;
  spendDiscipline: Array<Record<string, unknown>>;
  loadFlags: Array<Record<string, unknown>>;
  lastUpdatedBy: unknown;
  save: ReturnType<typeof vi.fn>;
};

const state = {
  role: "MEMBER" as "MEMBER" | "GUEST" | "ADMIN" | "MAINTAINER",
  board: null as FakeBoard | null,
  taskCount: 0,
};

function makeBoard(): FakeBoard {
  return {
    workspaceId: WORKSPACE_ID,
    finishLines: [
      { id: "finish-1", title: "Sunday completeness", note: "", status: "UNSET", updatedBy: null, updatedAt: null },
    ],
    masterGate: [],
    scopeHolds: [],
    modules: [
      {
        id: "module-m1",
        moduleKey: "M1",
        title: "M1",
        ownerUserId: null,
        validatorUserId: null,
        status: "UNSET",
        summary: "",
        whatClosesIt: "",
        verificationSummary: "",
        validatingReason: "",
        blockerReason: "",
        taskIds: [],
        prUrls: [],
        proofBundles: [],
        updatedBy: null,
        updatedAt: null,
      },
    ],
    pilotRoadmap: [
      {
        id: "pilot-1",
        title: "Flagship case",
        ownerUserId: null,
        status: "UNSET",
        note: "",
        taskIds: [],
        externalUrls: [],
        updatedBy: null,
        updatedAt: null,
      },
    ],
    openItems: [],
    outreachPipeline: [],
    spendDiscipline: [],
    loadFlags: [],
    lastUpdatedBy: null,
    save: vi.fn(async function save(this: FakeBoard) {
      return this;
    }),
  };
}

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn(async () => undefined),
}));

vi.mock("@/modules/module-board/access", () => ({
  requireModuleBoardWorkspace: vi.fn(async () => ({
    workspace: { id: WORKSPACE_ID, name: "GG", slug: "gg" },
    role: state.role,
    userId: OWNER_ID,
  })),
  canEditModuleBoard: vi.fn((role: string) => role !== "GUEST"),
}));

vi.mock("@/models/ModuleBoard", () => ({
  ModuleBoard: {
    findOne: vi.fn(async () => state.board),
    create: vi.fn(async () => state.board),
  },
}));

vi.mock("@/models/Task", () => ({
  Task: {
    countDocuments: vi.fn(async () => state.taskCount),
  },
}));

beforeEach(() => {
  state.role = "MEMBER";
  state.board = makeBoard();
  state.taskCount = 0;
});

describe("module board actions: permissions", () => {
  it("allows members to mutate a card", async () => {
    const { updateModuleBoardCardAction } = await import("@/modules/module-board/server/actions");
    state.role = "MEMBER";

    const result = await updateModuleBoardCardAction("gg", "finishLines", "finish-1", {
      title: "Sunday completeness",
      note: "confirmed by owner",
      status: "WORKING",
    });

    expect(result).toEqual({ ok: true });
    expect(state.board?.finishLines[0].note).toBe("confirmed by owner");
  });

  it("blocks guests from mutating a card", async () => {
    const { updateModuleBoardCardAction } = await import("@/modules/module-board/server/actions");
    state.role = "GUEST";

    const result = await updateModuleBoardCardAction("gg", "finishLines", "finish-1", {
      title: "Sunday completeness",
      note: "attempted edit",
      status: "WORKING",
    });

    expect(result.ok).toBe(false);
  });

  it("allows admins to mutate a card", async () => {
    const { updateModuleBoardCardAction } = await import("@/modules/module-board/server/actions");
    state.role = "ADMIN";

    const result = await updateModuleBoardCardAction("gg", "finishLines", "finish-1", {
      title: "Sunday completeness",
      note: "confirmed ready",
      status: "WORKING",
    });

    expect(result).toEqual({ ok: true });
    expect(state.board?.finishLines[0].note).toBe("confirmed ready");
    expect(state.board?.save).toHaveBeenCalledTimes(1);
  });

  it("allows maintainers to mutate a card", async () => {
    const { updateModuleBoardCardAction } = await import("@/modules/module-board/server/actions");
    state.role = "MAINTAINER";

    const result = await updateModuleBoardCardAction("gg", "finishLines", "finish-1", {
      title: "Sunday completeness",
      note: "confirmed ready",
      status: "WORKING",
    });

    expect(result.ok).toBe(true);
  });
});

describe("module board actions: task link scoping", () => {
  it("rejects linked task ids that are not visible in this workspace", async () => {
    const { updateModuleBoardStructuredRowAction } = await import(
      "@/modules/module-board/server/actions"
    );
    state.role = "ADMIN";
    state.taskCount = 0; // simulates the task existing in a different workspace or archived

    const result = await updateModuleBoardStructuredRowAction("gg", "pilotRoadmap", "pilot-1", {
      title: "Flagship case",
      ownerUserId: null,
      status: "UNSET",
      note: "",
      taskIds: [TASK_ID],
      externalUrls: [],
    });

    expect(result).toEqual({
      ok: false,
      error: "Some linked tasks are outside this workspace or no longer available.",
    });
  });

  it("accepts linked task ids that resolve inside the workspace", async () => {
    const { updateModuleBoardStructuredRowAction } = await import(
      "@/modules/module-board/server/actions"
    );
    state.role = "ADMIN";
    state.taskCount = 1;

    const result = await updateModuleBoardStructuredRowAction("gg", "pilotRoadmap", "pilot-1", {
      title: "Flagship case",
      ownerUserId: null,
      status: "UNSET",
      note: "",
      taskIds: [TASK_ID],
      externalUrls: [],
    });

    expect(result.ok).toBe(true);
    expect((state.board?.pilotRoadmap[0].taskIds as unknown[])?.length).toBe(1);
  });
});

describe("module board actions: input validation", () => {
  it("rejects an invalid external URL", async () => {
    const { updateModuleBoardStructuredRowAction } = await import(
      "@/modules/module-board/server/actions"
    );
    state.role = "ADMIN";

    const result = await updateModuleBoardStructuredRowAction("gg", "pilotRoadmap", "pilot-1", {
      title: "Flagship case",
      ownerUserId: null,
      status: "UNSET",
      note: "",
      taskIds: [],
      externalUrls: [{ label: "Not a URL", url: "not-a-url" }],
    });

    expect(result.ok).toBe(false);
  });

  it("rejects the same user as owner and validator on a module row", async () => {
    const { updateModuleBoardModuleAction } = await import("@/modules/module-board/server/actions");
    state.role = "ADMIN";

    const result = await updateModuleBoardModuleAction("gg", "module-m1", {
      ownerUserId: OWNER_ID,
      validatorUserId: OWNER_ID,
      status: "UNSET",
      summary: "",
      whatClosesIt: "",
      verificationSummary: "",
      validatingReason: "",
      blockerReason: "",
      taskIds: [],
      prUrls: [],
      proofBundles: [],
    });

    expect(result.ok).toBe(false);
  });

  it("accepts distinct owner and validator on a module row", async () => {
    const { updateModuleBoardModuleAction } = await import("@/modules/module-board/server/actions");
    state.role = "ADMIN";

    const result = await updateModuleBoardModuleAction("gg", "module-m1", {
      ownerUserId: OWNER_ID,
      validatorUserId: VALIDATOR_ID,
      status: "UNSET",
      summary: "",
      whatClosesIt: "",
      verificationSummary: "",
      validatingReason: "",
      blockerReason: "",
      taskIds: [],
      prUrls: [],
      proofBundles: [],
    });

    expect(result.ok).toBe(true);
  });
});
