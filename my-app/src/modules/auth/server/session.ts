import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { hashApiKey, parseBearerApiKey } from "@/lib/api-key";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { User } from "@/models/User";
import { ApiKey, type ApiKeyScope } from "@/models/ApiKey";

const SESSION_SCOPES: readonly ApiKeyScope[] = ["read", "write"];
const LAST_USED_STALE_MS = 5 * 60 * 1000;

export type AuthedUser = {
  id: string;
  name: string;
  email: string;
  image?: string;
  authVersion: number;
  emailVerified: boolean;
  hasPassword: boolean;
  /** How this request authenticated. Route handlers use it to enforce scopes. */
  via: "session" | "apikey";
  scopes: readonly ApiKeyScope[];
  apiKeyId?: string;
};

/**
 * The one place a user is loaded and validated, shared by both credentials paths.
 * Every caller routes through here so the `isActive` and `authVersion` gates can
 * never drift apart between the cookie session and an API key.
 */
async function loadActiveUser(userId: string, credentialAuthVersion: number) {
  await connectDB();
  const dbUser = await User.findById(parseObjectIdOrThrow(userId))
    .select("_id name email image isActive authVersion emailVerifiedAt passwordHash")
    .lean();
  if (!dbUser?.isActive) return null;

  if (credentialAuthVersion !== (dbUser.authVersion ?? 0)) return null;

  const isVerified = !dbUser.passwordHash || dbUser.emailVerifiedAt === undefined || dbUser.emailVerifiedAt !== null;

  return {
    id: String(dbUser._id),
    name: dbUser.name,
    email: dbUser.email,
    image: dbUser.image ?? undefined,
    authVersion: dbUser.authVersion ?? 0,
    emailVerified: isVerified,
    hasPassword: !!dbUser.passwordHash,
  };
}

/**
 * Resolve `Authorization: Bearer ggops_sk_…` to a user. Only consulted when there is
 * no cookie session, so a browser request can never be escalated by a header.
 */
async function getApiKeyUser(): Promise<AuthedUser | null> {
  const token = parseBearerApiKey((await headers()).get("authorization"));
  if (!token) return null;

  await connectDB();
  const key = await ApiKey.findOne({ tokenHash: hashApiKey(token), revokedAt: null })
    .select("_id userId authVersion scopes expiresAt")
    .lean();
  if (!key) return null;
  if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) return null;

  const user = await loadActiveUser(String(key.userId), key.authVersion);
  if (!user) return null;

  touchApiKey(String(key._id));

  return {
    ...user,
    via: "apikey",
    scopes: key.scopes as ApiKeyScope[],
    apiKeyId: String(key._id),
  };
}

/**
 * Best-effort `lastUsedAt` for stale-key audit. Fire-and-forget, and skipped unless the
 * stamp is already stale so a busy agent doesn't cost a write per request.
 * ponytail: 5-minute granularity. Tighten only if audit ever needs per-call precision.
 */
function touchApiKey(keyId: string) {
  const stale = new Date(Date.now() - LAST_USED_STALE_MS);
  void ApiKey.updateOne(
    { _id: keyId, $or: [{ lastUsedAt: null }, { lastUsedAt: { $lt: stale } }] },
    { $set: { lastUsedAt: new Date() } },
  ).catch(() => {});
}

/** Memoized per-request session user (the DAL entry point). Returns null if signed out. */
export const getCurrentUser = cache(async (): Promise<AuthedUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return getApiKeyUser();

  const user = await loadActiveUser(session.user.id, session.user.authVersion ?? 0);
  if (!user) return null;
  return { ...user, via: "session", scopes: SESSION_SCOPES };
});

/** Use in server components / actions that require auth; redirects to /sign-in otherwise. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?reason=session-expired");
  return user;
}
