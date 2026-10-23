import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WorkspaceSummary } from "@/modules/workspace/server/dto";

const USER_ID = "507f1f77bcf86cd799439011";
const WS_ACME = "507f1f77bcf86cd799439021";
const WS_OTHER = "507f1f77bcf86cd799439022";
const FOREIGN_WS = "507f1f77bcf86cd7994390ff";
const PROJ_DESIGN_SYSTEM = "507f1f77bcf86cd799439031";
const PROJ_DESIGN_REVIEWS = "507f1f77bcf86cd799439032";
const FOREIGN_PROJECT = "507f1f77bcf86cd7994390fe";
const USER_ADA = "507f1f77bcf86cd799439041";
const USER_GRACE = "507f1f77bcf86cd799439042";
const USER_INVITED = "507f1f77bcf86cd799439043";
const LABEL_BUG = "507f1f77bcf86cd799439051";

const mocks = vi.hoisted(() => ({
  getUserWorkspaces: vi.fn(),
  getWorkspaceForUser: vi.fn(),
  listMembers: vi.fn(),
  listProjects: vi.fn(),
  listLabels: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ connectDB: async () => undefined }));
vi.mock("@/modules/workspace/server/queries", () => ({
  getUserWorkspaces: mocks.getUserWorkspaces,
  getWorkspaceForUser: mocks.getWorkspaceForUser,
  listMembers: mocks.listMembers,
}));
vi.mock("@/modules/project/server/queries", () => ({ listProjects: mocks.listProjects }));
vi.mock("@/modules/label/server/queries", () => ({ listLabels: mocks.listLabels }));

const { resolveWorkspace, resolveProject, resolveMembers, resolveLabels, ResolutionError } =
  await import("@/modules/mcp/resolve");

/** Await a call expected to reject, and hand back the typed ResolutionError. */
async function catchResolution(
  promise: Promise<unknown>,
): Promise<InstanceType<typeof ResolutionError>> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ResolutionError) return error;
    throw error;
  }
  throw new Error("Expected a ResolutionError, but the call resolved.");
}

const acme: WorkspaceSummary = { id: WS_ACME, name: "Acme Corp", slug: "acme-corp", role: "MEMBER" };
const personal: WorkspaceSummary = { id: WS_OTHER, name: "Personal", slug: "personal", role: "MAINTAINER" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserWorkspaces.mockResolvedValue([acme, personal]);
  mocks.getWorkspaceForUser.mockImplementation(async (slug: string) =>
    [acme, personal].find((w) => w.slug === slug) ?? null,
  );
  mocks.listProjects.mockResolvedValue([
    { id: PROJ_DESIGN_SYSTEM, name: "Design System", color: null },
    { id: PROJ_DESIGN_REVIEWS, name: "Design Reviews", color: null },
    { id: "507f1f77bcf86cd799439033", name: "Billing", color: null },
  ]);
  mocks.listMembers.mockResolvedValue([
    { id: "m1", userId: USER_ADA, name: "Ada Lovelace", email: "ada@acme.test", image: null, jobTitle: null, role: "MEMBER", status: "ACTIVE", joinedAt: null },
    { id: "m2", userId: USER_GRACE, name: "Grace Hopper", email: "grace@acme.test", image: null, jobTitle: null, role: "ADMIN", status: "ACTIVE", joinedAt: null },
    { id: "m3", userId: USER_INVITED, name: "Pending Person", email: "pending@acme.test", image: null, jobTitle: null, role: "MEMBER", status: "INVITED", joinedAt: null },
  ]);
  mocks.listLabels.mockResolvedValue([
    { id: LABEL_BUG, name: "bug", color: "red" },
    { id: "507f1f77bcf86cd799439052", name: "backend", color: "blue" },
  ]);
});

