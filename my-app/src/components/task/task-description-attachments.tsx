"use client";

import * as React from "react";
import { toast } from "sonner";
import { Paperclip, Link2, FileText, X, Loader2, ExternalLink } from "lucide-react";
import { addAttachmentAction } from "@/modules/attachment/server/actions/add-attachment";
import { removeAttachmentAction } from "@/modules/attachment/server/actions/remove-attachment";
import { listAttachmentsAction } from "@/modules/attachment/server/actions/list-attachments";
import type { AttachmentDTO } from "@/modules/attachment/server/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MAX_BYTES = 25 * 1024 * 1024;

interface TaskDescriptionAttachmentsProps {
  taskId: string;
  editable: boolean;
}

export function TaskDescriptionAttachments({ taskId, editable }: TaskDescriptionAttachmentsProps) {
  const [attachments, setAttachments] = React.useState<AttachmentDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [linkFormOpen, setLinkFormOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState("");
  const [linkTitle, setLinkTitle] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const refetch = React.useCallback(async () => {
    const res = await listAttachmentsAction(taskId);
    if (res.ok && res.data) setAttachments(res.data);
    else if (!res.ok) toast.error(res.error);
  }, [taskId]);

  React.useEffect(() => {
    let active = true;
    listAttachmentsAction(taskId).then((res) => {
      if (!active) return;
      if (res.ok && res.data) setAttachments(res.data);
      else if (!res.ok) toast.error(res.error);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [taskId]);

  async function handleFilesSelected(files: FileList) {
    const toUpload = Array.from(files);
    for (const file of toUpload) {
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} exceeds the 25 MB limit.`);
        return;
      }
    }

    setUploading(true);
    try {
      for (const file of toUpload) {
        const form = new FormData();
        form.append("file", file);

        const res = await fetch("/api/uploads", { method: "POST", body: form });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          toast.error(json.error ?? `Failed to upload ${file.name}`);
          continue;
        }

        const { data } = (await res.json()) as {
          data: { fileUrl: string; storageKey: string; fileName: string; mimeType: string; fileSize: number };
        };

        const added = await addAttachmentAction(taskId, {
          fileName: data.fileName,
          fileUrl: data.fileUrl,
          mimeType: data.mimeType,
          fileSize: data.fileSize,
          storageKey: data.storageKey,
        });
        if (!added.ok) toast.error(added.error);
      }
      await refetch();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function addLink() {
    let url = linkUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      new URL(url);
    } catch {
      toast.error("Please enter a valid URL.");
      return;
    }
    const fileName = linkTitle.trim() || url;
    setUploading(true);
    try {
      const added = await addAttachmentAction(taskId, {
        fileName,
        fileUrl: url,
        mimeType: "text/uri-list",
      });
      if (!added.ok) {
        toast.error(added.error);
        return;
      }
      setLinkUrl("");
      setLinkTitle("");
      setLinkFormOpen(false);
      await refetch();
    } finally {
      setUploading(false);
    }
  }

  async function removeOne(id: string) {
    setRemovingId(id);
    const res = await removeAttachmentAction(id);
    if (res.ok) {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } else {
      toast.error(res.error);
    }
    setRemovingId(null);
  }

  const hasAny = attachments.length > 0;
  if (loading) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Loading attachments…
      </div>
    );
  }

  // Nothing to show and not editable: render nothing.
  if (!hasAny && !editable) return null;

  return (
    <div className="mt-2 space-y-2">
      {hasAny && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <AttachmentChip
              key={a.id}
              a={a}
              editable={editable}
              removing={removingId === a.id}
              onRemove={() => void removeOne(a.id)}
            />
          ))}
        </div>
      )}

      {editable && (
        <>
          {linkFormOpen && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-background p-2">
              <Input
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="h-7 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addLink();
                  }
                }}
                autoFocus
              />
              <Input
                placeholder="Display title (optional)"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                className="h-7 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addLink();
                  }
                }}
              />
              <div className="flex gap-1.5">
                <Button size="sm" className="h-6 text-xs" onClick={() => void addLink()} disabled={!linkUrl.trim() || uploading}>
                  Add link
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => {
                    setLinkFormOpen(false);
                    setLinkUrl("");
                    setLinkTitle("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 pointer-coarse:min-h-10 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              {uploading ? <Loader2 className="size-3 animate-spin" /> : <Paperclip className="size-3" />}
              Attach file
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => setLinkFormOpen((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border border-border px-2 py-1 pointer-coarse:min-h-10 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40",
                linkFormOpen && "bg-muted text-foreground",
              )}
            >
              <Link2 className="size-3" />
              Attach link
            </button>
          </div>

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
        </>
      )}
    </div>
  );
}

function AttachmentChip({
  a,
  editable,
  removing,
  onRemove,
}: {
  a: AttachmentDTO;
  editable: boolean;
  removing: boolean;
  onRemove: () => void;
}) {
  const isImage = (a.mimeType ?? "").startsWith("image/");
  const isLink = a.mimeType === "text/uri-list";

  const label = isLink
    ? (() => {
        try {
          return new URL(a.fileUrl).hostname;
        } catch {
          return a.fileName;
        }
      })()
    : a.fileName;

  return (
    <div className="group/chip relative">
      {isImage ? (
        <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="block shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={a.fileUrl}
            alt={a.fileName}
            className="size-14 rounded-md border border-border object-cover transition-opacity hover:opacity-80"
          />
        </a>
      ) : (
        <a
          href={a.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted"
        >
          {isLink ? (
            <Link2 className="size-3 shrink-0 text-muted-foreground" />
          ) : (
            <FileText className="size-3 shrink-0 text-muted-foreground" />
          )}
          <span className="max-w-[140px] truncate">{label}</span>
          <ExternalLink className="size-2.5 shrink-0 text-muted-foreground" />
        </a>
      )}

      {editable && (
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          aria-label={`Remove ${a.fileName}`}
          className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full border border-border bg-background text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/chip:opacity-100 focus-visible:opacity-100 pointer-coarse:size-6 pointer-coarse:opacity-100 disabled:opacity-40"
        >
          {removing ? <Loader2 className="size-2.5 animate-spin" /> : <X className="size-2.5" />}
        </button>
      )}
    </div>
  );
}
