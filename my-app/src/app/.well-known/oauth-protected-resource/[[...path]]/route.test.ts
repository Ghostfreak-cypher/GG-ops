import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { APP_URL: "https://ggops.test" } }));

const { GET } = await import("./route");

const req = () => new Request("https://ggops.test/.well-known/oauth-protected-resource");
const call = (path?: string[]) => GET(req(), { params: Promise.resolve({ path }) });

describe("protected-resource metadata discovery", () => {
  it("answers the bare path Claude reads from the 401 resource_metadata hint", async () => {
    const res = await call(undefined);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      resource: "https://ggops.test/api/mcp",
      authorization_servers: ["https://ggops.test"],
      scopes_supported: ["read", "write"],
    });
  });

  /**
   * The reason this route is a catch-all. Codex probes this URL instead of following the
   * 401 hint (openai/codex#42427); a 404 here aborts its OAuth discovery.
   */
  it("answers RFC 9728's path-inserted URL with the identical document", async () => {
    const [bare, inserted] = await Promise.all([call(undefined), call(["api", "mcp"])]);

    expect(inserted.status).toBe(200);
    expect(await inserted.json()).toEqual(await bare.json());
  });

  it("404s any other suffix rather than claiming it as a protected resource", async () => {
    expect((await call(["nope"])).status).toBe(404);
    expect((await call(["api", "v1"])).status).toBe(404);
  });
});
