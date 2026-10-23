import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthedUser } from "@/modules/auth/server/session";

const USER_ID = "507f1f77bcf86cd799439011";

const mocks = vi.hoisted(() => ({ getUserWorkspaces: vi.fn() }));

vi.mock("@/lib/db", () => ({ connectDB: async () => undefined }));
vi.mock("@/modules/workspace/server/queries", () => ({
  getUserWorkspaces: mocks.getUserWorkspaces,
}));
// protocol.ts imports AppError from lib/api/handler, which imports the session DAL, which
// pulls in next-auth → `next/server` — a module vitest cannot resolve outside the Next
// runtime. Stubbing the DAL cuts that chain; dispatch() takes its principal as an argument
// and never calls these.
vi.mock("@/modules/auth/server/session", () => ({
  getCurrentUser: async () => null,
  requireUser: async () => {
    throw new Error("requireUser must not be called from the MCP dispatch path");
  },
}));

const { dispatch } = await import("@/modules/mcp/protocol");
const { RpcCode } = await import("@/modules/mcp/jsonrpc");

function principal(scopes: ("read" | "write")[]): AuthedUser {
  return {
    id: USER_ID,
    name: "Ada",
    email: "ada@example.com",
    authVersion: 0,
    emailVerified: true,
    hasPassword: true,
    via: "apikey",
    scopes,
    apiKeyId: "507f1f77bcf86cd799439022",
  };
}

const readOnly = principal(["read"]);
const readWrite = principal(["read", "write"]);

const msg = (method: string, params?: unknown) => ({ jsonrpc: "2.0", id: 1, method, params });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserWorkspaces.mockResolvedValue([
    { id: "507f1f77bcf86cd799439033", name: "Acme", slug: "acme", role: "MEMBER" },
  ]);
});

describe("initialize", () => {
  it("echoes a protocol version it supports", async () => {
    const r = (await dispatch(msg("initialize", { protocolVersion: "2025-03-26" }), readOnly)) as {
      protocolVersion: string;
    };
    expect(r.protocolVersion).toBe("2025-03-26");
  });

  it("falls back to the newest supported version for an unknown one", async () => {
    const r = (await dispatch(msg("initialize", { protocolVersion: "1999-01-01" }), readOnly)) as {
      protocolVersion: string;
    };
    expect(r.protocolVersion).toBe("2025-06-18");
  });

  it("advertises tools only, and ships instructions teaching the name-not-id rule", async () => {
    const r = (await dispatch(msg("initialize", {}), readOnly)) as {
      capabilities: Record<string, unknown>;
      serverInfo: { name: string };
      instructions: string;
    };
    expect(r.capabilities).toEqual({ tools: { listChanged: false } });
    expect(r.capabilities.resources).toBeUndefined();
    expect(r.serverInfo.name).toBe("ggops");
    expect(r.instructions).toMatch(/never by database id/i);
  });

  it("succeeds for a read-only key (the reason handleAuthed can't be used)", async () => {
    await expect(dispatch(msg("initialize", {}), readOnly)).resolves.toBeTruthy();
  });
});

describe("method routing", () => {
  it("answers ping", async () => {
    expect(await dispatch(msg("ping"), readOnly)).toEqual({});
  });

  it("MethodNotFound for undeclared capabilities", async () => {
    for (const method of ["resources/list", "prompts/list", "completely/made/up"]) {
      await expect(dispatch(msg(method), readOnly)).rejects.toMatchObject({
        code: RpcCode.MethodNotFound,
      });
    }
  });

  it("treats initialized/cancelled notifications as no-ops", async () => {
    expect(await dispatch(msg("notifications/initialized"), readOnly)).toBeNull();
    expect(await dispatch(msg("notifications/cancelled"), readOnly)).toBeNull();
  });
});

