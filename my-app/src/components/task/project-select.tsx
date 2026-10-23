"use client";

import { Select } from "@/components/ui/select";
import type { ProjectSummary } from "@/modules/project/server/queries";

interface ProjectSelectProps {
  value: string | null;
  projects: ProjectSummary[];
  disabled?: boolean;
  onChange: (projectId: string) => void;
}

/** A plain project picker — CreateTaskModal takes projectId as a prop instead, so there was
 *  nothing to reuse here. Kept a thin wrapper around Select rather than a popover, since
 *  unlike assignees/labels a task has exactly one project. */
export function ProjectSelect({ value, projects, disabled, onChange }: ProjectSelectProps) {
  return (
    <Select
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      wrapperClassName="w-auto"
      className="h-8 w-auto min-w-32 pr-7 text-xs"
    >
      <option value="" disabled>
        Choose a project…
      </option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </Select>
  );
}
