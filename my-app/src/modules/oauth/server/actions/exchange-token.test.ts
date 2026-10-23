import { createHash } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashToken } from "@/lib/auth-security";

const CLIENT_ID = "mcp_client1";
const USER_ID = "507f1f77bcf86cd799439011";
const GRANT_ID = "507f1f77bcf86cd799439022";
const OLD_KEY_ID = "507f1f77bcf86cd799439033";
const NEW_KEY_ID = "507f1f77bcf86cd799439044";
const REDIRECT_URI = "https://claude.ai/cb";

const mocks = vi.hoisted(() => ({
  grantFindOneAndUpdate: vi.fn(),
  grantFindOne: vi.fn(),
  grantUpdateOne: vi.fn(async () => undefined),
  grantCreate: vi.fn(),
  clientFindOne: vi.fn(),
  userFindById: vi.fn(),
  apiKeyCreate: vi.fn(),
  apiKeyUpdateOne: vi.fn(async () => undefined),
  revokeGrantAndKey: vi.fn(async () => undefined),
}));

/** Mimics `.select("...").session(session)` — resolves to `result`. */
function selectSession(result: unknown) {
  return { select: () => ({ session: async () => result }) };
}

vi.mock("@/lib/db", () => ({ connectDB: async () => undefined }));
vi.mock("@/lib/mongo/transactions", () => ({
  withTransaction: async (fn: (session: unknown) => unknown) => fn({}),
}));
vi.mock("@/models/OAuthGrant", () => ({
  OAuthGrant: {
    findOneAndUpdate: mocks.grantFindOneAndUpdate,
    findOne: mocks.grantFindOne,
    updateOne: mocks.grantUpdateOne,
    create: mocks.grantCreate,
  },
}));
vi.mock("@/models/OAuthClient", () => ({ OAuthClient: { findOne: mocks.clientFindOne } }));
vi.mock("@/models/User", () => ({ User: { findById: mocks.userFindById } }));
vi.mock("@/models/ApiKey", async () => ({
  ...(await vi.importActual<typeof import("@/models/ApiKey")>("@/models/ApiKey")),
  ApiKey: { create: mocks.apiKeyCreate, updateOne: mocks.apiKeyUpdateOne },
}));
vi.mock("@/modules/oauth/server/actions/revoke-grant", () => ({
  revokeGrantAndKey: mocks.revokeGrantAndKey,
}));

const { exchangeToken } = await import("@/modules/oauth/server/actions/exchange-token");

