import { describe, it, expect } from "vitest";
import { buildTaskFilter } from "@/modules/task/filters";

describe("buildTaskFilter", () => {
  it("returns the base unchanged with empty filters", () => {
    expect(buildTaskFilter({ workspaceId: "w" }, {})).toEqual({ workspaceId: "w" });
  });

  it("adds status/priority/assignee/label when present", () => {
    expect(
      buildTaskFilter(
        { workspaceId: "w" },
        { status: "TODO", priority: "HIGH", assigneeId: "u1", labelId: "l1" },
      ),
    ).toEqual({
      workspaceId: "w",
      status: "TODO",
      priority: "HIGH",
      assigneeIds: "u1",
      labelIds: "l1",
    });
  });

  it("ignores empty-string filter values", () => {
    expect(buildTaskFilter({ workspaceId: "w" }, { status: "", assigneeId: "" })).toEqual({
      workspaceId: "w",
    });
  });
});
