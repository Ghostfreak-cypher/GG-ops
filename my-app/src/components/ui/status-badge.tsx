import {
  Circle,
  CircleDot,
  CircleCheck,
  Ban,
  Bug,
  Sparkles,
  Wrench,
  ListTodo,
  Diamond,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import { STATUS_UI, PRIORITY_UI, TYPE_UI } from "@/lib/task-ui";
import type {
  TaskStatus,
  TaskPriority,
  TaskType,
} from "@/modules/task/constants";

const STATUS_ICON: Record<TaskStatus, LucideIcon> = {
  TODO: Circle,
  IN_PROGRESS: CircleDot,
  DONE: CircleCheck,
  BLOCKED: Ban,
};

const TYPE_ICON: Record<TaskType, LucideIcon> = {
  TASK: ListTodo,
  BUG: Bug,
  FEATURE: Sparkles,
  CHORE: Wrench,
  MILESTONE: Diamond,
};

export function StatusBadge({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  const ui = STATUS_UI[status];
  const Icon = STATUS_ICON[status];
  return (
    <Badge className={cn(ui.badge, className)}>
      <Icon className="size-3" />
      {ui.label}
    </Badge>
  );
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  const ui = PRIORITY_UI[priority];
  return (
    <Badge className={cn(ui.badge, className)}>
      <span className={cn("size-1.5 rounded-full", ui.dot)} />
      {ui.label}
    </Badge>
  );
}

export function TypeBadge({
  type,
  className,
}: {
  type: TaskType;
  className?: string;
}) {
  const Icon = TYPE_ICON[type];
  return (
    <Badge variant="outline" className={className}>
      <Icon className="size-3" />
      {TYPE_UI[type].label}
    </Badge>
  );
}
