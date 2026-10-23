import { describe, it, expect, vi, afterEach } from "vitest";
import { logger } from "@/lib/logger";
import { InvalidObjectIdError } from "@/lib/mongo/ids";
import { handle } from "@/lib/api/handler";

// ---------------------------------------------------------------------------
// logger.perf
// ---------------------------------------------------------------------------

describe("logger.perf", () => {
  afterEach(() => vi.restoreAllMocks());

  it("emits info for fast operations", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.perf("board.load", 120, { projectId: "abc" });
    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("perf");
    expect(parsed.action).toBe("board.load");
    expect(parsed.latencyMs).toBe(120);
    expect(parsed.projectId).toBe("abc");
  });

  it("emits warn when latency exceeds threshold", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.perf("task.move", 600, {}, 500);
    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(parsed.level).toBe("warn");
    expect(parsed.latencyMs).toBe(600);
  });

  it("rounds sub-millisecond latency to integer", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.perf("x", 12.7);
    const parsed = JSON.parse(spy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(Number.isInteger(parsed.latencyMs)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handler — InvalidObjectIdError → 400
// ---------------------------------------------------------------------------

describe("handle() InvalidObjectIdError", () => {
  it("returns 400 JSON when handler throws InvalidObjectIdError", async () => {
    const route = handle(async (_req: Request) => {
      throw new InvalidObjectIdError("bad-id");
    });

    const req = new Request("http://localhost/api/test");
    const res = await route(req);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/Invalid ObjectId/);
  });

  it("does not emit a 500 log for InvalidObjectIdError", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const route = handle(async (_req: Request) => {
      throw new InvalidObjectIdError("oops");
    });
    await route(new Request("http://localhost/api/test"));
    // The 500 path logs to console.error; it must not have been called
    expect(errorSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
