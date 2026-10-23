import { describe, it, expect } from "vitest";
import {
  canCreateProject,
  canInviteMembers,
  canManageMembers,
  canDeleteWorkspace,
  canSubmitDsr,
  canViewAllDsr,
} from "@/modules/workspace/server/permissions";
import { WORKSPACE_ROLES } from "@/modules/workspace/roles";

describe("workspace permissions", () => {
  it("lets MEMBER and up create projects, but not GUEST", () => {
    expect(canCreateProject("MEMBER")).toBe(true);
    expect(canCreateProject("ADMIN")).toBe(true);
    expect(canCreateProject("GUEST")).toBe(false);
  });

  it("lets ADMIN and up invite/manage members", () => {
    expect(canInviteMembers("ADMIN")).toBe(true);
    expect(canInviteMembers("MEMBER")).toBe(false);
    expect(canManageMembers("MAINTAINER")).toBe(true);
    expect(canManageMembers("MEMBER")).toBe(false);
  });

  it("only the MAINTAINER can delete the workspace", () => {
    expect(canDeleteWorkspace("MAINTAINER")).toBe(true);
    expect(canDeleteWorkspace("ADMIN")).toBe(false);
  });
});

describe("DSR permissions", () => {
  it("lets everyone but a GUEST file a report", () => {
    expect(canSubmitDsr("MAINTAINER")).toBe(true);
    expect(canSubmitDsr("ADMIN")).toBe(true);
    expect(canSubmitDsr("MEMBER")).toBe(true);
    expect(canSubmitDsr("GUEST")).toBe(false);
  });

  it("lets ADMIN and up read the whole team's reports", () => {
    expect(canViewAllDsr("MAINTAINER")).toBe(true);
    expect(canViewAllDsr("ADMIN")).toBe(true);
    expect(canViewAllDsr("MEMBER")).toBe(false);
    expect(canViewAllDsr("GUEST")).toBe(false);
  });

  /**
   * The invariant the DSR pages rest on: every reader of the whole team is also a filer.
   *
   * The roster lists exactly the people who can file, and the per-member page re-filters by
   * the same predicate — so a reader who couldn't file would be reading a page they don't
   * appear on, with their own row 404ing.
   */
  it("keeps every reader of all reports a filer too", () => {
    for (const role of WORKSPACE_ROLES) {
      expect(canViewAllDsr(role) && !canSubmitDsr(role)).toBe(false);
    }
  });
});
