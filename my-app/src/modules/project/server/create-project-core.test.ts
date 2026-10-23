import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("create-project-core module safety", () => {
  it("does NOT carry the \"use server\" directive", () => {
    // As a Server Action module, `createProjectFor(ws, actorId, ...)` would be a public
    // endpoint that creates projects as ANY user.
    const source = readFileSync(fileURLToPath(new URL("./create-project-core.ts", import.meta.url)), "utf8");
    expect(source).not.toMatch(/^\s*["']use server["']/m);
  });
});
