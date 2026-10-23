import { randomBytes } from "node:crypto";
import type { ClientSession } from "mongoose";
import { connectDB } from "@/lib/db";
import { withTransaction } from "@/lib/mongo/transactions";
import { hashToken } from "@/lib/auth-security";
import { mintApiKey, OAUTH_ACCESS_TOKEN_TTL_SECONDS } from "@/lib/api-key";
import { ApiKey, type ApiKeyScope } from "@/models/ApiKey";
import { OAuthGrant } from "@/models/OAuthGrant";
import { OAuthClient } from "@/models/OAuthClient";
import { User } from "@/models/User";
import { verifyPkce } from "@/modules/oauth/pkce";
import { revokeGrantAndKey } from "@/modules/oauth/server/actions/revoke-grant";
import {
  tokenRequestSchema,
  type AuthorizationCodeGrantInput,
  type RefreshTokenGrantInput,
} from "@/modules/oauth/schemas";
import type { OAuthResult } from "@/lib/oauth-response";

const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
};

/** Thrown to abort the enclosing transaction and carry the RFC 6749 error back out. */
class OAuthExchangeError extends Error {
  constructor(public readonly result: Extract<OAuthResult<never>, { ok: false }>) {
    super(result.error);
  }
}

function mintRefreshToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

/** Shared by both grant types — the ApiKey row IS the access token (S2's bearer path needs no changes). */
async function mintOAuthAccessToken(params: {
  userId: string;
  clientId: string;
  clientName: string | undefined;
  scopes: ApiKeyScope[];
  authVersion: number;
  session: ClientSession;
}) {
  const { token, tokenHash, prefix } = mintApiKey();
  const [apiKey] = await ApiKey.create(
    [
      {
        userId: params.userId,
        name: `${params.clientName ?? "OAuth client"} (OAuth)`,
        tokenHash,
        prefix,
        kind: "OAUTH",
        clientId: params.clientId,
        scopes: params.scopes,
        authVersion: params.authVersion,
        expiresAt: new Date(Date.now() + OAUTH_ACCESS_TOKEN_TTL_SECONDS * 1000),
      },
    ],
    { session: params.session },
  );
  return { apiKey, accessToken: token };
}

export async function exchangeToken(input: unknown): Promise<OAuthResult<TokenResponse>> {
  const parsed = tokenRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_request", description: parsed.error.issues[0]?.message };
  }
  await connectDB();
  return parsed.data.grant_type === "authorization_code"
    ? exchangeAuthorizationCode(parsed.data)
    : exchangeRefreshToken(parsed.data);
}

async function exchangeAuthorizationCode(
  input: AuthorizationCodeGrantInput,
): Promise<OAuthResult<TokenResponse>> {
  try {
    return await withTransaction(async (session) => {
      // Atomic compare-and-swap: the code can be consumed by exactly one request,
      // even under a concurrent replay race.
      const grant = await OAuthGrant.findOneAndUpdate(
        { codeHash: hashToken(input.code), codeConsumedAt: null, codeExpiresAt: { $gt: new Date() } },
        { $set: { codeConsumedAt: new Date() } },
        { session },
      );
      if (!grant) {
        throw new OAuthExchangeError({
          ok: false,
          error: "invalid_grant",
          description: "Unknown, expired, or already-used code.",
        });
      }
      if (grant.clientId !== input.client_id || grant.redirectUri !== input.redirect_uri) {
        throw new OAuthExchangeError({
          ok: false,
          error: "invalid_grant",
          description: "client_id or redirect_uri mismatch.",
        });
      }
      if (!verifyPkce(input.code_verifier, grant.codeChallenge)) {
        throw new OAuthExchangeError({ ok: false, error: "invalid_grant", description: "PKCE verification failed." });
      }

      const user = await User.findById(grant.userId).select("authVersion isActive").session(session);
      if (!user?.isActive) {
        throw new OAuthExchangeError({ ok: false, error: "invalid_grant", description: "Account unavailable." });
      }
      const client = await OAuthClient.findOne({ clientId: grant.clientId })
        .select("clientName")
        .session(session);

      const { apiKey, accessToken } = await mintOAuthAccessToken({
        userId: String(grant.userId),
        clientId: grant.clientId,
        clientName: client?.clientName,
        scopes: grant.scopes as ApiKeyScope[],
        authVersion: user.authVersion ?? 0,
        session,
      });

      const { token: refreshToken, hash: refreshHash } = mintRefreshToken();
      await OAuthGrant.updateOne(
        { _id: grant._id },
        {
          $set: {
            refreshTokenHash: refreshHash,
            refreshExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
            latestApiKeyId: apiKey._id,
          },
        },
        { session },
      );

      return {
        ok: true,
        data: {
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: "Bearer",
          expires_in: OAUTH_ACCESS_TOKEN_TTL_SECONDS,
          scope: grant.scopes.join(" "),
        },
      } satisfies OAuthResult<TokenResponse>;
    });
  } catch (err) {
    if (err instanceof OAuthExchangeError) return err.result;
    throw err;
  }
}

