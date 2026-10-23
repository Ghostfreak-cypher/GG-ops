import { describe, expect, it } from "vitest";
import { canEditModuleBoard } from "@/modules/module-board/access";

describe("module board access", () => {
  it("allows MEMBER, ADMIN, and MAINTAINER to edit", () => {
    expect(canEditModuleBoard("MEMBER")).toBe(true);
    expect(canEditModuleBoard("ADMIN")).toBe(true);
    expect(canEditModuleBoard("MAINTAINER")).toBe(true);
  });

  it("keeps GUEST read-only", () => {
    expect(canEditModuleBoard("GUEST")).toBe(false);
  });
});
