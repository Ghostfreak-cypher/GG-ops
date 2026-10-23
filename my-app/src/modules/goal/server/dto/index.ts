import type { GoalStatus } from "@/modules/goal/constants";

export type GoalLinkedProjectDTO = {
  id: string;
  name: string;
};

export type GoalLinkedTaskDTO = {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
};

export type GoalDTO = {
  id: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  progress: number;
  parentGoalId: string | null;
  period: string | null;
  teamLabel: string | null;
  dueDate: string | null;
  linkedProjects: GoalLinkedProjectDTO[];
  linkedTasks: GoalLinkedTaskDTO[];
  children: GoalDTO[];
};