async function exchangeRefreshToken(input: RefreshTokenGrantInput): Promise<OAuthResult<TokenResponse>> {
  const presentedHash = hashToken(input.refresh_token);
  const { token: newRefreshToken, hash: newRefreshHash } = mintRefreshToken();

  try {
    return await withTransaction(async (session) => {
      // Same atomic CAS discipline as the code exchange: rotate the hash in one shot,
      // so two concurrent uses of the same refresh token can't both succeed.
      const claimed = await OAuthGrant.findOneAndUpdate(
        { refreshTokenHash: presentedHash, revokedAt: null, refreshExpiresAt: { $gt: new Date() } },
        {
          $set: {
            refreshTokenHash: newRefreshHash,
            previousRefreshTokenHash: presentedHash,
            refreshExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
          },
        },
        { session },
      );
      if (!claimed) {
        throw new OAuthExchangeError({
          ok: false,
          error: "invalid_grant",
          description: "Unknown, expired, or already-used refresh token.",
        });
      }
      if (input.client_id && claimed.clientId !== input.client_id) {
        throw new OAuthExchangeError({ ok: false, error: "invalid_grant", description: "client_id mismatch." });
      }

      const user = await User.findById(claimed.userId).select("authVersion isActive").session(session);
      if (!user?.isActive) {
        throw new OAuthExchangeError({ ok: false, error: "invalid_grant", description: "Account unavailable." });
      }
      const client = await OAuthClient.findOne({ clientId: claimed.clientId })
        .select("clientName")
        .session(session);

      // Scopes always come from the grant fixed at consent time — never from this
      // request — so a read-only grant can't self-escalate to write on refresh.
      const { apiKey, accessToken } = await mintOAuthAccessToken({
        userId: String(claimed.userId),
        clientId: claimed.clientId,
        clientName: client?.clientName,
        scopes: claimed.scopes as ApiKeyScope[],
        authVersion: user.authVersion ?? 0,
        session,
      });

      if (claimed.latestApiKeyId) {
        await ApiKey.updateOne(
          { _id: claimed.latestApiKeyId },
          { $set: { revokedAt: new Date() } },
          { session },
        );
      }
      await OAuthGrant.updateOne({ _id: claimed._id }, { $set: { latestApiKeyId: apiKey._id } }, { session });

      return {
        ok: true,
        data: {
          access_token: accessToken,
          refresh_token: newRefreshToken,
          token_type: "Bearer",
          expires_in: OAUTH_ACCESS_TOKEN_TTL_SECONDS,
          scope: claimed.scopes.join(" "),
        },
      } satisfies OAuthResult<TokenResponse>;
    });
  } catch (err) {
    if (err instanceof OAuthExchangeError) {
      // Reuse detection: the presented hash matches a grant's *previous* (already
      // rotated-out) hash — this token was replayed after rotation already happened,
      // a real theft/race signal, not just an expired or malformed token. Kill the
      // whole grant and its live access token, don't just reject this one request.
      const suspect = await OAuthGrant.findOne({ previousRefreshTokenHash: presentedHash })
        .select("_id")
        .lean();
      if (suspect) await revokeGrantAndKey(String(suspect._id));
      return err.result;
    }
    throw err;
  }
}
