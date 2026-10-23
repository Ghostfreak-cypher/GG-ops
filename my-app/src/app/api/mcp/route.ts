import type { AuthedUser } from "@/modules/auth/server/session";
import {
  RpcCode,
  RpcError,
  idOf,
  isNotification,
  parseMessage,
  rpcErrorResponse,
  rpcResult,
  type JsonRpcResponse,
} from "@/modules/mcp/jsonrpc";
import { dispatch } from "@/modules/mcp/protocol";
import { handleMcp, MCP_CORS_HEADERS } from "@/modules/mcp/transport";

/**
 * POST /api/mcp — Model Context Protocol over stateless JSON-RPC 2.0.
 *
 * This is the endpoint `/.well-known/oauth-protected-resource` already advertises as the
 * protected resource, so its path is fixed by shipped OAuth discovery metadata.
 *
 * ⚠️ Responses here do NOT use the app's `{ok, data}` envelope. JSON-RPC has its own wire
 * format and MCP clients parse `result`/`error` directly — see the docstring on
 * `modules/mcp/jsonrpc.ts`. A protocol error is an HTTP 200 carrying an `error` member;
 * only transport-level failures (401/429) use HTTP status codes and the app envelope.
 */

const JSON_HEADERS = { ...MCP_CORS_HEADERS, "content-type": "application/json" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/** 202 + empty body: the correct answer when a payload contained only notifications. */
function accepted(): Response {
  return new Response(null, { status: 202, headers: MCP_CORS_HEADERS });
}

/** Run one message. Returns null for notifications, which by definition get no response. */
async function handleOne(raw: unknown, user: AuthedUser): Promise<JsonRpcResponse | null> {
  let message;
  try {
    message = parseMessage(raw);
  } catch (error) {
    if (error instanceof RpcError) return rpcErrorResponse(idOf(raw), error);
    throw error;
  }

  const notification = isNotification(message);

  try {
    const result = await dispatch(message, user);
    if (notification) return null;
    return rpcResult(message.id as string | number, result);
  } catch (error) {
    // A notification gets no response even when it fails — the client isn't listening.
    if (notification) return null;
    const rpcError =
      error instanceof RpcError
        ? error
        : new RpcError(RpcCode.InternalError, "Internal error.");
    return rpcErrorResponse(message.id as string | number, rpcError);
  }
}

export const POST = handleMcp(async (req, user) => {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    // Malformed JSON: we have no id to echo, so the spec says id: null.
    return json(rpcErrorResponse(null, new RpcError(RpcCode.ParseError, "Invalid JSON.")));
  }

  // Batch. Removed in MCP 2025-06-18 but valid in 2025-03-26, so still supported.
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return json(
        rpcErrorResponse(null, new RpcError(RpcCode.InvalidRequest, "Batch must not be empty.")),
      );
    }
    const responses = (await Promise.all(payload.map((item) => handleOne(item, user)))).filter(
      (r): r is JsonRpcResponse => r !== null,
    );
    // An all-notification batch produces nothing to send back.
    return responses.length === 0 ? accepted() : json(responses);
  }

  const response = await handleOne(payload, user);
  return response === null ? accepted() : json(response);
});

/** Preflight — required before any browser-based client (claude.ai) may POST here. */
export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: MCP_CORS_HEADERS });
}

/**
 * This transport is POST-only: it is stateless, so there is no SSE stream to open with GET
 * and no session to tear down with DELETE. Answer explicitly rather than letting Next
 * return a bare 405 with no `Allow`, so a client probing for the streaming variant learns
 * what is supported.
 */
function methodNotAllowed(): Response {
  return new Response(
    JSON.stringify({ error: "Method not allowed. This MCP endpoint accepts POST only." }),
    { status: 405, headers: { ...JSON_HEADERS, Allow: "POST, OPTIONS" } },
  );
}

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
