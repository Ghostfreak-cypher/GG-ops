"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  MessageSquare,
  Paperclip,
  Link2,
  Send,
  FileText,
  X,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { createCommentAction } from "@/modules/comment/server/actions/create-comment";
import { fetchTaskCommentsAction } from "@/modules/comment/server/actions/fetch-task-comments";
import type { CommentDTO } from "@/modules/comment/server/queries";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextContent } from "@/components/ui/rich-text-content";

// This component is only rendered inside the task panel, which is closed (unmounted content)
// until a task is opened — see task-panel.tsx for the matching dynamic import and the
// rationale (a loading skeleton already covers the fetch this chunk loads alongside).
const RichTextEditor = dynamic(
  () => import("@/components/ui/rich-text-editor").then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => <div className="min-h-20 rounded-xl border border-border" />,
  },
);
import { usePusherEvent } from "@/lib/use-pusher-event";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

/** `email` feeds @mention search; optional so pass-through callers still compile. */
type Member = { id: string; name: string; email?: string | null; image?: string | null };

type PendingAttachment = {
  localId: string;
  fileName: string;
  fileUrl: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  previewDataUrl?: string;
  isLink?: boolean;
};

// ─── Time formatting ─────────────────────────────────────────────────────────

function fmt(iso: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days < 7 ? `${days}d ago` : iso.slice(0, 10);
}

// ─── Attachment chip (rendered on a submitted comment) ────────────────────────

