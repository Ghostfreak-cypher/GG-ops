import type { AuthedUser } from "@/modules/auth/server/session";
import type { ApiKeyScope } from "@/models/ApiKey";

/**
 * Does this principal hold `scope`?
 *
 * `handleAuthed` enforces scope by HTTP method (`GET` ⇒ read, everything else ⇒ write).
 * That heuristic cannot work here: every MCP call is a `POST`, so it would reject a
 * read-only key for merely listing tools. `handler.ts`'s own docstring anticipates this —
 * *"In-process callers that bypass HTTP (the MCP tool layer) must check `user.scopes`
 * themselves."* This is that check.
 *
 * Note `write` does not imply `read` anywhere in the model: `scopes` is a flat array and
 * the settings UI sends `["read","write"]` when write is selected. Comparing membership
 * directly is therefore correct — do not add an implication rule here without also
 * changing how keys are minted.
 */
export function hasScope(user: AuthedUser, scope: ApiKeyScope): boolean {
  return user.scopes.includes(scope);
}