function verifierAndChallenge() {
  const verifier = "a".repeat(43);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function baseGrant(overrides: Record<string, unknown> = {}) {
  const { challenge } = verifierAndChallenge();
  return {
    _id: GRANT_ID,
    clientId: CLIENT_ID,
    userId: USER_ID,
    redirectUri: REDIRECT_URI,
    codeChallenge: challenge,
    scopes: ["read"],
    latestApiKeyId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.clientFindOne.mockReturnValue(selectSession({ clientName: "Claude" }));
  mocks.userFindById.mockReturnValue(selectSession({ authVersion: 3, isActive: true }));
  mocks.apiKeyCreate.mockImplementation((docs: Record<string, unknown>[]) =>
    Promise.resolve([{ _id: NEW_KEY_ID, ...docs[0] }]),
  );
});

describe("exchangeToken — authorization_code grant", () => {
  it("mints tokens for a valid code", async () => {
    const { verifier } = verifierAndChallenge();
    mocks.grantFindOneAndUpdate.mockResolvedValue(baseGrant());

    const result = await exchangeToken({
      grant_type: "authorization_code",
      code: "some-code",
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.token_type).toBe("Bearer");
    expect(result.data.access_token).toMatch(/^ggops_sk_/);
    expect(result.data.refresh_token).toBeTruthy();
    expect(result.data.expires_in).toBe(3600);

    // The atomic consume filter must require an unconsumed, unexpired code.
    const filter = mocks.grantFindOneAndUpdate.mock.calls[0]?.[0];
    expect(filter).toMatchObject({ codeConsumedAt: null });
  });

  it("rejects a replayed (already-consumed) code — the atomic CAS finds nothing", async () => {
    mocks.grantFindOneAndUpdate.mockResolvedValue(null);

    const result = await exchangeToken({
      grant_type: "authorization_code",
      code: "replayed-code",
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: "whatever",
    });

    expect(result).toMatchObject({ ok: false, error: "invalid_grant" });
    expect(mocks.apiKeyCreate).not.toHaveBeenCalled();
  });

  it("rejects a redirect_uri that doesn't match the grant", async () => {
    const { verifier } = verifierAndChallenge();
    mocks.grantFindOneAndUpdate.mockResolvedValue(baseGrant());

    const result = await exchangeToken({
      grant_type: "authorization_code",
      code: "some-code",
      redirect_uri: "https://attacker.example.com/cb",
      client_id: CLIENT_ID,
      code_verifier: verifier,
    });

    expect(result).toMatchObject({ ok: false, error: "invalid_grant" });
    expect(mocks.apiKeyCreate).not.toHaveBeenCalled();
  });

  it("rejects a wrong PKCE verifier", async () => {
    mocks.grantFindOneAndUpdate.mockResolvedValue(baseGrant());

    const result = await exchangeToken({
      grant_type: "authorization_code",
      code: "some-code",
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: "wrong-verifier-entirely-different",
    });

    expect(result).toMatchObject({ ok: false, error: "invalid_grant" });
    expect(mocks.apiKeyCreate).not.toHaveBeenCalled();
  });

  it("mints the ApiKey with an explicit expiresAt (not the PAT-default null)", async () => {
    const { verifier } = verifierAndChallenge();
    mocks.grantFindOneAndUpdate.mockResolvedValue(baseGrant());

    await exchangeToken({
      grant_type: "authorization_code",
      code: "some-code",
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    });

    const created = mocks.apiKeyCreate.mock.calls[0]?.[0]?.[0];
    expect(created.kind).toBe("OAUTH");
    expect(created.expiresAt).toBeInstanceOf(Date);
    expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("exchangeToken — refresh_token grant", () => {
  it("rotates: mints new tokens and revokes the old ApiKey", async () => {
    mocks.grantFindOneAndUpdate.mockResolvedValue(
      baseGrant({ latestApiKeyId: OLD_KEY_ID }),
    );

    const result = await exchangeToken({ grant_type: "refresh_token", refresh_token: "old-refresh-token" });

    expect(result.ok).toBe(true);
    expect(mocks.apiKeyUpdateOne).toHaveBeenCalledWith(
      { _id: OLD_KEY_ID },
      { $set: { revokedAt: expect.any(Date) } },
      { session: {} },
    );

    // The CAS must stash the presented hash as `previous`, not just overwrite silently.
    const update = mocks.grantFindOneAndUpdate.mock.calls[0]?.[1];
    expect(update.$set.previousRefreshTokenHash).toBe(hashToken("old-refresh-token"));
  });

  it("copies scopes from the grant, never from the request body", async () => {
    mocks.grantFindOneAndUpdate.mockResolvedValue(baseGrant({ scopes: ["read"] }));

    // `exchangeToken` takes `unknown` — deliberately probing that an extraneous
    // `scope` field in the request body is ignored, not used to set ApiKey.scopes.
    await exchangeToken({
      grant_type: "refresh_token",
      refresh_token: "old-refresh-token",
      scope: "read write",
    });

    const created = mocks.apiKeyCreate.mock.calls[0]?.[0]?.[0];
    expect(created.scopes).toEqual(["read"]);
  });

  it("rejects an unknown/expired refresh token with no reuse signal", async () => {
    mocks.grantFindOneAndUpdate.mockResolvedValue(null);
    mocks.grantFindOne.mockReturnValue({ select: () => ({ lean: async () => null }) });

    const result = await exchangeToken({ grant_type: "refresh_token", refresh_token: "garbage" });

    expect(result).toMatchObject({ ok: false, error: "invalid_grant" });
    expect(mocks.revokeGrantAndKey).not.toHaveBeenCalled();
  });

  it("reuse detection: replaying an already-rotated-out refresh token revokes the whole grant", async () => {
    // The CAS fails (this hash is no longer `current` — it was rotated away already),
    // but a lookup by `previousRefreshTokenHash` finds the grant it belonged to.
    mocks.grantFindOneAndUpdate.mockResolvedValue(null);
    mocks.grantFindOne.mockReturnValue({
      select: () => ({ lean: async () => ({ _id: GRANT_ID }) }),
    });

    const result = await exchangeToken({ grant_type: "refresh_token", refresh_token: "stolen-old-token" });

    expect(result).toMatchObject({ ok: false, error: "invalid_grant" });
    expect(mocks.revokeGrantAndKey).toHaveBeenCalledWith(GRANT_ID);
  });

  it("rejects when the account is no longer active", async () => {
    mocks.grantFindOneAndUpdate.mockResolvedValue(baseGrant());
    mocks.userFindById.mockReturnValue(selectSession({ authVersion: 3, isActive: false }));

    const result = await exchangeToken({ grant_type: "refresh_token", refresh_token: "old-refresh-token" });

    expect(result).toMatchObject({ ok: false, error: "invalid_grant" });
    expect(mocks.apiKeyCreate).not.toHaveBeenCalled();
  });
});
