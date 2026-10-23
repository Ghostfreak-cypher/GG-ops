import { randomBytes } from "node:crypto";

/** Cryptographically-random, URL-safe invite token (64 hex chars). */
export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export function isInviteExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return now.getTime() > expiresAt.getTime();
}

/** Default invite lifetime: 7 days from `from`. */
export function inviteExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
}
