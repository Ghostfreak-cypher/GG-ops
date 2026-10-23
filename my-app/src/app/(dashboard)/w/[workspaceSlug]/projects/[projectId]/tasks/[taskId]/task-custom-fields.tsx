"use client";

import * as React from "react";
import { Hash, Text, List, CalendarDays, ChevronDown } from "lucide-react";
import { setFieldValueAction } from "@/modules/custom-field/server/actions";
import type { CustomFieldDTO, FieldValueDTO } from "@/modules/custom-field/server/queries";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<string, React.ReactNode> = {
  TEXT: <Text className="size-3.5" />,
  NUMBER: <Hash className="size-3.5" />,
  SELECT: <List className="size-3.5" />,
  DATE: <CalendarDays className="size-3.5" />,
};

interface TaskCustomFieldsProps {
  workspaceSlug: string;
  taskId: string;
  fields: CustomFieldDTO[];
  values: FieldValueDTO[];
  editable: boolean;
}

export function TaskCustomFields({
  workspaceSlug,
  taskId,
  fields,
  values,
  editable,
}: TaskCustomFieldsProps) {
  if (fields.length === 0) return null;

  const valueMap = new Map(values.map((v) => [v.fieldId, v.value]));

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Custom fields
      </p>
      <div className="space-y-2">
        {fields.map((field) => (
          <FieldRow
            key={field.id}
            workspaceSlug={workspaceSlug}
            taskId={taskId}
            field={field}
            value={valueMap.get(field.id) ?? null}
            editable={editable}
          />
        ))}
      </div>
    </div>
  );
}

function FieldRow({
  workspaceSlug,
  taskId,
  field,
  value,
  editable,
}: {
  workspaceSlug: string;
  taskId: string;
  field: CustomFieldDTO;
  value: string | number | null;
  editable: boolean;
}) {
  const [draft, setDraft] = React.useState<string | number | null>(value);
  const [saving, setSaving] = React.useState(false);

  async function save(val: string | number | null) {
    if (val === value) return;
    setSaving(true);
    await setFieldValueAction(workspaceSlug, taskId, { fieldId: field.id, value: val });
    setSaving(false);
  }

  if (field.type === "SELECT") {
    return (
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:w-36">
          {TYPE_ICON[field.type]}
          <span className="truncate">{field.name}</span>
        </span>
        <div className="relative flex-1">
          <select
            disabled={!editable || saving}
            value={(draft as string) ?? ""}
            onChange={(e) => {
              const v = e.target.value || null;
              setDraft(v);
              void save(v);
            }}
            className="h-7 w-full appearance-none rounded border border-border bg-background pl-2 pr-7 text-xs text-foreground focus:border-primary focus:outline-none disabled:opacity-60"
          >
            <option value="">—</option>
            {field.options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          {saving && <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">…</span>}
        </div>
      </div>
    );
  }

  if (field.type === "NUMBER") {
    return (
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:w-36">
          {TYPE_ICON[field.type]}
          <span className="truncate">{field.name}</span>
        </span>
        <input
          type="number"
          disabled={!editable || saving}
          value={(draft as number) ?? ""}
          onChange={(e) => setDraft(e.target.value ? Number(e.target.value) : null)}
          onBlur={() => save(draft)}
          className="h-7 flex-1 rounded border border-border bg-background px-2 text-xs text-foreground focus:border-primary focus:outline-none disabled:opacity-60"
          placeholder="—"
        />
      </div>
    );
  }

  if (field.type === "DATE") {
    return (
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:w-36">
          {TYPE_ICON[field.type]}
          <span className="truncate">{field.name}</span>
        </span>
        <input
          type="date"
          disabled={!editable || saving}
          value={(draft as string) ?? ""}
          onChange={(e) => {
            const v = e.target.value || null;
            setDraft(v);
            void save(v);
          }}
          className="h-7 flex-1 rounded border border-border bg-background px-2 text-xs text-foreground focus:border-primary focus:outline-none disabled:opacity-60"
        />
      </div>
    );
  }

  // TEXT
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:w-36">
        {TYPE_ICON[field.type]}
        <span className="truncate">{field.name}</span>
      </span>
      <input
        type="text"
        disabled={!editable || saving}
        value={(draft as string) ?? ""}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => save(draft)}
        className={cn(
          "h-7 flex-1 rounded border border-border bg-background px-2 text-xs text-foreground focus:border-primary focus:outline-none disabled:opacity-60",
          saving && "opacity-60",
        )}
        placeholder="—"
      />
    </div>
  );
}
