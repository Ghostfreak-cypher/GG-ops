import { describe, it, expect } from "vitest";
import { ok, err } from "@/lib/api/response";

describe("ok", () => {
  it("wraps data as { ok: true, data } with a 200 status by default", async () => {
    const res = ok({ id: 1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { id: 1 } });
  });

  it("honors a custom status", () => {
    expect(ok({}, 201).status).toBe(201);
  });
});

describe("err", () => {
  it("wraps the message as { ok: false, error } with a 400 status by default", async () => {
    const res = err("Bad input");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "Bad input" });
  });

  it("honors a custom status", () => {
    expect(err("Forbidden", 403).status).toBe(403);
  });
});
