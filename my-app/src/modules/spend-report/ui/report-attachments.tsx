"use client";

import * as React from "react";
import { toast } from "sonner";
import { Paperclip, FileText, X, Loader2, ExternalLink } from "lucide-react";
import { addReportAttachmentAction } from "@/modules/spend-report/server/actions/add-report-attachment";
import { removeReportAttachmentAction } from "@/modules/spend-report/server/actions/remove-report-attachment";
import { listReportAttachmentsAction } from "@/modules/spend-report/server/actions/list-report-attachments";
import type { AttachmentDTO } from "@/modules/attachment/server/queries";

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPT = "image/*,application/pdf,text/csv,application/vnd.ms-excel,.csv";

/** Screenshots (e.g. AWS console) and CSV exports attached to a single spend report. */
export function ReportAttachments({ reportId }: { reportId: string }) {
  const [attachments, setAttachments] = React.useState<AttachmentDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const refetch = React.useCallback(async () => {
    const res = await listReportAttachmentsAction(reportId);
    if (res.ok && res.data) setAttachments(res.data);
    else if (!res.ok) toast.error(res.error);
  }, [reportId]);

  React.useEffect(() => {
    let active = true;
    listReportAttachmentsAction(reportId).then((res) => {
      if (!active) return;
      if (res.ok && res.data) setAttachments(res.data);
      else if (!res.ok) toast.error(res.error);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [reportId]);

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

        const added = await addReportAttachmentAction(reportId, {
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

  async function removeOne(id: string) {
    setRemovingId(id);
    const res = await removeReportAttachmentAction(id);
    if (res.ok) {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } else {
      toast.error(res.error);
    }
    setRemovingId(null);
  }

  const hasAny = attachments.length > 0;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Screenshots & files
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> Loading attachments…
        </div>
      ) : (
        hasAny && (
          <div className="flex flex-wrap gap-1.5">
            {attachments.map((a) => (
              <AttachmentChip
                key={a.id}
                a={a}
                removing={removingId === a.id}
                onRemove={() => void removeOne(a.id)}
              />
            ))}
          </div>
        )
      )}

      <button
        type="button"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
      >
        {uploading ? <Loader2 className="size-3 animate-spin" /> : <Paperclip className="size-3" />}
        Attach screenshot or CSV
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void handleFilesSelected(e.target.files);
        }}
      />
    </div>
  );
}

function AttachmentChip({
  a,
  removing,
  onRemove,
}: {
  a: AttachmentDTO;
  removing: boolean;
  onRemove: () => void;
}) {
  const isImage = (a.mimeType ?? "").startsWith("image/");

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
          <FileText className="size-3 shrink-0 text-muted-foreground" />
          <span className="max-w-[140px] truncate">{a.fileName}</span>
          <ExternalLink className="size-2.5 shrink-0 text-muted-foreground" />
        </a>
      )}

      <button
        type="button"
        onClick={onRemove}
        disabled={removing}
        aria-label={`Remove ${a.fileName}`}
        className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full border border-border bg-background text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/chip:opacity-100 focus-visible:opacity-100 pointer-coarse:size-6 pointer-coarse:opacity-100 disabled:opacity-40"
      >
        {removing ? <Loader2 className="size-2.5 animate-spin" /> : <X className="size-2.5" />}
      </button>
    </div>
  );
}
