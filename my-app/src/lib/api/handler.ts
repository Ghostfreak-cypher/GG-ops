import { ZodError } from "zod";
import { unstable_rethrow } from "next/navigation";
import { err } from "@/lib/api/response";
import { logger } from "@/lib/logger";
import { captureException } from "@/lib/observability";
import { InvalidObjectIdError } from "@/lib/mongo/ids";
import { rateLimit } from "@/lib/rate-limit";
import { absoluteUrl } from "@/lib/urls";
import { getCurrentUser, type AuthedUser } from "@/modules/auth/server/session";

/** Requests an agent key may make per hour. Generous; the point is a runaway loop, not policing. */
const API_KEY_HOURLY_LIMIT = 600;

/**
 * `requireUser()` bounces anonymous callers with `redirect()`, which throws a
 * NEXT_REDIRECT digest. In a JSON endpoint that means "a guard rejected you", and a
 * 307 to an HTML sign-in page is useless to an API client — so it becomes a 401.
 * Matching on the digest rather than importing `isRedirectError` keeps us off a
 * `next/dist/client/**` internal path (verified constant: `REDIRECT_ERROR_CODE`).
 */
function isRedirectThrow(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

/** Throw this from services/route handlers to return a specific HTTP status. */
export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

/**
 * Wraps a Route Handler so every endpoint shares one error funnel:
 * AppError -> its status, ZodError -> 422, anything else -> logged 500.
 * Usage: `export const POST = handle(async (req, ctx) => { ... })`.
 */
export function handle<Args extends unknown[]>(
  fn: (req: Request, ...args: Args) => Response | Promise<Response>,
) {
  return async (req: Request, ...args: Args): Promise<Response> => {
    try {
      return await fn(req, ...args);
    } catch (error) {
      if (isRedirectThrow(error)) return unauthorized();
      if (error instanceof AppError) return err(error.message, error.status);
      if (error instanceof InvalidObjectIdError) return err(error.message, 400);
      if (error instanceof ZodError) {
        return err(error.issues.map((i) => i.message).join("; "), 422);
      }
      // Let notFound() and other framework signals reach Next instead of becoming a 500.
      unstable_rethrow(error);
      const path = new URL(req.url).pathname;
      logger.error("Unhandled route error", {
        path,
        error: error instanceof Error ? error.message : String(error),
      });
      await captureException(error, { path });
      return err("Internal Server Error", 500);
    }
  };
}

/**
 * 401 in the standard envelope. `resource_metadata` points an OAuth-aware client (or
 * MCP client) at the protected-resource discovery document so it can find the
 * authorization server and start the OAuth flow (S5) without being told out-of-band.
 */
function unauthorized(): Response {
  const resourceMetadata = absoluteUrl("/.well-known/oauth-protected-resource");
  return err("Unauthorized", 401, {
    "WWW-Authenticate": `Bearer realm="ggops", resource_metadata="${resourceMetadata}"`,
  });
}

/**
 * `handle()` plus a resolved principal — the single auth gate for JSON endpoints.
 * Replaces the copy-pasted `getCurrentUser()` / 401 preamble in every route, and is
 * what keeps an anonymous request from reaching an action's `requireUser()` redirect.
 *
 * Scope is enforced by method: a `read` key can GET but not mutate. In-process callers
 * that bypass HTTP (the MCP tool layer) must check `user.scopes` themselves.
 *
 * Usage: `export const GET = handleAuthed(async (req, user, ctx) => { ... })`
 */
export function handleAuthed<Args extends unknown[]>(
  fn: (req: Request, user: AuthedUser, ...args: Args) => Response | Promise<Response>,
) {
  return handle(async (req: Request, ...args: Args) => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const isWrite = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    if (isWrite && !user.scopes.includes("write")) {
      return err("This API key is read-only.", 403);
    }

    if (user.apiKeyId) {
      const limited = await rateLimit(`apikey:${user.apiKeyId}`, API_KEY_HOURLY_LIMIT, 3600, {
        failClosed: true,
      });
      if (!limited.allowed) return err("Too Many Requests", 429);
    }

    return fn(req, user, ...args);
  });
}
