import { describe, it, expect } from "vitest";
import { generateInviteToken, isInviteExpired } from "@/modules/workspace/invites";

describe("generateInviteToken", () => {
  it("returns a 64-char hex token", () => {
    expect(generateInviteToken()).toMatch(/^[0-9a-f]{64}$/);
  });
  it("returns a different token each call", () => {
    expect(generateInviteToken()).not.toBe(generateInviteToken());
  });
});

describe("isInviteExpired", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  it("is false when expiry is in the future", () => {
    expect(isInviteExpired(new Date("2026-01-02T00:00:00Z"), now)).toBe(false);
  });
  it("is true when expiry has passed", () => {
    expect(isInviteExpired(new Date("2025-12-31T00:00:00Z"), now)).toBe(true);
  });
});
