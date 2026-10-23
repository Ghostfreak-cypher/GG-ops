import type { z } from "zod";
import type { AuthedUser } from "@/modules/auth/server/session";
import type { ApiKeyScope } from "@/models/ApiKey";

export type McpToolContext = { user: AuthedUser };

/**
 * One agent-callable tool.
 *
 * `scope` is declared per tool rather than derived from an HTTP method, because every MCP
 * call arrives as a POST. `tools/list` filters on it and `tools/call` re-checks it — see
 * the note in `../transport.ts` about why `handleAuthed` can't be used here.
 *
 * `description` is the model's primary signal for choosing a tool: write it for the model,
 * and say *when* to reach for it, not just what it does.
 */
export type McpTool<S extends z.ZodType = z.ZodType> = {
  name: string;
  title: string;
  description: string;
  inputSchema: S;
  scope: ApiKeyScope;
  handler: (args: z.output<S>, ctx: McpToolContext) => Promise<unknown>;
};

/**
 * Preserves per-tool argument inference at the definition site while letting the registry
 * store the erased `McpTool` type. Without this, `handler`'s `args` would widen to `unknown`
 * as soon as tools of different shapes land in one array.
 */
export function defineTool<S extends z.ZodType>(tool: McpTool<S>): McpTool {
  return tool as unknown as McpTool;
}
