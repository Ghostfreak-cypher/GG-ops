import { describe, it, expect } from "vitest";
import { WORKSPACE_ROLES, isAtLeast } from "@/modules/workspace/roles";

describe("WORKSPACE_ROLES", () => {
  it("lists the four roles", () => {
    expect(WORKSPACE_ROLES).toEqual(["MAINTAINER", "ADMIN", "MEMBER", "GUEST"]);
  });
});

describe("isAtLeast", () => {
  it("treats higher roles as satisfying a lower requirement", () => {
    expect(isAtLeast("ADMIN", "MEMBER")).toBe(true);
    expect(isAtLeast("MAINTAINER", "GUEST")).toBe(true);
  });

  it("treats equal roles as satisfied", () => {
    expect(isAtLeast("MEMBER", "MEMBER")).toBe(true);
  });

  it("treats lower roles as not satisfied", () => {
    expect(isAtLeast("MEMBER", "ADMIN")).toBe(false);
    expect(isAtLeast("GUEST", "MEMBER")).toBe(false);
  });
});
