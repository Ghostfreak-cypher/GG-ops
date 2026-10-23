import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("task-draft create module safety", () => {
  it('does NOT carry the "use server" directive', () => {
    // createDraftFor takes ctx.workspaceId/userId as parameters with no session check of
    // its own — if this file became a Server Action module, create_task_draft's caller
    // could name any workspace/user it likes.
    const source = readFileSync(fileURLToPath(new URL("./create.ts", import.meta.url)), "utf8");
    expect(source).not.toMatch(/^\s*["']use server["']/m);
  });
});
