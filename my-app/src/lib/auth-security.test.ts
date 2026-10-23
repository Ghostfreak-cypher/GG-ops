import { describe, it, expect, vi } from "vitest";

const USER_ID = "507f1f77bcf86cd799439011";

const mocks = vi.hoisted(() => ({
  grantUpdateMany: vi.fn(async () => undefined),
  apiKeyUpdateMany: vi.fn(async () => undefined),
  userUpdateOne: vi.fn(async () => undefined),
}));

vi.mock("@/lib/db", () => ({ connectDB: async () => undefined }));
vi.mock("@/models/OAuthGrant", () => ({ OAuthGrant: { updateMany: mocks.grantUpdateMany } }));
vi.mock("@/models/ApiKey", () => ({ ApiKey: { updateMany: mocks.apiKeyUpdateMany } }));
vi.mock("@/models/User", () => ({ User: { updateOne: mocks.userUpdateOne } }));

const { bumpAuthVersion } = await import("@/lib/auth-security");

describe("bumpAuthVersion", () => {
  it("revokes the user's OAuth grants and OAuth keys before bumping authVersion", async () => {
    await bumpAuthVersion(USER_ID, "new-hash");

    const [grantFilter] = mocks.grantUpdateMany.mock.calls[0] as unknown as [Record<string, unknown>];
    const [keyFilter] = mocks.apiKeyUpdateMany.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(String(grantFilter.userId)).toBe(USER_ID);
    expect(grantFilter.revokedAt).toBeNull();
    expect(String(keyFilter.userId)).toBe(USER_ID);
    // PATs are left alone — the authVersion check already kills them.
    expect(keyFilter.kind).toBe("OAUTH");

    const userOrder = mocks.userUpdateOne.mock.invocationCallOrder[0];
    expect(mocks.grantUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(userOrder);
    expect(mocks.apiKeyUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(userOrder);
  });
});
