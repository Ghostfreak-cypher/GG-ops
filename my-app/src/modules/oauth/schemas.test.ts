import { describe, it, expect } from "vitest";
import { registerClientSchema, authorizeParamsSchema } from "@/modules/oauth/schemas";

describe("registerClientSchema — redirect_uris", () => {
  it("accepts https", () => {
    expect(registerClientSchema.safeParse({ redirect_uris: ["https://claude.ai/callback"] }).success).toBe(true);
  });

  it("accepts http on localhost/127.0.0.1/::1 (native-app loopback carve-out)", () => {
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      const result = registerClientSchema.safeParse({ redirect_uris: [`http://${host}:8080/cb`] });
      expect(result.success, `expected http://${host} to be accepted`).toBe(true);
    }
  });

  it("rejects http on a non-loopback host", () => {
    expect(registerClientSchema.safeParse({ redirect_uris: ["http://evil.example.com/cb"] }).success).toBe(false);
  });

  it("rejects a redirect_uri with a fragment", () => {
    expect(registerClientSchema.safeParse({ redirect_uris: ["https://claude.ai/cb#frag"] }).success).toBe(false);
  });

  it("rejects a malformed URL", () => {
    expect(registerClientSchema.safeParse({ redirect_uris: ["not-a-url"] }).success).toBe(false);
  });

  it("rejects an empty redirect_uris array", () => {
    expect(registerClientSchema.safeParse({ redirect_uris: [] }).success).toBe(false);
  });
});

describe("authorizeParamsSchema", () => {
  const base = {
    response_type: "code",
    client_id: "mcp_abc",
    redirect_uri: "https://claude.ai/cb",
    code_challenge: "a".repeat(43),
    code_challenge_method: "S256",
  };

  it("accepts a well-formed request", () => {
    expect(authorizeParamsSchema.safeParse(base).success).toBe(true);
  });

  it("rejects code_challenge_method=plain — S256 is mandatory, no fallback", () => {
    const result = authorizeParamsSchema.safeParse({ ...base, code_challenge_method: "plain" });
    expect(result.success).toBe(false);
  });

  it("rejects response_type other than 'code'", () => {
    expect(authorizeParamsSchema.safeParse({ ...base, response_type: "token" }).success).toBe(false);
  });

  it("defaults scope to ['read'] when omitted", () => {
    const result = authorizeParamsSchema.safeParse(base);
    expect(result.success && result.data.scope).toEqual(["read"]);
  });

  it("parses a space-delimited scope into an array", () => {
    const result = authorizeParamsSchema.safeParse({ ...base, scope: "read write" });
    expect(result.success && result.data.scope).toEqual(["read", "write"]);
  });

  it("falls back to ['read'] for unrecognized scope values", () => {
    const result = authorizeParamsSchema.safeParse({ ...base, scope: "bogus" });
    expect(result.success && result.data.scope).toEqual(["read"]);
  });
});
