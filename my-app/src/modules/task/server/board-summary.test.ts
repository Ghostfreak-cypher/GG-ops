import { describe, it, expect } from "vitest";
import { summarizeBoard } from "@/modules/task/server/board-summary";
import type { BoardData, TaskDTO } from "@/modules/task/server/dto";

function task(status: TaskDTO["status"], blockedByCount = 0): TaskDTO {
  return { status, blockedByCount } as TaskDTO;
}

const board = {
  projectId: "507f1f77bcf86cd799439011",
  projectName: "Billing",
  projectStatusColor: "AT_RISK",
  projectStatusNote: "Vendor late",
  projectStatusUpdatedAt: null,
  memberCount: 4,
  sections: [
    { id: "s1", name: "Doing", position: 0, tasks: [task("TODO"), task("IN_PROGRESS", 2)] },
    { id: "s2", name: "Done", position: 1, tasks: [task("DONE")] },
  ],
  unsectioned: [task("TODO", 1)],
} as BoardData;

describe("summarizeBoard", () => {
  it("counts tasks across sections and unsectioned, with zeroes for empty statuses", () => {
    const summary = summarizeBoard(board);

    expect(summary.taskCount).toBe(4);
    expect(summary.countsByStatus).toEqual({ TODO: 2, IN_PROGRESS: 1, DONE: 1, BLOCKED: 0 });
    expect(summary.blockedCount).toBe(2);
    expect(summary).toMatchObject({ projectName: "Billing", projectStatusColor: "AT_RISK", memberCount: 4 });
    expect(summary).not.toHaveProperty("sections");
  });
});
