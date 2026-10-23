import { describe, it, expect, vi, afterEach } from "vitest";

function setBaseEnv() {
  process.env.MONGODB_URI = "mongodb+srv://user:pass@cluster.mongodb.net/asana";
  process.env.AUTH_SECRET = "secret";
  process.env.AUTH_GOOGLE_ID = "google-id";
  process.env.AUTH_GOOGLE_SECRET = "google-secret";
}

describe("absoluteUrl", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("keeps absolute urls unchanged", async () => {
    setBaseEnv();
    vi.resetModules();
    const { absoluteUrl } = await import("@/lib/urls");
    expect(absoluteUrl("https://app.example.com/invite/tok")).toBe("https://app.example.com/invite/tok");
  });

  it("builds absolute urls from APP_URL", async () => {
    setBaseEnv();
    process.env.APP_URL = "https://app.example.com";
    vi.resetModules();
    const { absoluteUrl } = await import("@/lib/urls");
    expect(absoluteUrl("/invite/tok")).toBe("https://app.example.com/invite/tok");
  });
});

describe("issuerUrl", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  // RFC 9207 compares the `iss` we redirect with against the metadata issuer by exact
  // string match, so a trailing slash on either side aborts the authorization.
  it.each(["https://ggops.genegenius.ai", "https://ggops.genegenius.ai/"])(
    "has no trailing slash for APP_URL %s",
    async (appUrl) => {
      setBaseEnv();
      process.env.APP_URL = appUrl;
      vi.resetModules();
      const { issuerUrl } = await import("@/lib/urls");
      expect(issuerUrl()).toBe("https://ggops.genegenius.ai");
    },
  );
});