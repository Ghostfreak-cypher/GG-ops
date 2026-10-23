import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashApiKey } from "@/lib/api-key";

const OWNER_ID = "507f1f77bcf86cd799439011";
const OTHER_USER_ID = "507f1f77bcf86cd799439099";
const KEY_ID = "507f1f77bcf86cd799439022";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  create: vi.fn(),
  updateOne: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/db", () => ({ connectDB: async () => undefined }));
vi.mock("@/modules/auth/server/session", () => ({ requireUser: mocks.requireUser }));
// revokeApiKeyAction also revokes any OAuthGrant tied to the key — connectDB is mocked
// to a no-op above, so a real OAuthGrant.updateOne would buffer forever waiting for a
// connection that never comes. Only revokeApiKeyAction's own scoping is under test here.
vi.mock("@/modules/oauth/server/actions/revoke-grant", () => ({
  revokeGrantForApiKey: async () => undefined,
}));
vi.mock("@/models/ApiKey", async () => ({
  ...(await vi.importActual<typeof import("@/models/ApiKey")>("@/models/ApiKey")),
  ApiKey: { create: mocks.create, updateOne: mocks.updateOne },
}));

const { createApiKeyAction } = await import("@/modules/api-key/server/actions/create-api-key");
const { revokeApiKeyAction } = await import("@/modules/api-key/server/actions/revoke-api-key");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({ id: OWNER_ID, authVersion: 3 });
});

describe("createApiKeyAction", () => {
  it("stores only the hash, and returns the plaintext token exactly once", async () => {
    mocks.create.mockImplementation((doc: Record<string, unknown>) =>
      Promise.resolve({ _id: KEY_ID, ...doc }),
    );

    const result = await createApiKeyAction({ name: "Claude Code", scopes: ["read"] });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.data) throw new Error("expected data");
    expect(result.data.token).toMatch(/^ggops_sk_/);

    const stored = mocks.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(stored.tokenHash).toBe(hashApiKey(result.data.token));
    expect(stored).not.toHaveProperty("token");
    expect(stored.authVersion).toBe(3);
  });

  it("rejects a blank name before touching the database", async () => {
    const result = await createApiKeyAction({ name: "", scopes: ["read"] });
    expect(result.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("revokeApiKeyAction", () => {
  it("scopes the revoke to the caller's own key", async () => {
    mocks.updateOne.mockResolvedValue({ matchedCount: 1 });

    const result = await revokeApiKeyAction(KEY_ID);

    expect(result.ok).toBe(true);
    const filter = mocks.updateOne.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(String(filter.userId)).toBe(OWNER_ID);
  });

  it("fails when the key belongs to someone else", async () => {
    // A real query scoped to `userId: OWNER_ID` would never match another user's key —
    // simulate that by having the mocked update report no match.
    mocks.updateOne.mockResolvedValue({ matchedCount: 0 });
    mocks.requireUser.mockResolvedValue({ id: OTHER_USER_ID, authVersion: 1 });

    const result = await revokeApiKeyAction(KEY_ID);

    expect(result.ok).toBe(false);
  });
});
