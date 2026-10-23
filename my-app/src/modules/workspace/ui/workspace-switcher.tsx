"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import type { WorkspaceSummary } from "@/modules/workspace/server/dto";

export function WorkspaceSwitcher({
  workspaces,
  current,
}: {
  workspaces: WorkspaceSummary[];
  current: string;
}) {
  const router = useRouter();
  return (
    <Select
      className="h-9 font-medium"
      value={current}
      onChange={(e) => {
        const value = e.target.value;
        router.push(value === "__new__" ? "/onboarding" : `/w/${value}`);
      }}
    >
      {workspaces.map((w) => (
        <option key={w.id} value={w.slug}>
          {w.name}
        </option>
      ))}
      <option value="__new__">+ Create workspace</option>
    </Select>
  );
}
