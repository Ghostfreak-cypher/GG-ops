"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createLabelAction } from "@/modules/label/server/actions/create-label";
import { deleteLabelAction } from "@/modules/label/server/actions/delete-label";
import { LABEL_COLORS } from "@/lib/label-colors";
import { cn } from "@/lib/utils";

export type LabelOption = { id: string; name: string; color: string | null };

interface LabelPopoverProps {
  value: string[];
  labels: LabelOption[];
  disabled?: boolean;
  onSelect: (ids: string[]) => void;
  children: React.ReactNode;
  /** Enables inline create/delete (admins only). Both must be set. */
  workspaceSlug?: string;
  canManage?: boolean;
}

export function LabelPopover({
  value,
  labels,
  disabled,
  onSelect,
  children,
  workspaceSlug,
  canManage,
}: LabelPopoverProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [newColor, setNewColor] = React.useState<string>(LABEL_COLORS[0]);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  const manage = !disabled && !!canManage && !!workspaceSlug;
  const trimmed = query.trim();
  const filtered = labels.filter((l) =>
    l.name.toLowerCase().includes(trimmed.toLowerCase()),
  );
  const exactExists = labels.some(
    (l) => l.name.toLowerCase() === trimmed.toLowerCase(),
  );

  function toggle(id: string) {
    onSelect(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  function handleCreate() {
    if (!trimmed || !workspaceSlug) return;
    start(async () => {
      const res = await createLabelAction(workspaceSlug, { name: trimmed, color: newColor });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to create workstream");
        return;
      }
      if (res.data) onSelect([...value, res.data.id]);
      setQuery("");
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!workspaceSlug) return;
    start(async () => {
      const res = await deleteLabelAction(workspaceSlug, id);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to delete workstream");
        return;
      }
      if (value.includes(id)) onSelect(value.filter((v) => v !== id));
      setConfirmId(null);
      router.refresh();
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={
        disabled
          ? undefined
          : (o) => {
              setOpen(o);
              if (!o) {
                setQuery("");
                setConfirmId(null);
              }
            }
      }
    >
      <PopoverTrigger asChild disabled={disabled}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && manage && trimmed && !exactExists) handleCreate();
            }}
            placeholder={manage ? "Search or create…" : "Search…"}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="max-h-56 overflow-y-auto p-1">
          {filtered.length === 0 && !(manage && trimmed) && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              No workstreams found.
            </p>
          )}

          {filtered.map((l) => {
            const selected = value.includes(l.id);
            return (
              <div
                key={l.id}
                className="group/item flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <button
                  type="button"
                  onClick={() => toggle(l.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full ring-1 ring-border"
                    style={{ backgroundColor: l.color ?? "var(--muted-foreground)" }}
                  />
                  <span className={cn("truncate", selected && "font-medium")}>{l.name}</span>
                  {selected && <Check className="ml-auto size-3.5 shrink-0 text-primary" />}
                </button>

                {manage &&
                  (confirmId === l.id ? (
                    <span className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleDelete(l.id)}
                        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(l.id)}
                      aria-label={`Delete ${l.name}`}
                      className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-red-600 group-hover/item:opacity-100 focus-visible:opacity-100 pointer-coarse:p-2 pointer-coarse:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ))}
              </div>
            );
          })}

          {manage && trimmed && !exactExists && (
            <button
              type="button"
              disabled={pending}
              onClick={handleCreate}
              className="mt-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
            >
              <span
                className="size-2.5 shrink-0 rounded-full ring-1 ring-border"
                style={{ backgroundColor: newColor }}
              />
              <span className="truncate">Create “{trimmed}”</span>
              <Plus className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
            </button>
          )}
        </div>

        {manage && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border p-2">
            {LABEL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                aria-label={`Use color ${c}`}
                className={cn(
                  "size-4 pointer-coarse:size-7 rounded-full ring-1 ring-border transition-transform hover:scale-110",
                  newColor === c && "ring-2 ring-ring ring-offset-1 ring-offset-background",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
