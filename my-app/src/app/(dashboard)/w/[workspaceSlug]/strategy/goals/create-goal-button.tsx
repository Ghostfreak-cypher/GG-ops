"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateGoalModal } from "./create-goal-modal";
import type { GoalDTO } from "@/modules/goal/server/dto";

export function CreateGoalButton({
  workspaceSlug,
  goals,
  primary,
}: {
  workspaceSlug: string;
  goals: GoalDTO[];
  primary?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button
        size={primary ? "default" : "sm"}
        onClick={() => setOpen(true)}
        className={primary ? "px-6" : undefined}
      >
        <Plus className="size-4" />
        Create goal
      </Button>
      <CreateGoalModal
        open={open}
        onClose={() => setOpen(false)}
        workspaceSlug={workspaceSlug}
        goals={goals}
      />
    </>
  );
}