describe("tools/list scope filtering", () => {
  it("returns descriptors with JSON Schema inputs", async () => {
    const r = (await dispatch(msg("tools/list"), readWrite)) as {
      tools: { name: string; inputSchema: Record<string, unknown>; annotations: object }[];
    };
    expect(r.tools.length).toBeGreaterThan(0);
    const t = r.tools.find((x) => x.name === "list_workspaces");
    expect(t).toBeDefined();
    expect(t?.inputSchema.type).toBe("object");
    expect(t?.inputSchema.$schema).toBeUndefined();
    expect(t?.annotations).toMatchObject({ readOnlyHint: true });
  });

  it("hides write tools from a read-only key", async () => {
    const ro = (await dispatch(msg("tools/list"), readOnly)) as { tools: { name: string }[] };
    const rw = (await dispatch(msg("tools/list"), readWrite)) as { tools: { name: string }[] };

    const writeToolsVisibleToReadOnly = ro.tools.filter(
      (t) => !rw.tools.some((x) => x.name === t.name),
    );
    expect(writeToolsVisibleToReadOnly).toEqual([]);
    expect(ro.tools.length).toBeLessThanOrEqual(rw.tools.length);
  });
});

describe("tools/call", () => {
  it("runs a tool and wraps the result as MCP content", async () => {
    const r = (await dispatch(
      msg("tools/call", { name: "list_workspaces", arguments: {} }),
      readOnly,
    )) as { content: { type: string; text: string }[]; isError?: boolean };

    expect(r.isError).toBeUndefined();
    expect(r.content[0]?.type).toBe("text");
    expect(r.content[0]?.text).toContain("acme");
    expect(mocks.getUserWorkspaces).toHaveBeenCalledWith(USER_ID);
  });

  it("MethodNotFound for an unknown tool name", async () => {
    await expect(
      dispatch(msg("tools/call", { name: "no_such_tool", arguments: {} }), readOnly),
    ).rejects.toMatchObject({ code: RpcCode.MethodNotFound });
  });

  it("InvalidParams when name is missing", async () => {
    await expect(dispatch(msg("tools/call", {}), readOnly)).rejects.toMatchObject({
      code: RpcCode.InvalidParams,
    });
  });

  it("surfaces a thrown AppError as a readable tool error, not a protocol error", async () => {
    const { AppError } = await import("@/lib/api/handler");
    mocks.getUserWorkspaces.mockRejectedValue(new AppError("Workspace service is down", 503));

    const r = (await dispatch(
      msg("tools/call", { name: "list_workspaces", arguments: {} }),
      readOnly,
    )) as { isError?: boolean; content: { text: string }[] };

    expect(r.isError).toBe(true);
    expect(r.content[0]?.text).toBe("Workspace service is down");
  });

  it("surfaces a ResolutionError with its candidate list intact", async () => {
    // Regression: ResolutionError was originally missing from the catch chain, so the
    // resolver's "did you mean X or Y?" message was replaced by a generic InternalError —
    // silently destroying the entire point of V4a.
    const { ResolutionError } = await import("@/modules/mcp/resolve");
    mocks.getUserWorkspaces.mockRejectedValue(
      new ResolutionError("not_found", "workspace", "nope", ["Acme Corp (acme)"], 'No workspace matching "nope". Available workspaces: "Acme Corp (acme)".'),
    );

    const r = (await dispatch(
      msg("tools/call", { name: "list_workspaces", arguments: {} }),
      readOnly,
    )) as { isError?: boolean; content: { text: string }[] };

    expect(r.isError).toBe(true);
    expect(r.content[0]?.text).toContain("Acme Corp (acme)");
  });

  it("converts an unexpected throw into InternalError without leaking the message", async () => {
    mocks.getUserWorkspaces.mockRejectedValue(new Error("connection string: mongodb+srv://secret"));

    await expect(
      dispatch(msg("tools/call", { name: "list_workspaces", arguments: {} }), readOnly),
    ).rejects.toMatchObject({ code: RpcCode.InternalError });

    try {
      await dispatch(msg("tools/call", { name: "list_workspaces", arguments: {} }), readOnly);
    } catch (e) {
      expect((e as Error).message).not.toContain("mongodb");
    }
  });
});
