import crypto from "crypto";
import { headers } from "next/headers";
import { connectDB } from "@/lib/db";
import { absoluteUrl } from "@/lib/urls";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { enqueue } from "@/lib/queue";
import { logger } from "@/lib/logger";
import { AuthToken } from "@/models/AuthToken";
import { LoginEvent } from "@/models/LoginEvent";
import { User } from "@/models/User";

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
export const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const LOGIN_EVENT_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

export type AuthTokenType = "PASSWORD_RESET" | "EMAIL_VERIFY";
export type LoginProvider = "credentials" | "google";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createRawToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function ttlFor(type: AuthTokenType): number {
  return type === "PASSWORD_RESET" ? PASSWORD_RESET_TTL_MS : EMAIL_VERIFY_TTL_MS;
}

export async function issueAuthToken(userId: string, type: AuthTokenType): Promise<string> {
  await connectDB();
  await AuthToken.updateMany(
    {
      userId: parseObjectIdOrThrow(userId),
      type,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { consumedAt: new Date() } },
  );

  const rawToken = createRawToken();
  await AuthToken.create({
    userId: parseObjectIdOrThrow(userId),
    type,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + ttlFor(type)),
  });
  return rawToken;
}

export async function consumeAuthToken(token: string, type: AuthTokenType): Promise<string | null> {
  await connectDB();
  // One atomic claim, so two concurrent requests can't both spend the same token.
  const doc = await AuthToken.findOneAndUpdate(
    { tokenHash: hashToken(token), type, consumedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { consumedAt: new Date() } },
  )
    .select("userId")
    .lean();
  return doc ? String(doc.userId) : null;
}

export async function sendPasswordResetEmail(userId: string): Promise<void> {
  await connectDB();
  const user = await User.findById(parseObjectIdOrThrow(userId))
    .select("email name passwordHash")
    .lean();
  if (!user?.email || !user.passwordHash) return;
  const token = await issueAuthToken(userId, "PASSWORD_RESET");
  enqueue("password-reset-email", {
    email: user.email,
    name: user.name,
    resetUrl: absoluteUrl(`/reset-password?token=${token}`),
  });
}

export async function sendVerificationEmail(userId: string): Promise<void> {
  await connectDB();
  const user = await User.findById(parseObjectIdOrThrow(userId))
    .select("email name emailVerifiedAt")
    .lean();
  if (!user?.email || user.emailVerifiedAt) return;
  const token = await issueAuthToken(userId, "EMAIL_VERIFY");
  enqueue("email-verification-email", {
    email: user.email,
    name: user.name,
    verifyUrl: absoluteUrl(`/verify-email?token=${token}`),
  });
}

export async function markUserEmailVerified(userId: string): Promise<void> {
  await connectDB();
  await User.updateOne({ _id: parseObjectIdOrThrow(userId) }, { $set: { emailVerifiedAt: new Date() } });
}

async function getRequestMetadata(request?: Request): Promise<{ ip: string | null; userAgent: string | null }> {
  if (request) {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    return {
      ip: forwarded || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    };
  }

  const hdrs = await headers();
  const forwarded = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return {
    ip: forwarded || hdrs.get("x-real-ip"),
    userAgent: hdrs.get("user-agent"),
  };
}

function maskIp(ip: string | null): string | null {
  if (!ip) return null;
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return `${parts.slice(0, 4).join(":")}:*`;
  }
  const parts = ip.split(".");
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.${parts[2]}.*`;
}

function fingerprint(provider: LoginProvider, ip: string | null, userAgent: string | null): string {
  return hashToken([provider, ip ?? "unknown-ip", userAgent ?? "unknown-ua"].join("|"));
}

export async function recordLoginEvent(input: { userId: string; provider: LoginProvider; request?: Request }): Promise<void> {
  await connectDB();
  const user = await User.findById(parseObjectIdOrThrow(input.userId)).select("email name").lean();
  if (!user?.email) return;

  const { ip, userAgent } = await getRequestMetadata(input.request);
  const fingerprintHash = fingerprint(input.provider, ip, userAgent);
  const occurredAt = new Date();
  const existing = await LoginEvent.findOne({
    userId: parseObjectIdOrThrow(input.userId),
    fingerprintHash,
    occurredAt: { $gte: new Date(Date.now() - LOGIN_EVENT_RETENTION_MS) },
  })
    .sort({ occurredAt: -1 })
    .lean();

  await LoginEvent.create({
    userId: parseObjectIdOrThrow(input.userId),
    provider: input.provider,
    fingerprintHash,
    ipMasked: maskIp(ip),
    userAgent: userAgent?.slice(0, 500) ?? null,
    occurredAt,
    alertSentAt: existing ? existing.alertSentAt ?? null : occurredAt,
  });

  await LoginEvent.deleteMany({
    userId: parseObjectIdOrThrow(input.userId),
    occurredAt: { $lt: new Date(Date.now() - LOGIN_EVENT_RETENTION_MS) },
  });

  if (existing) return;

  enqueue("login-alert-email", {
    email: user.email,
    name: user.name,
    provider: input.provider,
    occurredAt: occurredAt.toISOString(),
    ipAddress: maskIp(ip) ?? "Unknown",
    userAgent: userAgent ?? "Unknown device",
    securityUrl: absoluteUrl("/account/security"),
  });
}

export async function sendPasswordChangedEmail(userId: string): Promise<void> {
  await connectDB();
  const user = await User.findById(parseObjectIdOrThrow(userId)).select("email name").lean();
  if (!user?.email) return;
  enqueue("password-changed-email", {
    email: user.email,
    name: user.name,
    securityUrl: absoluteUrl("/account/security"),
  });
}

export async function bumpAuthVersion(userId: string, passwordHash: string): Promise<void> {
  await connectDB();
  await User.updateOne(
    { _id: parseObjectIdOrThrow(userId) },
    {
      $set: { passwordHash, lastPasswordChangedAt: new Date() },
      $inc: { authVersion: 1 },
    },
  );
}

export async function consumeVerificationToken(token: string): Promise<string | null> {
  const userId = await consumeAuthToken(token, "EMAIL_VERIFY");
  if (!userId) return null;
  await markUserEmailVerified(userId);
  return userId;
}

export async function consumePasswordResetToken(token: string, passwordHash: string): Promise<string | null> {
  const userId = await consumeAuthToken(token, "PASSWORD_RESET");
  if (!userId) return null;
  await bumpAuthVersion(userId, passwordHash);
  await sendPasswordChangedEmail(userId);
  return userId;
}

export async function listRecentLogins(userId: string): Promise<
  Array<{ id: string; provider: LoginProvider; ipMasked: string | null; userAgent: string | null; occurredAt: string }>
> {
  await connectDB();
  const events = await LoginEvent.find({ userId: parseObjectIdOrThrow(userId) })
    .sort({ occurredAt: -1 })
    .limit(10)
    .lean();
  return events.map((event) => ({
    id: String(event._id),
    provider: event.provider as LoginProvider,
    ipMasked: event.ipMasked ?? null,
    userAgent: event.userAgent ?? null,
    occurredAt: event.occurredAt.toISOString(),
  }));
}

export function logSecurityError(message: string, error: unknown): void {
  logger.error(message, { error: error instanceof Error ? error.message : String(error) });
}
