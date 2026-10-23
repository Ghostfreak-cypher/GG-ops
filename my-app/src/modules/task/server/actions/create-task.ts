"use server";

import { requireUser } from "@/modules/auth/server/session";
import { createTaskForActor } from "@/modules/task/server/create-task-core";
import type { ActionResult } from "@/lib/action-result";

/**
 * Authenticated entry point for task creation — the one UI code and route handlers use.
 *
 * The implementation lives in `create-task-core.ts` so callers with no request context
 * (the inbound-email cron) can reach it with an explicitly-verified actor. That actor
 * parameter is exactly why the core cannot live in this `"use server"` file: every export
 * here is a public POST endpoint, so an actor-taking export would be an impersonation hole.
 */
export async function createTaskAction(
  projectId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  return createTaskForActor({ id: user.id, name: user.name ?? "Someone" }, projectId, input);
}
