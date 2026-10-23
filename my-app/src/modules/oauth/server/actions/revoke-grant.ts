import { connectDB } from "@/lib/db";
import { hashApiKey } from "@/lib/api-key";
import { hashToken } from "@/lib/auth-security";
import { ApiKey } from "@/models/ApiKey";
import { OAuthGrant } from "@/models/OAuthGrant";

/**
 * The single revocation seam: kills both the currently-issued access token AND the
 * refresh capability that would otherwise mint a new one. Called from three places —
 * `/account/api-keys`'s revoke button (via revoke-api-key.ts), `/oauth/revoke`, and
 * reuse-detection in exchange-token.ts when an already-rotated-out refresh token is
 * replayed.
 */
export async function revokeGrantAndKey(grantId: string): Promise<void> {
  await connectDB();
  const grant = await OAuthGrant.findOneAndUpdate(
    { _id: grantId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  ).select("latestApiKeyId");
  if (!grant) return;
  if (grant.latestApiKeyId) {
    await ApiKey.updateOne(
      { _id: grant.latestApiKeyId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }
}

/**
 * Called when a user revokes an ApiKey directly (e.g. from /account/api-keys) — kills
 * refresh capability. The ApiKey itself is revoked by the caller, not here.
 */
export async function revokeGrantForApiKey(apiKeyId: string): Promise<void> {
  await connectDB();
  await OAuthGrant.updateOne(
    { latestApiKeyId: apiKeyId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

/**
 * RFC 7009 revocation by presented token (either an access token or a refresh
 * token — the client isn't required to say which). Tries the access-token hash
 * first, then the grant's current/previous refresh-token hash. Silently no-ops if
 * nothing matches — the route always responds 200 regardless, per spec, so this
 * endpoint can't be used to probe which tokens are valid.
 */
export async function revokeByPresentedToken(token: string): Promise<void> {
  await connectDB();

  const key = await ApiKey.findOne({ tokenHash: hashApiKey(token), revokedAt: null }).select("_id");
  if (key) {
    await ApiKey.updateOne({ _id: key._id }, { $set: { revokedAt: new Date() } });
    await revokeGrantForApiKey(String(key._id));
    return;
  }

  const hash = hashToken(token);
  const grant = await OAuthGrant.findOne({
    revokedAt: null,
    $or: [{ refreshTokenHash: hash }, { previousRefreshTokenHash: hash }],
  }).select("_id");
  if (grant) await revokeGrantAndKey(String(grant._id));
}
