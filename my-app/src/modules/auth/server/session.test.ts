import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashApiKey, mintApiKey } from "@/lib/api-key";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  header: vi.fn(),
  findById: vi.fn(),
  findOne: vi.fn(),
  updateOne: vi.fn(() => Promise.resolve()),
}));

vi.mock("react", async () => ({
  ...(await vi.importActual<typeof import("react")>("react")),
  cache: <T,>(fn: T) => fn,
}));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ connectDB: async () => undefined }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: mocks.header }) }));
vi.mock("next/navigation", () => ({ redirect: () => undefined }));
vi.mock("@/models/User", () => ({ User: { findById: mocks.findById } }));
vi.mock("@/models/ApiKey", () => ({
  ApiKey: { findOne: mocks.findOne, updateOne: mocks.updateOne },
}));

const { getCurrentUser } = await import("@/modules/auth/server/session");

const USER_ID = "507f1f77bcf86cd799439011";
const KEY_ID = "507f1f77bcf86cd799439022";

/** Mimics the `.select().lean()` chain the DAL uses. */
const chain = (result: unknown) => ({ select: () => ({ lean: async () => result }) });

function activeUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: USER_ID,
    name: "Agent Owner",
    email: "owner@gg.ai",
    image: null,
    isActive: true,
    authVersion: 3,
    emailVerifiedAt: new Date(),
    passwordHash: "hash",
    ...overrides,
  };
}

function liveKey(overrides: Record<string, unknown> = {}) {
  return {
    _id: KEY_ID,
    userId: USER_ID,
    authVersion: 3,
    scopes: ["read"],
    expiresAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(null);
  mocks.updateOne.mockReturnValue(Promise.resolve());
  mocks.findById.mockReturnValue(chain(activeUser()));
  mocks.findOne.mockReturnValue(chain(liveKey()));
});

describe("getCurrentUser — API key path", () => {
  it("resolves the owning user from a valid bearer key", async () => {
    const { token } = mintApiKey();
    mocks.header.mockReturnValue(`Bearer ${token}`);

    const user = await getCurrentUser();

    expect(user).toMatchObject({
      id: USER_ID,
      email: "owner@gg.ai",
      via: "apikey",
      scopes: ["read"],
      apiKeyId: KEY_ID,
    });
    // The stored hash is looked up, never the plaintext.
    expect(mocks.findOne.mock.calls[0]?.[0]).toMatchObject({ tokenHash: hashApiKey(token) });
  });

  it("only ever considers keys that are not revoked", async () => {
    mocks.header.mockReturnValue(`Bearer ${mintApiKey().token}`);
    await getCurrentUser();
    expect(mocks.findOne.mock.calls[0]?.[0]).toMatchObject({ revokedAt: null });
  });

  it("rejects an expired key", async () => {
    mocks.header.mockReturnValue(`Bearer ${mintApiKey().token}`);
    mocks.findOne.mockReturnValue(chain(liveKey({ expiresAt: new Date(Date.now() - 1000) })));

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("rejects a key issued before an authVersion bump (the logout-everywhere kill switch)", async () => {
    mocks.header.mockReturnValue(`Bearer ${mintApiKey().token}`);
    mocks.findOne.mockReturnValue(chain(liveKey({ authVersion: 2 })));
    mocks.findById.mockReturnValue(chain(activeUser({ authVersion: 3 })));

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("rejects a key whose owner has been deactivated", async () => {
    mocks.header.mockReturnValue(`Bearer ${mintApiKey().token}`);
    mocks.findById.mockReturnValue(chain(activeUser({ isActive: false })));

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("ignores an Authorization header that is not a GGOps key", async () => {
    mocks.header.mockReturnValue("Bearer sk-some-other-vendor-token");

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(mocks.findOne).not.toHaveBeenCalled();
  });

  it("returns null when there is no credential at all", async () => {
    mocks.header.mockReturnValue(null);
    await expect(getCurrentUser()).resolves.toBeNull();
  });
});

describe("getCurrentUser — cookie session still wins", () => {
  it("uses the session and never reads the Authorization header", async () => {
    mocks.auth.mockResolvedValue({ user: { id: USER_ID, authVersion: 3 } });
    mocks.header.mockReturnValue(`Bearer ${mintApiKey().token}`);

    const user = await getCurrentUser();

    expect(user).toMatchObject({ id: USER_ID, via: "session", scopes: ["read", "write"] });
    expect(mocks.findOne).not.toHaveBeenCalled();
  });

  it("still enforces authVersion on the session path", async () => {
    mocks.auth.mockResolvedValue({ user: { id: USER_ID, authVersion: 1 } });
    mocks.findById.mockReturnValue(chain(activeUser({ authVersion: 3 })));

    await expect(getCurrentUser()).resolves.toBeNull();
  });
});
