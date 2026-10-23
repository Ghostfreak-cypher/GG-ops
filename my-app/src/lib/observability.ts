import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export async function captureException(error: unknown, context?: Record<string, unknown>): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  logger.error("exception", { error: message, ...context });

  if (!env.SENTRY_DSN) return;

  try {
    const dsn = new URL(env.SENTRY_DSN);
    const publicKey = dsn.username;
    const projectId = dsn.pathname.replace(/^\//, "");
    if (!publicKey || !projectId) return;

    const envelope = JSON.stringify({ dsn: env.SENTRY_DSN }) +
      "\n" +
      JSON.stringify({ type: "event" }) +
      "\n" +
      JSON.stringify({
        event_id: crypto.randomUUID().replace(/-/g, ""),
        timestamp: new Date().toISOString(),
        level: "error",
        exception: {
          values: [
            {
              type: error instanceof Error ? error.name : "Error",
              value: message,
              stacktrace: error instanceof Error ? { frames: [] } : undefined,
            },
          ],
        },
        extra: context ?? {},
        platform: "javascript",
      });

    await fetch(`https://${dsn.host}/api/${projectId}/envelope/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body: envelope,
    });
  } catch (captureError) {
    logger.warn("sentry.capture failed", {
      error: captureError instanceof Error ? captureError.message : String(captureError),
    });
  }
}