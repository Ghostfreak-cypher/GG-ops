/**
 * JSON-RPC 2.0 envelope handling for the MCP endpoint.
 *
 * ⚠️ These responses deliberately do NOT use this app's `{ok, data}` / `{ok, error}`
 * envelope (`lib/api/response.ts`). JSON-RPC defines its own wire format, and every MCP
 * client parses `result` / `error` directly — wrapping them would make the endpoint
 * unusable. Same deliberate exception `lib/oauth-response.ts` makes for RFC 6749.
 * A protocol error is an HTTP **200** carrying an `error` member, not an HTTP 4xx.
 */

export const JSONRPC_VERSION = "2.0";

export type JsonRpcId = string | number;

export type JsonRpcMessage = {
  jsonrpc: string;
  id?: JsonRpcId;
  method: string;
  params?: unknown;
};

export type JsonRpcResponse =
  | { jsonrpc: typeof JSONRPC_VERSION; id: JsonRpcId; result: unknown }
  | {
      jsonrpc: typeof JSONRPC_VERSION;
      id: JsonRpcId | null;
      error: { code: number; message: string; data?: unknown };
    };

/** Standard JSON-RPC 2.0 error codes. */
export const RpcCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
} as const;

/** Throw to abort a method and surface a protocol-level error to the client. */
export class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "RpcError";
  }
}

export function rpcResult(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: JSONRPC_VERSION, id, result };
}

export function rpcErrorResponse(id: JsonRpcId | null, error: RpcError): JsonRpcResponse {
  return {
    jsonrpc: JSONRPC_VERSION,
    id,
    error: {
      code: error.code,
      message: error.message,
      ...(error.data === undefined ? {} : { data: error.data }),
    },
  };
}

/**
 * A notification is a message with **no `id` member at all**.
 *
 * Keyed on absence, not on `id === null`: MCP forbids a null id, so `{"id": null}` is a
 * malformed *request* (→ InvalidRequest), not a notification. Getting this backwards would
 * silently swallow a malformed call instead of reporting it.
 */
export function isNotification(message: JsonRpcMessage): boolean {
  return !("id" in message);
}

/** Extract the id for echoing in an error response, or null when there isn't a usable one. */
export function idOf(raw: unknown): JsonRpcId | null {
  if (typeof raw !== "object" || raw === null) return null;
  const id = (raw as { id?: unknown }).id;
  return typeof id === "string" || typeof id === "number" ? id : null;
}

/** Validate one message's envelope. Throws `RpcError(InvalidRequest)` if malformed. */
export function parseMessage(raw: unknown): JsonRpcMessage {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new RpcError(RpcCode.InvalidRequest, "Request must be a JSON object.");
  }
  const message = raw as Record<string, unknown>;

  if (message.jsonrpc !== JSONRPC_VERSION) {
    throw new RpcError(RpcCode.InvalidRequest, 'Missing or invalid "jsonrpc": must be "2.0".');
  }
  if (typeof message.method !== "string" || message.method.length === 0) {
    throw new RpcError(RpcCode.InvalidRequest, 'Missing or invalid "method".');
  }
  if ("id" in message) {
    const id = message.id;
    if (typeof id !== "string" && typeof id !== "number") {
      // Explicitly including null: the MCP spec forbids a null id.
      throw new RpcError(RpcCode.InvalidRequest, '"id" must be a string or number.');
    }
  }
  if ("params" in message && message.params !== undefined) {
    const params = message.params;
    if (typeof params !== "object" || params === null) {
      throw new RpcError(RpcCode.InvalidParams, '"params" must be an object or array.');
    }
  }

  return message as unknown as JsonRpcMessage;
}

/** `params` as a plain object — MCP only ever uses by-name params. */
export function paramsObject(message: JsonRpcMessage): Record<string, unknown> {
  const params = message.params;
  if (params === undefined || params === null) return {};
  if (typeof params !== "object" || Array.isArray(params)) {
    throw new RpcError(RpcCode.InvalidParams, "params must be an object.");
  }
  return params as Record<string, unknown>;
}
