"use client";

import { useMemo, useSyncExternalStore } from "react";
import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";
import { RICH_ATTRS, RICH_TAGS, isSafeRichHtml } from "@/lib/rich-html";

interface RichTextContentProps {
  html: string | null | undefined;
  className?: string;
  /** Clamp to a max number of lines (for previews in task cards) */
  lineClamp?: number;
  emptyText?: string;
}

const subscribeNoop = () => () => {};

export function RichTextContent({
  html,
  className,
  lineClamp,
  emptyText,
}: RichTextContentProps) {
  // false on the server and while hydrating, true after. DOMPurify needs a DOM, so until then
  // only markup that is already safe is rendered; anything else appears, sanitized, right after
  // hydration (it used to be server-rendered raw — a stored-XSS hole).
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const clean = useMemo(() => {
    if (!html || html === "<p></p>") return "";
    if (!hydrated) return isSafeRichHtml(html) ? html : null;
    return DOMPurify.sanitize(html, { ALLOWED_TAGS: RICH_TAGS, ALLOWED_ATTR: RICH_ATTRS });
  }, [html, hydrated]);

  if (clean === "") {
    if (!emptyText) return null;
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>{emptyText}</p>
    );
  }

  return (
    <div
      className={cn(
        // Pasted URLs and long tokens must wrap, or they push the page wider than the viewport.
        "prose prose-sm dark:prose-invert max-w-none wrap-anywhere prose-pre:overflow-x-auto",
        "prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
        "prose-headings:mb-1 prose-headings:mt-2 prose-blockquote:my-1 prose-blockquote:border-l-2",
        "prose-a:text-primary prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5",
        "[&_.mention]:rounded [&_.mention]:bg-primary/10 [&_.mention]:px-1 [&_.mention]:font-medium [&_.mention]:text-primary",
        lineClamp && `line-clamp-${lineClamp}`,
        className,
      )}
      dangerouslySetInnerHTML={{ __html: clean ?? "" }}
    />
  );
}
