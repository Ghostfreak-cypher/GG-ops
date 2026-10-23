import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { verifyPkce, isValidCodeChallenge } from "@/modules/oauth/pkce";

function challengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

describe("verifyPkce", () => {
  it("accepts the correct verifier", () => {
    const verifier = "a".repeat(43);
    expect(verifyPkce(verifier, challengeFor(verifier))).toBe(true);
  });

  it("rejects a wrong verifier", () => {
    expect(verifyPkce("wrong-verifier", challengeFor("a".repeat(43)))).toBe(false);
  });

  it("rejects an empty verifier against a real challenge", () => {
    expect(verifyPkce("", challengeFor("a".repeat(43)))).toBe(false);
  });
});

describe("isValidCodeChallenge", () => {
  it("accepts a 43-char base64url string", () => {
    expect(isValidCodeChallenge(challengeFor("some-verifier"))).toBe(true);
  });

  it("rejects the wrong length", () => {
    expect(isValidCodeChallenge("tooshort")).toBe(false);
  });

  it("rejects non-base64url characters", () => {
    expect(isValidCodeChallenge("+".repeat(43))).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(isValidCodeChallenge(undefined)).toBe(false);
    expect(isValidCodeChallenge(12345)).toBe(false);
  });
});
