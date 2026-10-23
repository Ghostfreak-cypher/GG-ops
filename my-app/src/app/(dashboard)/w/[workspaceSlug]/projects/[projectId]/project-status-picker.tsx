"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, CheckCircle2, AlertTriangle, XCircle, PauseCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateProjectStatusAction } from "@/modules/project/server/actions/update-status";
import type { ProjectStatusColor } from "@/modules/task/server/dto";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: {
  value: ProjectStatusColor;
  label: string;
  dot: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "ON_TRACK",
    label: "On track",
    dot: "bg-emerald-500",
    icon: <CheckCircle2 className="size-3.5 text-emerald-600" />,
  },
  {
    value: "AT_RISK",
    label: "At risk",
    dot: "bg-amber-500",
    icon: <AlertTriangle className="size-3.5 text-amber-600" />,
  },
  {
    value: "OFF_TRACK",
    label: "Off track",
    dot: "bg-red-500",
    icon: <XCircle className="size-3.5 text-red-600" />,
  },
  {
    value: "ON_HOLD",
    label: "On hold",
    dot: "bg-gray-400",
    icon: <PauseCircle className="size-3.5 text-gray-500" />,
  },
];

export function ProjectStatusPicker({
  slug,
  projectId,
  statusColor,
  canEdit,
}: {
  slug: string;
  projectId: string;
  statusColor: ProjectStatusColor | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  const current = STATUS_OPTIONS.find((o) => o.value === statusColor);

  function select(value: ProjectStatusColor | null) {
    setOpen(false);
    start(async () => {
      await updateProjectStatusAction(slug, projectId, { statusColor: value, statusNote: null });
      router.refresh();
    });
  }

  if (!canEdit) {
    if (!current) return null;
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={cn("size-2 rounded-full", current.dot)} />
        {current.label}
      </span>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={pending}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
            current
              ? "bg-muted text-foreground hover:bg-muted/80"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
        >
          {current ? (
            <>
              <span className={cn("size-2 rounded-full", current.dot)} />
              {current.label}
            </>
          ) : (
            "Set status"
          )}
          <ChevronDown className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-36">
        {STATUS_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => select(opt.value)}
            className="flex items-center gap-2"
          >
            {opt.icon}
            {opt.label}
          </DropdownMenuItem>
        ))}
        {statusColor && (
          <DropdownMenuItem
            onClick={() => select(null)}
            className="text-muted-foreground"
          >
            Clear status
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
