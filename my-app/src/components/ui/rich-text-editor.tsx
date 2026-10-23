"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import {
  Bold,
  Italic,
  Strikethrough,
  Underline as UnderlineIcon,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link2,
  Link2Off,
  Undo2,
  Redo2,
  Check,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { ALL_MENTION_ID, rankMentionCandidates } from "@/lib/mentions";
import { cn } from "@/lib/utils";

export type EditorMember = {
  id: string;
  name: string;
  /**
   * Optional so the many `{ id, name }` pass-through call sites keep compiling.
   * Pages that map from `MemberDTO` supply it, which is what makes `@` searchable
   * by email address.
   */
  email?: string | null;
  image?: string | null;
  /** Secondary dropdown line — used by the synthetic `@all` entry. */
  hint?: string;
};

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minHeight?: string;
  /** When provided, enables @mentions of these members. */
  members?: EditorMember[];
  /** Bump this number to force-clear the editor (e.g. after submitting a comment). */
  resetSignal?: number;
  autoFocus?: boolean;
  /** Extra controls rendered at the right side of the toolbar row (e.g. attach buttons). */
  toolbarExtras?: React.ReactNode;
}

/**
 * The label written into the mention chip. Full names disambiguate two people who
 * share a first name; the server resolves by `data-id` regardless, so this is
 * presentation only.
 */
const mentionLabelOf = (m: EditorMember) => (m.id === ALL_MENTION_ID ? "all" : m.name);

type MentionState = {
  open: boolean;
  items: EditorMember[];
  index: number;
  top: number;
  left: number;
  command: ((item: { id: string; label: string }) => void) | null;
};

