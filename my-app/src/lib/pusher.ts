import { createHash, createHmac } from "crypto";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

function hasPusherConfig(): boolean {
  return Boolean(env.PUSHER_APP_ID && env.PUSHER_KEY && env.PUSHER_SECRET && env.PUSHER_CLUSTER);
}

export async function publish(
  channel: string,
  event: string,
  payload?: unknown,
): Promise<void> {
  if (!hasPusherConfig()) {
    logger.info("realtime.publish (noop)", { channel, event });
    return;
  }

  const body = JSON.stringify({ name: event, channel, data: JSON.stringify(payload ?? {}) });
  const bodyMd5 = md5(body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const path = `/apps/${env.PUSHER_APP_ID}/events`;
  const params = new URLSearchParams({
    auth_key: env.PUSHER_KEY!,
    auth_timestamp: timestamp,
    auth_version: "1.0",
    body_md5: bodyMd5,
  });
  const stringToSign = `POST\n${path}\n${params.toString()}`;
  const signature = createHmac("sha256", env.PUSHER_SECRET!).update(stringToSign).digest("hex");
  params.set("auth_signature", signature);

  const res = await fetch(
    `https://api-${env.PUSHER_CLUSTER}.pusher.com${path}?${params.toString()}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pusher publish failed (${res.status}): ${text.slice(0, 300)}`);
  }

  logger.info("realtime.published", { channel, event });
}

function md5(value: string): string {
  return createHash("md5").update(value).digest("hex");
}
