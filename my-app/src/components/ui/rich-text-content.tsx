"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";

interface RichTextContentProps {
  html: string | null | undefined;
  className?: string;
  /** Clamp to a max number of lines (for previews in task cards) */
  lineClamp?: number;
  emptyText?: string;
}

export function RichTextContent({
  html,
  className,
  lineClamp,
  emptyText,
}: RichTextContentProps) {
  const clean = useMemo(() => {
    if (!html || html === "<p></p>") return "";
    if (typeof window === "undefined") return html; // SSR: skip sanitize
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        "p", "br", "strong", "em", "s", "u", "code", "pre",
        "ul", "ol", "li", "a", "span",
        "h1", "h2", "h3", "h4", "blockquote", "hr",
      ],
      ALLOWED_ATTR: ["href", "target", "rel", "class", "data-id", "data-type"],
    });
  }, [html]);

  if (!clean) {
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
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
