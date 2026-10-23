import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthedUser } from "@/modules/auth/server/session";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), rateLimit: vi.fn() }));

vi.mock("@/modules/auth/server/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
  requireUser: async () => {
    throw new Error("not used");
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
  clientIp: () => "127.0.0.1",
}));
vi.mock("@/lib/env", () => ({ env: { APP_URL: "https://ggops.test" } }));

const { handleMcp, MCP_CORS_HEADERS } = await import("@/modules/mcp/transport");
const { handleAuthed } = await import("@/lib/api/handler");

const readOnlyUser: AuthedUser = {
  id: "507f1f77bcf86cd799439011",
  name: "Ada",
  email: "ada@example.com",
  authVersion: 0,
  emailVerified: true,
  hasPassword: true,
  via: "apikey",
  scopes: ["read"],
  apiKeyId: "507f1f77bcf86cd799439022",
};

const post = () => new Request("https://ggops.test/api/mcp", { method: "POST", body: "{}" });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateLimit.mockResolvedValue({ allowed: true });
});

describe("handleMcp authentication", () => {
  it("401s with the RFC 9728 challenge when unauthenticated", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const res = await handleMcp(async () => new Response("unreachable"))(post());

    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe(
      'Bearer realm="ggops", resource_metadata="https://ggops.test/.well-known/oauth-protected-resource"',
    );
    // A browser client can only act on the challenge if it is exposed to script.
    expect(res.headers.get("access-control-expose-headers")).toContain("WWW-Authenticate");
  });

  it("passes the resolved principal to the handler", async () => {
    mocks.getCurrentUser.mockResolvedValue(readOnlyUser);
    let seen: AuthedUser | undefined;

    await handleMcp(async (_req, user) => {
      seen = user;
      return new Response("ok");
    })(post());

    expect(seen?.id).toBe(readOnlyUser.id);
  });

  it("enforces the same per-key hourly budget as handleAuthed", async () => {
    mocks.getCurrentUser.mockResolvedValue(readOnlyUser);
    mocks.rateLimit.mockResolvedValue({ allowed: false, retryAfter: 60 });

    const res = await handleMcp(async () => new Response("unreachable"))(post());

    expect(res.status).toBe(429);
    expect(mocks.rateLimit).toHaveBeenCalledWith(
      `apikey:${readOnlyUser.apiKeyId}`,
      600,
      3600,
      { failClosed: true },
    );
  });
});

/**
 * The reason this module exists at all. If someone later "de-duplicates" handleMcp into
 * handleAuthed, this test fails and explains why that breaks MCP.
 */
describe("the deliberate divergence from handleAuthed", () => {
  it("handleAuthed 403s a read-only key on POST — which would break every MCP call", async () => {
    mocks.getCurrentUser.mockResolvedValue(readOnlyUser);

    const res = await handleAuthed(async () => new Response("unreachable"))(post());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: "This API key is read-only." });
  });

  it("handleMcp lets the same read-only key through, because scope is per-tool", async () => {
    mocks.getCurrentUser.mockResolvedValue(readOnlyUser);

    const res = await handleMcp(async () => new Response("reached"))(post());

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("reached");
  });
});

describe("CORS", () => {
  it("allows any origin without credentials (bearer-only endpoint)", () => {
    expect(MCP_CORS_HEADERS["Access-Control-Allow-Origin"]).toBe("*");
    // `*` is only safe because we never opt into credentialed requests; browsers reject
    // the wildcard when credentials are included, which is what keeps a logged-in user's
    // cookie from being usable here.
    expect(MCP_CORS_HEADERS["Access-Control-Allow-Credentials"]).toBeUndefined();
  });

  it("permits the headers an MCP client actually sends", () => {
    const allowed = MCP_CORS_HEADERS["Access-Control-Allow-Headers"];
    expect(allowed).toContain("authorization");
    expect(allowed).toContain("content-type");
    expect(allowed).toContain("mcp-protocol-version");
  });
});
