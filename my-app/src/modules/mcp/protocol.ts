import { AppError } from "@/lib/api/handler";
import { InvalidObjectIdError } from "@/lib/mongo/ids";
import { logger } from "@/lib/logger";
import type { AuthedUser } from "@/modules/auth/server/session";
import {
  RpcCode,
  RpcError,
  paramsObject,
  type JsonRpcMessage,
} from "@/modules/mcp/jsonrpc";
import { hasScope } from "@/modules/mcp/scope";
import { ResolutionError } from "@/modules/mcp/resolve";
import { MCP_TOOLS, TOOLS_BY_NAME } from "@/modules/mcp/tools";
import { toolDescriptor } from "@/modules/mcp/tools/schema";
import { toolOk, toolError } from "@/modules/mcp/tools/result";

/**
 * MCP method dispatch. Stateless: nothing is remembered between requests, so we never
 * verify that `initialize` was called first. That is inherent to a stateless transport and
 * is what lets the endpoint scale horizontally with no session affinity.
 */

/** Newest first — the first entry is what we fall back to when a client asks for something unknown. */
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

const SERVER_INFO = { name: "ggops", title: "GGOps", version: "1.0.0" } as const;

/**
 * Shown to the model once, at connection time. This is the cheapest place to teach the
 * name-not-ID convention — far more reliable than hoping it infers it from a failed call.
 */
const INSTRUCTIONS = [
  "GGOps is a project-management workspace (workspaces → projects → tasks → comments).",
  "",
  "Refer to workspaces, projects, people, and labels by their human name, email, or slug —",
  "never by database id. Most tools take a `workspace` argument; call `list_workspaces`",
  "first if you don't know which one to use. If a name is ambiguous or unknown, the error",
  "will list the candidates, so read it and retry with an exact value rather than guessing.",
  "",
  "When you're inferring a task from something you read rather than acting on a direct",
  "instruction — a meeting note, an email, anything a human hasn't reviewed — use",
  "create_task_draft instead of create_task. Drafts wait for a person to approve them; there",
  "is no tool that promotes one to a real task on its own.",
].join("\n");

export async function dispatch(message: JsonRpcMessage, user: AuthedUser): Promise<unknown> {
  switch (message.method) {
    case "initialize":
      return initialize(message);

    case "notifications/initialized":
    case "notifications/cancelled":
      return null; // Notifications produce no response; the caller discards this.

    case "ping":
      return {};

    case "tools/list":
      return { tools: visibleTools(user).map(toolDescriptor) };

    case "tools/call":
      return callTool(message, user);

    default:
      throw new RpcError(RpcCode.MethodNotFound, `Unknown method: ${message.method}`);
  }
}

function initialize(message: JsonRpcMessage) {
  const params = paramsObject(message);
  const requested = params.protocolVersion;

  // Negotiate rather than reject: an unknown version means the client is newer (or older)
  // than us, and answering with a version we do speak is the spec's own guidance.
  const protocolVersion =
    typeof requested === "string" &&
    (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
      ? requested
      : SUPPORTED_PROTOCOL_VERSIONS[0];

  return {
    protocolVersion,
    // Only tools. We deliberately advertise no resources/prompts capability, which is why
    // `resources/list` etc. correctly answer MethodNotFound.
    capabilities: { tools: { listChanged: false } },
    serverInfo: SERVER_INFO,
    instructions: INSTRUCTIONS,
  };
}

/**
 * Tools the caller is allowed to use. A read-only key never even sees `create_task` —
 * hiding it is better UX than letting the model call it and be rejected.
 */
function visibleTools(user: AuthedUser) {
  return MCP_TOOLS.filter((tool) => hasScope(user, tool.scope));
}

async function callTool(message: JsonRpcMessage, user: AuthedUser) {
  const params = paramsObject(message);
  const name = params.name;

  if (typeof name !== "string") {
    throw new RpcError(RpcCode.InvalidParams, 'tools/call requires a string "name".');
  }

  const tool = TOOLS_BY_NAME.get(name);
  // Unknown tool is a protocol-level fault: the model picked something that was never
  // advertised, so there is nothing for it to correct from a tool result.
  if (!tool) throw new RpcError(RpcCode.MethodNotFound, `Unknown tool: ${name}`);

  // Re-check scope even though tools/list filtered: a client can call anything it likes,
  // and list-then-call is not a transaction.
  if (!hasScope(user, tool.scope)) {
    return toolError(
      `The "${name}" tool needs the "${tool.scope}" scope, but this API key does not have it. ` +
        `Create a key with the "${tool.scope}" scope at /account/api-keys.`,
    );
  }

  const parsed = tool.inputSchema.safeParse(params.arguments ?? {});
  if (!parsed.success) {
    // Deliberately a tool error, not InvalidParams: the model can fix bad arguments if it
    // sees the message, and many clients swallow -32602 before it reaches the conversation.
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return toolError(`Invalid arguments for ${name} — ${issues}`);
  }

  try {
    return toolOk(await tool.handler(parsed.data, { user }));
  } catch (error) {
    // Anything the model could plausibly act on becomes a readable tool error.
    // ResolutionError is the most important of these: its message names the valid
    // candidates, which is the whole point of the resolver. Letting it fall through to
    // InternalError below would replace "did you mean X or Y?" with "failed unexpectedly".
    if (error instanceof ResolutionError) return toolError(error.message);
    if (error instanceof AppError) return toolError(error.message);
    if (error instanceof InvalidObjectIdError) return toolError(error.message);
    if (error instanceof RpcError) throw error;

    // A genuine bug. Log it server-side and give the model nothing exploitable.
    logger.error("MCP tool threw", {
      tool: name,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new RpcError(RpcCode.InternalError, `The ${name} tool failed unexpectedly.`);
  }
}