const EMPTY_MENTION: MentionState = {
  open: false,
  items: [],
  index: 0,
  top: 0,
  left: 0,
  command: null,
};

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder = "Add a description…",
  disabled = false,
  className,
  minHeight = "8rem",
  members,
  resetSignal,
  autoFocus = false,
  toolbarExtras,
}: RichTextEditorProps) {
  // Mention dropdown state (driven by the suggestion plugin), plus a ref so the
  // plugin's keydown handler always sees the latest values.
  const [mention, setMention] = React.useState<MentionState>(EMPTY_MENTION);
  // The suggestion plugin's keydown handler is created once and can't receive
  // React state directly, so we mirror the mention state into a ref (updated in
  // an effect, never during render) for it to read the latest items/index.
  const mentionRef = React.useRef(mention);
  React.useEffect(() => {
    mentionRef.current = mention;
  }, [mention]);

  // The list is no longer capped at 6, so the highlighted row can sit outside the
  // scroll viewport during arrow-key navigation.
  const activeMentionRef = React.useRef<HTMLButtonElement | null>(null);
  React.useEffect(() => {
    if (mention.open) activeMentionRef.current?.scrollIntoView({ block: "nearest" });
  }, [mention.index, mention.open]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, HTMLAttributes: { class: "text-primary underline" } },
      }),
      Placeholder.configure({ placeholder }),
      ...(members
        ? [
            Mention.configure({
              HTMLAttributes: { class: "mention" },
              renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
              renderHTML: ({ node }) => [
                "span",
                { class: "mention", "data-id": node.attrs.id, "data-type": "mention" },
                `@${node.attrs.label ?? node.attrs.id}`,
              ],
              suggestion: {
                char: "@",
                // The plugin default is [" "], which means an "@" typed after any
                // non-space character (hi,@ali) never opens the menu. null allows
                // every prefix.
                allowedPrefixes: null,
                items: ({ query }) => {
                  const q = query.trim().toLowerCase();
                  const matches = rankMentionCandidates(members ?? [], q);
                  // Synthetic entry: picking it inserts "@all", which the server
                  // expands to every member except the author.
                  if (ALL_MENTION_ID.startsWith(q)) {
                    matches.unshift({
                      id: ALL_MENTION_ID,
                      name: "all",
                      hint: "Notify everyone in this workspace",
                    });
                  }
                  return matches;
                },
                render: () => ({
                  onStart: (props) => {
                    const r = props.clientRect?.();
                    setMention({
                      open: true,
                      items: props.items as EditorMember[],
                      index: 0,
                      top: r ? r.bottom : 0,
                      left: r ? r.left : 0,
                      command: props.command as MentionState["command"],
                    });
                  },
                  onUpdate: (props) => {
                    const r = props.clientRect?.();
                    setMention((s) => ({
                      ...s,
                      open: true,
                      items: props.items as EditorMember[],
                      index: Math.min(s.index, Math.max(0, props.items.length - 1)),
                      top: r ? r.bottom : s.top,
                      left: r ? r.left : s.left,
                      command: props.command as MentionState["command"],
                    }));
                  },
                  onKeyDown: (props) => {
                    const s = mentionRef.current;
                    if (!s.open || s.items.length === 0) return false;
                    const { key } = props.event;
                    if (key === "ArrowDown") {
                      setMention((st) => ({ ...st, index: (st.index + 1) % st.items.length }));
                      return true;
                    }
                    if (key === "ArrowUp") {
                      setMention((st) => ({
                        ...st,
                        index: (st.index - 1 + st.items.length) % st.items.length,
                      }));
                      return true;
                    }
                    if (key === "Enter" || key === "Tab") {
                      const item = s.items[s.index];
                      if (item && s.command) {
                        s.command({ id: item.id, label: mentionLabelOf(item) });
                        return true;
                      }
                    }
                    if (key === "Escape") {
                      setMention((st) => ({ ...st, open: false }));
                      return true;
                    }
                    return false;
                  },
                  onExit: () => setMention((st) => ({ ...st, open: false })),
                }),
              },
            }),
          ]
        : []),
    ],
    content: value,
    editable: !disabled,
    autofocus: autoFocus ? "end" : false,
    onUpdate({ editor }) {
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
    onBlur() {
      onBlur?.();
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none wrap-anywhere prose-pre:overflow-x-auto outline-none focus:outline-none",
          "prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
          "prose-headings:mb-1 prose-headings:mt-2 prose-blockquote:my-1 prose-blockquote:border-l-2",
          "[&_.mention]:rounded [&_.mention]:bg-primary/10 [&_.mention]:px-1 [&_.mention]:font-medium [&_.mention]:text-primary",
        ),
      },
    },
  });

  React.useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  // Sync external value changes into the editor when the user isn't typing
  // (e.g. a programmatic reset, or a live update from another client).
  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const normalized = current === "<p></p>" ? "" : current;
    const incoming = value || "";
    if (normalized === incoming || editor.isFocused) return;
    editor.commands.setContent(incoming, { emitUpdate: false });
  }, [value, editor]);

  // Force-clear after submit even if the editor still has focus.
  const firstReset = React.useRef(true);
  React.useEffect(() => {
    if (resetSignal === undefined || !editor) return;
    if (firstReset.current) {
      firstReset.current = false;
      return;
    }
    editor.commands.clearContent(false);
  }, [resetSignal, editor]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-transparent bg-muted/40 transition-colors",
        "focus-within:border-border focus-within:bg-background focus-within:ring-1 focus-within:ring-ring",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
    >
      {!disabled && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border/50 px-2 py-1.5">
          <ToolbarBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
            <Bold className="size-3.5" />
          </ToolbarBtn>
          <ToolbarBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
            <Italic className="size-3.5" />
          </ToolbarBtn>
          <ToolbarBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
            <Strikethrough className="size-3.5" />
          </ToolbarBtn>
          <ToolbarBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
            <UnderlineIcon className="size-3.5" />
          </ToolbarBtn>

          <Divider />

          <ToolbarBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading">
            <Heading2 className="size-3.5" />
          </ToolbarBtn>
          <ToolbarBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Subheading">
            <Heading3 className="size-3.5" />
          </ToolbarBtn>

          <Divider />

          <ToolbarBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
            <List className="size-3.5" />
          </ToolbarBtn>
          <ToolbarBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
            <ListOrdered className="size-3.5" />
          </ToolbarBtn>
          <ToolbarBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote">
            <Quote className="size-3.5" />
          </ToolbarBtn>
          <ToolbarBtn active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline code">
            <Code className="size-3.5" />
          </ToolbarBtn>

          <Divider />

          <LinkPopover editor={editor} />
          <EmojiPicker
            onEmojiSelect={(emoji) => editor.chain().focus().insertContent(emoji).run()}
            triggerClassName="size-6 pointer-coarse:size-9 rounded p-0"
          />

          <Divider />

          <ToolbarBtn active={false} disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} title="Undo">
            <Undo2 className="size-3.5" />
          </ToolbarBtn>
          <ToolbarBtn active={false} disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} title="Redo">
            <Redo2 className="size-3.5" />
          </ToolbarBtn>

          {toolbarExtras && <div className="ml-auto flex items-center gap-0.5">{toolbarExtras}</div>}
        </div>
      )}

      {/* Selection bubble menu */}
      <BubbleMenu
        editor={editor}
        shouldShow={({ editor: ed, from, to }) => ed.isEditable && from !== to && !ed.isActive("link")}
        className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-md"
      >
        <ToolbarBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
          <Bold className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
          <Italic className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
          <Strikethrough className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline code">
          <Code className="size-3.5" />
        </ToolbarBtn>
      </BubbleMenu>

      <EditorContent editor={editor} className="px-3 py-2.5 text-sm" style={{ minHeight }} />

      {/* @mention dropdown — portaled to body so CSS transforms on ancestors
          (e.g. the sliding task panel) don't offset the fixed positioning. */}
      {mention.open &&
        mention.items.length > 0 &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-50 max-h-72 w-72 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md"
            // Clamped to the viewport in both axes: the coords come from the caret, so
            // on a narrow screen the list would otherwise sit off the right edge, and a
            // caret low in the page would push it below the fold. Flips above when it
            // won't fit underneath.
            style={mentionPosition(mention.top, mention.left)}
          >
            {mention.items.map((m, i) => {
              // Second line disambiguates two people who share a name.
              const subtitle = m.hint ?? m.email ?? null;
              return (
                <button
                  key={m.id}
                  type="button"
                  ref={i === mention.index ? activeMentionRef : null}
                  // mousedown (not click) so the editor keeps its selection
                  onMouseDown={(e) => {
                    e.preventDefault();
                    mention.command?.({ id: m.id, label: mentionLabelOf(m) });
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    i === mention.index ? "bg-muted" : "hover:bg-muted",
                  )}
                >
                  <Avatar name={m.name} image={m.image ?? undefined} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{m.name}</span>
                    {subtitle && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {subtitle}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Keeps the caret-anchored mention list inside the viewport on both axes. */
const MENTION_W = 288; // w-72
const MENTION_H = 288; // max-h-72

function mentionPosition(top: number, left: number): React.CSSProperties {
  if (typeof window === "undefined") return { top: top + 4, left };
  const gutter = 8;
  const clampedLeft = Math.max(
    gutter,
    Math.min(left, window.innerWidth - MENTION_W - gutter),
  );
  // visualViewport shrinks when the iOS keyboard opens; innerHeight does not.
  const visibleH = window.visualViewport?.height ?? window.innerHeight;
  const flipUp = top + 4 + MENTION_H > visibleH;
  return flipUp
    ? { bottom: window.innerHeight - top + 4, left: clampedLeft }
    : { top: top + 4, left: clampedLeft };
}

function Divider() {
  return <div className="mx-1 h-4 w-px bg-border" />;
}

function ToolbarBtn({
  active,
  onClick,
  title,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded p-1 pointer-coarse:p-2.5 transition-colors disabled:opacity-30",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function LinkPopover({ editor }: { editor: Editor }) {
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState("");

  function start() {
    setUrl((editor.getAttributes("link").href as string) ?? "");
    setOpen(true);
  }

  function apply() {
    let href = url.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setOpen(false);
      return;
    }
    if (!/^https?:\/\//i.test(href) && !href.startsWith("mailto:")) href = `https://${href}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setOpen(false);
  }

  const isActive = editor.isActive("link");

  return (
    <Popover open={open} onOpenChange={(o) => (o ? start() : setOpen(false))}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={isActive ? "Edit link" : "Add link"}
          className={cn(
            "rounded p-1 pointer-coarse:p-2.5 transition-colors",
            isActive ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {isActive ? <Link2Off className="size-3.5" /> : <Link2 className="size-3.5" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start" sideOffset={6}>
        <div className="flex items-center gap-1.5">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
            }}
          />
          <Button size="sm" className="h-8 shrink-0 px-2" onClick={apply}>
            <Check className="size-3.5" />
          </Button>
        </div>
        {isActive && (
          <button
            type="button"
            onClick={() => {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              setOpen(false);
            }}
            className="mt-1.5 text-xs text-muted-foreground transition-colors hover:text-destructive"
          >
            Remove link
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
