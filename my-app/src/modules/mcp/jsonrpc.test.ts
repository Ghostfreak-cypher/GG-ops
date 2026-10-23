import { describe, it, expect } from "vitest";
import {
  RpcCode,
  RpcError,
  idOf,
  isNotification,
  paramsObject,
  parseMessage,
  rpcErrorResponse,
  rpcResult,
} from "@/modules/mcp/jsonrpc";

describe("parseMessage", () => {
  it("accepts a well-formed request", () => {
    const m = parseMessage({ jsonrpc: "2.0", id: 1, method: "ping" });
    expect(m.method).toBe("ping");
    expect(m.id).toBe(1);
  });

  it("accepts a notification (no id)", () => {
    const m = parseMessage({ jsonrpc: "2.0", method: "notifications/initialized" });
    expect(isNotification(m)).toBe(true);
  });

  const malformed: [label: string, input: unknown][] = [
    ["a bare string", "not an object"],
    ["null", null],
    ["an array", []],
    ["a message with no jsonrpc member", { id: 1, method: "ping" }],
    ["the wrong jsonrpc version", { jsonrpc: "1.0", id: 1, method: "ping" }],
    ["a message with no method", { jsonrpc: "2.0", id: 1 }],
    ["an empty method", { jsonrpc: "2.0", id: 1, method: "" }],
  ];

  it.each(malformed)("rejects %s as InvalidRequest", (_label, input) => {
    expect(() => parseMessage(input)).toThrow(RpcError);
    try {
      parseMessage(input);
    } catch (e) {
      expect((e as RpcError).code).toBe(RpcCode.InvalidRequest);
    }
  });

  it("rejects a null id rather than treating it as a notification", () => {
    // MCP forbids a null id. Treating {id: null} as a notification would silently
    // swallow a malformed request instead of reporting it.
    expect(() => parseMessage({ jsonrpc: "2.0", id: null, method: "ping" })).toThrow(RpcError);
  });

  it("rejects non-object params", () => {
    try {
      parseMessage({ jsonrpc: "2.0", id: 1, method: "ping", params: "nope" });
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as RpcError).code).toBe(RpcCode.InvalidParams);
    }
  });
});

describe("isNotification", () => {
  it("keys on absence of id, not on falsy id", () => {
    expect(isNotification({ jsonrpc: "2.0", method: "x" })).toBe(true);
    // id 0 is a legal id and must NOT be read as a notification.
    expect(isNotification({ jsonrpc: "2.0", id: 0, method: "x" })).toBe(false);
    expect(isNotification({ jsonrpc: "2.0", id: "", method: "x" })).toBe(false);
  });
});

describe("idOf", () => {
  it("extracts usable ids and nulls everything else", () => {
    expect(idOf({ id: 7 })).toBe(7);
    expect(idOf({ id: "abc" })).toBe("abc");
    expect(idOf({ id: null })).toBeNull();
    expect(idOf({})).toBeNull();
    expect(idOf("garbage")).toBeNull();
  });
});

describe("response envelopes", () => {
  it("builds a result", () => {
    expect(rpcResult(1, { ok: true })).toEqual({ jsonrpc: "2.0", id: 1, result: { ok: true } });
  });

  it("builds an error and omits absent data", () => {
    const r = rpcErrorResponse(1, new RpcError(RpcCode.MethodNotFound, "nope")) as {
      error: Record<string, unknown>;
    };
    expect(r.error).toEqual({ code: -32601, message: "nope" });
    expect("data" in r.error).toBe(false);
  });

  it("includes data when provided", () => {
    const r = rpcErrorResponse(1, new RpcError(RpcCode.InvalidParams, "bad", { field: "x" })) as {
      error: { data?: unknown };
    };
    expect(r.error.data).toEqual({ field: "x" });
  });

  it("uses the standard code numbers", () => {
    expect(RpcCode).toEqual({
      ParseError: -32700,
      InvalidRequest: -32600,
      MethodNotFound: -32601,
      InvalidParams: -32602,
      InternalError: -32603,
    });
  });
});

describe("paramsObject", () => {
  it("defaults to {} and rejects arrays", () => {
    expect(paramsObject({ jsonrpc: "2.0", method: "x" })).toEqual({});
    expect(paramsObject({ jsonrpc: "2.0", method: "x", params: { a: 1 } })).toEqual({ a: 1 });
    expect(() => paramsObject({ jsonrpc: "2.0", method: "x", params: [1] })).toThrow(RpcError);
  });
});
