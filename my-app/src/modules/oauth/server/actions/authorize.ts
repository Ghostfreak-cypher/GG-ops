"use server";

import { randomBytes } from "node:crypto";
import { redirect, notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { hashToken } from "@/lib/auth-security";
import { issuerUrl } from "@/lib/urls";
import { requireUser } from "@/modules/auth/server/session";
import { OAuthGrant } from "@/models/OAuthGrant";
import { getClientByClientId } from "@/modules/oauth/server/queries";
import { authorizeParamsSchema } from "@/modules/oauth/schemas";
import { isValidCodeChallenge } from "@/modules/oauth/pkce";
import type { ApiKeyScope } from "@/models/ApiKey";

const CODE_TTL_MS = 60 * 1000;

type ValidatedRequest = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: ApiKeyScope[];
  state?: string;
};

/**
 * Re-derives and re-validates everything from the raw form data. Per
 * `.claude/rules/api-auth-security.md`, Server Actions are public-facing and must
 * never trust that a page's earlier GET-time validation (or the hidden fields
 * themselves) went unmolested between render and submit.
 *
 * Returns null if `client_id`/`redirect_uri` themselves don't check out — in that
 * case there is nowhere *safe* to redirect an error to, so the caller must render an
 * error page instead of calling redirect() with an unverified URL.
 */
async function revalidate(formData: FormData): Promise<ValidatedRequest | null> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = authorizeParamsSchema.safeParse(raw);
  if (!parsed.success) return null;

  const client = await getClientByClientId(parsed.data.client_id);
  if (!client) return null;
  if (!client.redirectUris.includes(parsed.data.redirect_uri)) return null;
  if (!isValidCodeChallenge(parsed.data.code_challenge)) return null;

  return {
    clientId: client.clientId,
    redirectUri: parsed.data.redirect_uri,
    codeChallenge: parsed.data.code_challenge,
    scopes: parsed.data.scope,
    state: parsed.data.state,
  };
}

export async function approveAuthorizationAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const validated = await revalidate(formData);
  if (!validated) notFound();

  await connectDB();
  const rawCode = randomBytes(32).toString("base64url");
  await OAuthGrant.create({
    clientId: validated.clientId,
    userId: user.id,
    redirectUri: validated.redirectUri,
    codeChallenge: validated.codeChallenge,
    scopes: validated.scopes,
    codeHash: hashToken(rawCode),
    codeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  const target = new URL(validated.redirectUri);
  target.searchParams.set("code", rawCode);
  if (validated.state) target.searchParams.set("state", validated.state);
  // RFC 9207 — lets a client that connects to many different MCP servers (as
  // claude.ai/Gemini legitimately do) detect an authorization-server mix-up.
  target.searchParams.set("iss", issuerUrl());
  redirect(target.toString());
}

export async function denyAuthorizationAction(formData: FormData): Promise<void> {
  await requireUser();
  const validated = await revalidate(formData);
  if (!validated) notFound();

  const target = new URL(validated.redirectUri);
  target.searchParams.set("error", "access_denied");
  if (validated.state) target.searchParams.set("state", validated.state);
  redirect(target.toString());
}
