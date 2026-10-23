"use client";

import * as React from "react";
import { Plus, Trash2, GripVertical, Hash, Text, List, CalendarDays } from "lucide-react";
import { createCustomFieldAction, deleteCustomFieldAction } from "@/modules/custom-field/server/actions";
import type { CustomFieldDTO } from "@/modules/custom-field/server/queries";
import { cn } from "@/lib/utils";

type FieldType = "TEXT" | "NUMBER" | "SELECT" | "DATE";

const TYPE_OPTIONS: { value: FieldType; label: string; icon: React.ReactNode }[] = [
  { value: "TEXT", label: "Text", icon: <Text className="size-3.5" /> },
  { value: "NUMBER", label: "Number", icon: <Hash className="size-3.5" /> },
  { value: "SELECT", label: "Select", icon: <List className="size-3.5" /> },
  { value: "DATE", label: "Date", icon: <CalendarDays className="size-3.5" /> },
];

const TYPE_ICON: Record<string, React.ReactNode> = {
  TEXT: <Text className="size-3.5 text-muted-foreground" />,
  NUMBER: <Hash className="size-3.5 text-muted-foreground" />,
  SELECT: <List className="size-3.5 text-muted-foreground" />,
  DATE: <CalendarDays className="size-3.5 text-muted-foreground" />,
};

interface Props {
  workspaceSlug: string;
  projectId: string;
  fields: CustomFieldDTO[];
}

export function CustomFieldsSettings({ workspaceSlug, projectId, fields: initialFields }: Props) {
  const [fields, setFields] = React.useState(initialFields);
  const [showForm, setShowForm] = React.useState(false);
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<FieldType>("TEXT");
  const [options, setOptions] = React.useState<{ label: string; color: string | null }[]>([]);
  const [optionInput, setOptionInput] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (type === "SELECT" && options.length === 0) {
      setError("Add at least one option for a Select field.");
      return;
    }
    setCreating(true);
    setError(null);
    const result = await createCustomFieldAction(workspaceSlug, projectId, {
      name: name.trim(),
      type,
      options: type === "SELECT" ? options : [],
    });
    setCreating(false);
    if (result.ok && result.data) {
      const createdId = result.data.id;
      setShowForm(false);
      setName("");
      setType("TEXT");
      setOptions([]);
      // Optimistically add to list (will be replaced by revalidation)
      setFields((prev) => [
        ...prev,
        {
          id: createdId,
          projectId,
          name: name.trim(),
          type,
          options: type === "SELECT" ? options.map((o, i) => ({ ...o, id: String(i) })) : [],
          position: prev.length,
        },
      ]);
    } else if (!result.ok) {
      setError(result.error ?? "Failed to create field");
    }
  }

  async function handleDelete(fieldId: string) {
    setDeletingId(fieldId);
    const result = await deleteCustomFieldAction(workspaceSlug, projectId, fieldId);
    if (result.ok) {
      setFields((prev) => prev.filter((f) => f.id !== fieldId));
    }
    setDeletingId(null);
  }

  function addOption() {
    if (!optionInput.trim()) return;
    setOptions((prev) => [...prev, { label: optionInput.trim(), color: null }]);
    setOptionInput("");
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Custom fields</h2>
          <p className="text-xs text-muted-foreground">
            Add custom data fields to tasks in this project.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Plus className="size-4" />
          Add field
        </button>
      </div>

      {/* Existing fields */}
      {fields.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border divide-y divide-border">
          {fields.map((f) => (
            <div key={f.id} className="flex items-center gap-3 px-4 py-3">
              <GripVertical className="size-4 shrink-0 text-muted-foreground/40" />
              {TYPE_ICON[f.type]}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{f.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{f.type.charAt(0) + f.type.slice(1).toLowerCase()}</span>
                {f.type === "SELECT" && f.options.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {f.options.map((o) => (
                      <span
                        key={o.id}
                        className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]"
                      >
                        {o.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(f.id)}
                disabled={deletingId === f.id}
                className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                {deletingId === f.id ? (
                  <span className="size-4 animate-spin rounded-full border border-current border-t-transparent" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
          <List className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No custom fields yet</p>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-xl border border-border bg-card p-4"
        >
          <h3 className="text-sm font-semibold">New custom field</h3>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Field name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="e.g. Story Points"
              className="h-9 w-full rounded border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Field type</label>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={cn(
                    "flex items-center gap-1.5 rounded border-2 px-3 py-1.5 text-xs font-medium transition-colors",
                    type === opt.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {type === "SELECT" && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Options</label>
              {options.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {options.map((o, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 rounded border border-border bg-muted px-2 py-1 text-xs"
                    >
                      {o.label}
                      <button
                        type="button"
                        onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                        className="ml-0.5 text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }}
                  placeholder="Option label…"
                  className="h-8 flex-1 rounded border border-border bg-background px-2 text-xs focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addOption}
                  className="rounded border border-border bg-card px-3 text-xs hover:bg-muted"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="flex-1 rounded bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create field"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setName(""); setError(null); }}
              className="rounded border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