function AttachmentChip({ a }: { a: { fileUrl: string; fileName: string; mimeType: string } }) {
  const isImage = a.mimeType.startsWith("image/");
  const isLink = a.mimeType === "text/uri-list";

  if (isImage) {
    return (
      <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={a.fileUrl}
          alt={a.fileName}
          className="size-14 rounded-md border border-border object-cover transition-opacity hover:opacity-80"
        />
      </a>
    );
  }

  const Icon = isLink ? Link2 : FileText;
  const label = isLink
    ? (() => { try { return new URL(a.fileUrl).hostname; } catch { return a.fileName; } })()
    : a.fileName;

  return (
    <a
      href={a.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted"
    >
      <Icon className="size-3 shrink-0 text-muted-foreground" />
      <span className="max-w-[120px] truncate">{label}</span>
      <ExternalLink className="size-2.5 shrink-0 text-muted-foreground" />
    </a>
  );
}

// ─── Pending attachment preview strip ────────────────────────────────────────

function PendingPreview({
  attachments,
  onRemove,
}: {
  attachments: PendingAttachment[];
  onRemove: (localId: string) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 pb-2">
      {attachments.map((a) => {
        if (a.previewDataUrl && a.mimeType.startsWith("image/")) {
          return (
            <div key={a.localId} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.previewDataUrl}
                alt={a.fileName}
                className="size-10 rounded-md border border-border object-cover"
              />
              <button
                type="button"
                onClick={() => onRemove(a.localId)}
                className="absolute -right-1.5 -top-1.5 flex size-4 pointer-coarse:size-6 items-center justify-center rounded-full bg-background border border-border text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${a.fileName}`}
              >
                <X className="size-2.5" />
              </button>
            </div>
          );
        }

        const Icon = a.isLink ? Link2 : FileText;
        const label = a.isLink
          ? (() => { try { return new URL(a.fileUrl).hostname; } catch { return a.fileName; } })()
          : a.fileName;

        return (
          <div
            key={a.localId}
            className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 pl-2 pr-1 py-1 text-xs"
          >
            <Icon className="size-3 shrink-0 text-muted-foreground" />
            <span className="max-w-[100px] truncate">{label}</span>
            <button
              type="button"
              onClick={() => onRemove(a.localId)}
              className="ml-0.5 text-muted-foreground hover:text-foreground pointer-coarse:p-2"
              aria-label={`Remove ${a.fileName}`}
            >
              <X className="size-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RichCommentBox({
  taskId,
  editable,
  members,
}: {
  taskId: string;
  editable: boolean;
  members: Member[];
}) {
  const [comments, setComments] = React.useState<CommentDTO[]>([]);
  const [loadingComments, setLoadingComments] = React.useState(true);

  // Composer state. `body` holds rich-text HTML from the editor.
  const [body, setBody] = React.useState("");
  const [resetSignal, setResetSignal] = React.useState(0);
  const [pendingAttachments, setPendingAttachments] = React.useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Link form state
  const [linkFormOpen, setLinkFormOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState("");
  const [linkTitle, setLinkTitle] = React.useState("");

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const refreshComments = React.useCallback(() => {
    fetchTaskCommentsAction(taskId).then((res) => {
      if (res.ok && res.data) setComments(res.data);
    });
  }, [taskId]);

  // Load comments on mount
  React.useEffect(() => {
    fetchTaskCommentsAction(taskId)
      .then((res) => {
        if (res.ok && res.data) setComments(res.data);
      })
      .finally(() => setLoadingComments(false));
  }, [taskId]);

  // Live updates: re-fetch when anyone posts a comment on this task.
  usePusherEvent(`task-${taskId}`, "comment.created", refreshComments);

  // ── File upload ─────────────────────────────────────────────────────────────

  async function handleFilesSelected(files: FileList) {
    const MAX = 25 * 1024 * 1024;
    const toUpload = Array.from(files);

    for (const file of toUpload) {
      if (file.size > MAX) {
        toast.error(`${file.name} exceeds the 25 MB limit.`);
        return;
      }
    }

    setUploading(true);
    try {
      for (const file of toUpload) {
        // Show preview immediately for images
        let previewDataUrl: string | undefined;
        if (file.type.startsWith("image/")) {
          previewDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target?.result as string);
            reader.readAsDataURL(file);
          });
        }

        const form = new FormData();
        form.append("file", file);

        const res = await fetch("/api/uploads", { method: "POST", body: form });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          toast.error(json.error ?? `Failed to upload ${file.name}`);
          continue;
        }

        const data = (await res.json()) as {
          data: { fileUrl: string; storageKey: string; fileName: string; mimeType: string; fileSize: number };
        };

        setPendingAttachments((prev) => [
          ...prev,
          {
            localId: `${Date.now()}-${Math.random()}`,
            fileName: data.data.fileName,
            fileUrl: data.data.fileUrl,
            storageKey: data.data.storageKey,
            mimeType: data.data.mimeType,
            fileSize: data.data.fileSize,
            previewDataUrl,
          },
        ]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── Link attachment ──────────────────────────────────────────────────────────

  function addLink() {
    let url = linkUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      new URL(url);
    } catch {
      toast.error("Please enter a valid URL.");
      return;
    }
    const name = linkTitle.trim() || url;
    setPendingAttachments((prev) => [
      ...prev,
      {
        localId: `link-${Date.now()}`,
        fileName: name,
        fileUrl: url,
        storageKey: "",
        mimeType: "text/uri-list",
        fileSize: 0,
        isLink: true,
      },
    ]);
    setLinkUrl("");
    setLinkTitle("");
    setLinkFormOpen(false);
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!body.trim() && pendingAttachments.length === 0) return;
    if (uploading) return;

    setSubmitting(true);
    try {
      const res = await createCommentAction(taskId, {
        body: body.trim() || "(attachment)",
        attachments: pendingAttachments.map((a) => ({
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          mimeType: a.mimeType,
          fileSize: a.fileSize,
          storageKey: a.storageKey || undefined,
        })),
      });

      if (!res.ok) {
        toast.error(res.error ?? "Failed to post comment");
        return;
      }

      setBody("");
      setPendingAttachments([]);
      setResetSignal((s) => s + 1);

      // Optimistically refresh comments
      const updated = await fetchTaskCommentsAction(taskId);
      if (updated.ok && updated.data) setComments(updated.data);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = (body.trim().length > 0 || pendingAttachments.length > 0) && !uploading && !submitting;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Activity
        </span>
        {comments.length > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
            {comments.length}
          </span>
        )}
      </div>

      {/* Comment list */}
      {loadingComments ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading…
        </div>
      ) : comments.length === 0 ? (
        <p className="py-1 text-xs text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2.5 text-sm">
              <Avatar name={c.authorName} size="sm" className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline gap-1.5 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{c.authorName}</span>
                  <span>·</span>
                  <span>{fmt(c.createdAt)}</span>
                </div>
                <div className="wrap-break-word rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm leading-relaxed">
                  <RichTextContent html={c.body} />
                </div>
                {c.attachments.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {c.attachments.map((a, i) => (
                      <AttachmentChip key={i} a={a} />
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Composer — only if editable */}
      {editable && (
        <div className="space-y-2">
          {/* Pending attachments preview */}
          <PendingPreview
            attachments={pendingAttachments}
            onRemove={(id) => setPendingAttachments((prev) => prev.filter((a) => a.localId !== id))}
          />

          {/* Link form (inline) */}
          {linkFormOpen && (
            <div className="mb-2 flex flex-col gap-1.5 rounded-lg border border-border bg-background p-2">
              <Input
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="h-7 text-xs"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
                autoFocus
              />
              <Input
                placeholder="Display title (optional)"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                className="h-7 text-xs"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
              />
              <div className="flex gap-1.5">
                <Button size="sm" className="h-6 text-xs" onClick={addLink} disabled={!linkUrl.trim()}>
                  Add link
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => { setLinkFormOpen(false); setLinkUrl(""); setLinkTitle(""); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Rich-text editor: formatting + @mentions + emoji; attach buttons live in its toolbar */}
          <RichTextEditor
            value={body}
            onChange={setBody}
            members={members}
            resetSignal={resetSignal}
            disabled={submitting}
            minHeight="72px"
            placeholder="Write a comment… use @ to mention a teammate"
            toolbarExtras={
              <>
                <button
                  type="button"
                  disabled={uploading || submitting}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex size-6 pointer-coarse:size-10 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                  title="Attach file (image or PDF)"
                  aria-label="Attach file"
                >
                  {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setLinkFormOpen((v) => !v)}
                  className={cn(
                    "flex size-6 pointer-coarse:size-10 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40",
                    linkFormOpen && "bg-muted text-foreground",
                  )}
                  title="Attach link"
                  aria-label="Attach link"
                >
                  <Link2 className="size-3.5" />
                </button>
              </>
            }
          />

          {/* Submit */}
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
            >
              {submitting ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
              {submitting ? "Posting…" : "Comment"}
            </Button>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void handleFilesSelected(e.target.files);
        }}
      />
    </div>
  );
}