describe("resolveWorkspace", () => {
  it("matches an exact slug", async () => {
    expect((await resolveWorkspace(USER_ID, "acme-corp")).id).toBe(WS_ACME);
  });

  it("matches an exact name, case-insensitively, ignoring surrounding space", async () => {
    expect((await resolveWorkspace(USER_ID, "  ACME corp ")).id).toBe(WS_ACME);
  });

  it("matches a prefix and a substring when nothing exact hits", async () => {
    expect((await resolveWorkspace(USER_ID, "acme")).id).toBe(WS_ACME);
    expect((await resolveWorkspace(USER_ID, "ersona")).id).toBe(WS_OTHER);
  });

  it("accepts an ObjectId the caller is a member of", async () => {
    expect((await resolveWorkspace(USER_ID, WS_ACME)).id).toBe(WS_ACME);
  });

  it("REJECTS a well-formed ObjectId the caller is not a member of", async () => {
    // The IDOR guard: a valid id is not the same as an authorized one.
    await expect(resolveWorkspace(USER_ID, FOREIGN_WS)).rejects.toBeInstanceOf(ResolutionError);
  });

  it("lists the caller's workspaces when nothing matches", async () => {
    const err = await catchResolution(resolveWorkspace(USER_ID, "nope"));
    expect(err.kind).toBe("not_found");
    expect(err.message).toContain("Acme Corp (acme-corp)");
    expect(err.message).toContain("Personal (personal)");
  });

  it("re-checks membership through getWorkspaceForUser before returning", async () => {
    await resolveWorkspace(USER_ID, "acme-corp");
    expect(mocks.getWorkspaceForUser).toHaveBeenCalledWith("acme-corp", USER_ID);
  });
});

describe("resolveProject", () => {
  it("matches an exact name", async () => {
    expect((await resolveProject(acme, "Design System")).id).toBe(PROJ_DESIGN_SYSTEM);
  });

  it("reports ambiguity instead of silently picking one", async () => {
    // "design" prefixes both Design System and Design Reviews.
    const err = await catchResolution(resolveProject(acme, "design"));
    expect(err.kind).toBe("ambiguous");
    expect(err.message).toContain("Design System");
    expect(err.message).toContain("Design Reviews");
    expect(err.message).toMatch(/exact name/i);
  });

  it("prefers an exact match over a prefix collision", async () => {
    mocks.listProjects.mockResolvedValue([
      { id: "507f1f77bcf86cd799439061", name: "API", color: null },
      { id: "507f1f77bcf86cd799439062", name: "API Gateway", color: null },
    ]);
    // "API" exactly equals one and prefixes both — exact must win.
    expect((await resolveProject(acme, "API")).id).toBe("507f1f77bcf86cd799439061");
  });

  it("rejects an ObjectId from another workspace", async () => {
    await expect(resolveProject(acme, FOREIGN_PROJECT)).rejects.toBeInstanceOf(ResolutionError);
  });
});

describe("resolveMembers", () => {
  it("resolves by email and by display name", async () => {
    expect(await resolveMembers(acme, ["ada@acme.test"])).toEqual([USER_ADA]);
    expect(await resolveMembers(acme, ["Grace Hopper"])).toEqual([USER_GRACE]);
  });

  it("resolves several at once, preserving order", async () => {
    expect(await resolveMembers(acme, ["Grace Hopper", "ada@acme.test"])).toEqual([
      USER_GRACE,
      USER_ADA,
    ]);
  });

  it("does NOT resolve an INVITED member", async () => {
    // Assigning to someone who hasn't accepted would notify a non-member.
    await expect(resolveMembers(acme, ["pending@acme.test"])).rejects.toBeInstanceOf(ResolutionError);
  });

  it("returns [] for no refs without querying", async () => {
    expect(await resolveMembers(acme, [])).toEqual([]);
    expect(mocks.listMembers).not.toHaveBeenCalled();
  });

  it("names the candidates when a person is not found", async () => {
    const err = await catchResolution(resolveMembers(acme, ["nobody"]));
    expect(err.message).toContain("Ada Lovelace <ada@acme.test>");
  });
});

describe("resolveLabels", () => {
  it("resolves by name and accepts an in-scope id", async () => {
    expect(await resolveLabels(acme, ["bug"])).toEqual([LABEL_BUG]);
    expect(await resolveLabels(acme, [LABEL_BUG])).toEqual([LABEL_BUG]);
  });

  it("errors on an unknown label rather than creating one", async () => {
    await expect(resolveLabels(acme, ["nonexistent"])).rejects.toBeInstanceOf(ResolutionError);
  });
});

describe("no fuzzy matching", () => {
  it("does not match a typo that is neither prefix nor substring", async () => {
    // "Desgin" (transposed) must fail loudly, not resolve to "Design System".
    await expect(resolveProject(acme, "Desgin System")).rejects.toBeInstanceOf(ResolutionError);
  });
});
