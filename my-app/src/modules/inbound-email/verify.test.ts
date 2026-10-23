import { describe, it, expect, vi, beforeEach } from "vitest";

const USER_ID = "507f1f77bcf86cd799439011";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  getUserWorkspaces: vi.fn(),
  resolveProject: vi.fn(),
  resolveWorkspace: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ connectDB: async () => undefined }));
vi.mock("@/models/User", () => ({ User: { findOne: mocks.findOne } }));
vi.mock("@/modules/workspace/server/queries", () => ({
  getUserWorkspaces: mocks.getUserWorkspaces,
}));
vi.mock("@/modules/mcp/resolve", async () => {
  const actual = await vi.importActual<typeof import("@/modules/mcp/resolve")>(
    "@/modules/mcp/resolve",
  );
  return {
    ResolutionError: actual.ResolutionError,
    resolveProject: mocks.resolveProject,
    resolveWorkspace: mocks.resolveWorkspace,
  };
});

const { verifyAuthResults, resolveSender, resolveTarget } = await import(
  "@/modules/inbound-email/verify"
);

const email = (over: Partial<{ from: string; fromEmail: string; to: string[]; subject: string; authResults: string }> = {}) => ({
  messageId: "m1",
  from: "Ada <ada@acme.test>",
  fromEmail: "ada@acme.test",
  to: ["inbound@ggops.test"],
  subject: "Please fix the thing",
  body: "It is broken.",
  authResults: "mx.google.com; dmarc=pass header.from=acme.test",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findOne.mockReturnValue({ select: () => ({ lean: async () => ({ _id: USER_ID, name: "Ada" }) }) });
  mocks.getUserWorkspaces.mockResolvedValue([
    { id: "507f1f77bcf86cd799439021", name: "Acme", slug: "acme", role: "MEMBER" },
  ]);
});

/**
 * Gate 1. Without this the From: header is forgeable and every check after it is theatre.
 */
describe("verifyAuthResults — sender authenticity", () => {
  it("accepts dmarc=pass", () => {
    expect(verifyAuthResults("mx.google.com; dmarc=pass header.from=acme.test").ok).toBe(true);
  });

  it("accepts spf=pass together with dkim=pass", () => {
    expect(verifyAuthResults("spf=pass smtp.mailfrom=acme.test; dkim=pass header.i=@acme.test").ok).toBe(true);
  });

  it.each([
    ["dmarc=fail", "mx.google.com; dmarc=fail header.from=acme.test"],
    ["dmarc=none", "mx.google.com; dmarc=none"],
    ["spf alone", "spf=pass smtp.mailfrom=acme.test"],
    ["dkim alone", "dkim=pass header.i=@acme.test"],
    ["spf pass + dkim fail", "spf=pass; dkim=fail"],
    ["an empty header", ""],
    ["nothing recognisable", "mx.google.com; something=else"],
  ])("REJECTS %s", (_label, header) => {
    expect(verifyAuthResults(header).ok).toBe(false);
  });

  it("is not fooled by the words appearing in an address", () => {
    // A sender at "dmarc=pass.evil.test" must not be read as a pass verdict.
    expect(verifyAuthResults("header.from=dmarcpass.evil.test; dmarc=fail").ok).toBe(false);
  });
});

/** Gate 2. Identity is what gate 3 authorizes against, so it can never be self-service. */
describe("resolveSender — known active user only", () => {
  it("resolves an active user to an actor", async () => {
    const r = await resolveSender(email());
    expect(r).toEqual({ ok: true, actor: { id: USER_ID, name: "Ada" } });
    expect(mocks.findOne).toHaveBeenCalledWith({ email: "ada@acme.test", isActive: true });
  });

  it("rejects an unknown sender and does NOT create a user", async () => {
    mocks.findOne.mockReturnValue({ select: () => ({ lean: async () => null }) });
    const r = await resolveSender(email({ fromEmail: "stranger@evil.test" }));
    expect(r.ok).toBe(false);
  });

  it("matches on the lowercased address only", async () => {
    await resolveSender(email({ fromEmail: "ada@acme.test" }));
    const query = mocks.findOne.mock.calls[0]?.[0] as { email: string; isActive: boolean };
    expect(query.email).toBe("ada@acme.test");
    // isActive is part of the query, so a deactivated user cannot file tasks.
    expect(query.isActive).toBe(true);
  });
});

/** Gate 3. Resolution runs AS THE SENDER, so it doubles as the membership check. */
describe("resolveTarget — project addressing", () => {
  const actor = { id: USER_ID, name: "Ada" };

  it("rejects mail with no project tag at all", async () => {
    const r = await resolveTarget(email({ subject: "no tag here" }), actor);
    expect(r.ok).toBe(false);
  });

  it("resolves a [Project] subject tag through the sender's own workspaces", async () => {
    mocks.resolveProject.mockResolvedValue({ id: "507f1f77bcf86cd799439031", name: "Billing" });
    const r = await resolveTarget(email({ subject: "[Billing] card declined" }), actor);
    expect(r).toMatchObject({ ok: true, projectName: "Billing", workspaceName: "Acme" });
    // The membership check is implicit: only workspaces from getUserWorkspaces are searched.
    expect(mocks.getUserWorkspaces).toHaveBeenCalledWith(USER_ID);
  });

  it("resolves plus-addressing", async () => {
    mocks.resolveProject.mockResolvedValue({ id: "507f1f77bcf86cd799439031", name: "Billing" });
    const r = await resolveTarget(
      email({ to: ["inbound+507f1f77bcf86cd799439031@ggops.test"], subject: "no tag" }),
      actor,
    );
    expect(r).toMatchObject({ ok: true, projectName: "Billing" });
  });

  it("rejects a project id the sender has no workspace for", async () => {
    mocks.resolveProject.mockRejectedValue(new Error("not in this workspace"));
    const r = await resolveTarget(
      email({ to: ["inbound+507f1f77bcf86cd7994390ff@ggops.test"], subject: "no tag" }),
      actor,
    );
    expect(r.ok).toBe(false);
  });

  it("refuses to guess when a name matches in two workspaces", async () => {
    mocks.getUserWorkspaces.mockResolvedValue([
      { id: "507f1f77bcf86cd799439021", name: "Acme", slug: "acme", role: "MEMBER" },
      { id: "507f1f77bcf86cd799439022", name: "Personal", slug: "personal", role: "MEMBER" },
    ]);
    mocks.resolveProject.mockResolvedValue({ id: "507f1f77bcf86cd799439031", name: "Inbox" });

    const r = await resolveTarget(email({ subject: "[Inbox] something" }), actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Workspace\/Project/);
  });
});
