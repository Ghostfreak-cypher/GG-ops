"use client";

import * as React from "react";
import { Bookmark, BookmarkCheck, Trash2, Plus, X } from "lucide-react";
import { createSavedViewAction, deleteSavedViewAction } from "@/modules/saved-view/server/actions";
import type { SavedViewDTO } from "@/modules/saved-view/server/queries";
import type { ViewFilters, SortKey, GroupKey } from "@/modules/task/use-project-view";
import { cn } from "@/lib/utils";

interface SavedViewsBarProps {
  workspaceSlug: string;
  projectId: string;
  views: SavedViewDTO[];
  currentFilters: ViewFilters;
  currentSortBy: SortKey;
  currentSortDir: "asc" | "desc";
  currentGroupBy: GroupKey;
  currentShowCompleted: boolean;
  onApplyView: (view: SavedViewDTO) => void;
}

export function SavedViewsBar({
  workspaceSlug,
  projectId,
  views,
  currentFilters,
  currentSortBy,
  currentSortDir,
  currentGroupBy,
  currentShowCompleted,
  onApplyView,
}: SavedViewsBarProps) {
  const [saving, setSaving] = React.useState(false);
  const [nameInput, setNameInput] = React.useState("");
  const [showNameInput, setShowNameInput] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [activeViewId, setActiveViewId] = React.useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setSaving(true);
    try {
      const result = await createSavedViewAction(workspaceSlug, projectId, {
        name: nameInput.trim(),
        filters: currentFilters,
        sortBy: currentSortBy,
        sortDir: currentSortDir,
        groupBy: currentGroupBy,
        showCompleted: currentShowCompleted,
      });
      if (result.ok) {
        setNameInput("");
        setShowNameInput(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(viewId: string) {
    setDeletingId(viewId);
    try {
      await deleteSavedViewAction(workspaceSlug, projectId, viewId);
      if (activeViewId === viewId) setActiveViewId(null);
    } finally {
      setDeletingId(null);
    }
  }

  function handleApply(view: SavedViewDTO) {
    setActiveViewId(view.id);
    onApplyView(view);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-2">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Bookmark className="size-3" />
        Views:
      </span>

      {views.map((v) => (
        <div key={v.id} className="group relative flex items-center">
          <button
            type="button"
            onClick={() => handleApply(v)}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
              activeViewId === v.id
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {activeViewId === v.id && <BookmarkCheck className="size-3" />}
            {v.name}
          </button>
          <button
            type="button"
            onClick={() => handleDelete(v.id)}
            disabled={deletingId === v.id}
            className="absolute -right-1.5 -top-1.5 hidden size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover:flex pointer-coarse:flex pointer-coarse:size-6"
            title="Delete view"
          >
            {deletingId === v.id ? (
              <span className="size-2 animate-spin rounded-full border border-current border-t-transparent" />
            ) : (
              <Trash2 className="size-2.5" />
            )}
          </button>
        </div>
      ))}

      {showNameInput ? (
        <form onSubmit={handleSave} className="flex items-center gap-1">
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="View name…"
            maxLength={80}
            className="h-6 w-36 rounded border border-border bg-background px-2 text-xs focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving || !nameInput.trim()}
            className="rounded bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? "…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => { setShowNameInput(false); setNameInput(""); }}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowNameInput(true)}
          className="inline-flex items-center gap-1 rounded border border-dashed border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          <Plus className="size-3" />
          Save view
        </button>
      )}
    </div>
  );
}
