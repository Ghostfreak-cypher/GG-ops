import { describe, expect, it } from "vitest";
import { safeNextUrl } from "@/modules/auth/next-url";

const ORIGIN = "https://app.example.com";

describe("safeNextUrl", () => {
  it.each([
    "/",
    "/invite/tok123",
    "/oauth/authorize?client_id=abc&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb#x",
  ])("keeps same-origin path %s unchanged", (path) => {
    expect(safeNextUrl(path, ORIGIN)).toBe(path);
  });

  it.each([null, ""])("falls back to / for %s", (raw) => {
    expect(safeNextUrl(raw, ORIGIN)).toBe("/");
  });

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    " //evil.com",
    "javascript:alert(1)",
    "data:text/html,hi",
  ])("rejects off-origin target %s", (raw) => {
    expect(safeNextUrl(raw, ORIGIN)).toBe("/");
  });
});
