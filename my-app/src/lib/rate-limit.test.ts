import { describe, it, expect, vi, afterEach } from "vitest";

function setBaseEnv() {
  process.env.MONGODB_URI = "mongodb+srv://user:pass@cluster.mongodb.net/asana";
  process.env.AUTH_SECRET = "secret";
  process.env.AUTH_GOOGLE_ID = "google-id";
  process.env.AUTH_GOOGLE_SECRET = "google-secret";
}

describe("rateLimit", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("allows when Upstash is not configured", async () => {
    setBaseEnv();
    vi.resetModules();
    const { rateLimit } = await import("@/lib/rate-limit");
    await expect(rateLimit("x", 1, 60)).resolves.toEqual({ allowed: true });
  });

  it("blocks when the counter exceeds the limit", async () => {
    setBaseEnv();
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: 2 }) }),
    );
    vi.resetModules();
    const { rateLimit } = await import("@/lib/rate-limit");

    await expect(rateLimit("x", 1, 60)).resolves.toEqual({ allowed: false, retryAfter: 60 });
  });
});