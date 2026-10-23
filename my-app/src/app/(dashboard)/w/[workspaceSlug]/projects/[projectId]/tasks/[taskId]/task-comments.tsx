"use client";

import { createContext, useContext, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Trash2, MoreHorizontal, CornerDownRight } from "lucide-react";
import { createCommentAction } from "@/modules/comment/server/actions/create-comment";
import { deleteCommentAction } from "@/modules/comment/server/actions/delete-comment";
import { reactToCommentAction } from "@/modules/comment/server/actions/react-to-comment";
import { ALLOWED_EMOJIS } from "@/modules/comment/constants";
import type { CommentDTO, ReactionSummary } from "@/modules/comment/server/queries";
import { Avatar } from "@/components/ui/avatar";
import { RichTextEditor, type EditorMember } from "@/components/ui/rich-text-editor";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { usePusherRefresh } from "@/lib/use-pusher-refresh";
import { cn } from "@/lib/utils";

/** Workspace members for @mentions, provided once at the root to avoid drilling. */
const MembersContext = createContext<EditorMember[]>([]);
const COMMENT_EVENTS = ["comment.created"];

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

// ── Reaction pills ────────────────────────────────────────────────────────────

function ReactionPills({
  commentId,
  reactions,
  onToggle,
}: {
  commentId: string;
  reactions: ReactionSummary[];
  onToggle: (commentId: string, emoji: string, current: ReactionSummary[]) => void;
}) {
  const existingEmojis = new Set(reactions.map((r) => r.emoji));
  const quickPick = ALLOWED_EMOJIS.filter((e) => !existingEmojis.has(e));

  return (
    <div className="flex flex-wrap items-center gap-1 pt-1">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onToggle(commentId, r.emoji, reactions)}
          className={cn(
            "flex items-center gap-1 border-2 px-1.5 py-0.5 font-mono text-xs transition-colors",
            r.myReaction
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card text-foreground hover:border-foreground",
          )}
        >
          <span>{r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}
      {quickPick.slice(0, 3).map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onToggle(commentId, e, reactions)}
          className="border-2 border-dashed border-border px-1.5 py-0.5 font-mono text-xs text-muted-foreground opacity-0 transition-opacity group-hover/comment:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100 hover:border-foreground hover:text-foreground"
          title={`React with ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

// ── Reply composer ────────────────────────────────────────────────────────────

function ReplyComposer({
  taskId,
  parentCommentId,
  onDone,
}: {
  taskId: string;
  parentCommentId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const members = useContext(MembersContext);
  const [body, setBody] = useState("");
  const [resetSignal, setResetSignal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    if (!body.trim()) return;
    start(async () => {
      const res = await createCommentAction(taskId, { body, parentCommentId });
      if (!res.ok) { setError(res.error); return; }
      setBody("");
      setResetSignal((s) => s + 1);
      setError(null);
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="mt-2 space-y-2">
      <RichTextEditor
        value={body}
        onChange={setBody}
        members={members}
        resetSignal={resetSignal}
        placeholder="Write a reply… use @ to mention"
        disabled={pending}
        minHeight="4rem"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || !body.trim()}
          onClick={submit}
          className="border-2 border-foreground bg-foreground px-3 py-1 font-sans text-xs font-semibold text-background transition-colors disabled:opacity-40 hover:bg-background hover:text-foreground"
        >
          {pending ? "Posting…" : "Post reply"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="border-2 border-border px-3 py-1 font-sans text-xs font-semibold text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Single comment card ───────────────────────────────────────────────────────

function CommentCard({
  comment,
  taskId,
  workspaceSlug,
  currentUserId,
  canModerate,
  reactions,
  onToggleReaction,
  isReply,
}: {
  comment: CommentDTO;
  taskId: string;
  workspaceSlug: string;
  currentUserId: string;
  canModerate: boolean;
  reactions: ReactionSummary[];
  onToggleReaction: (commentId: string, emoji: string, current: ReactionSummary[]) => void;
  isReply?: boolean;
}) {
  const router = useRouter();
  const [replyOpen, setReplyOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();

  const canDelete = currentUserId === comment.authorId || canModerate;

  function handleDelete() {
    startDelete(async () => {
      await deleteCommentAction(workspaceSlug, comment.id);
      setMenuOpen(false);
      setConfirmDelete(false);
      router.refresh();
    });
  }

  return (
    <div className={cn("group/comment flex gap-3 text-sm", isReply && "ml-10")}>
      {isReply && (
        <CornerDownRight className="mt-3 size-3 shrink-0 text-muted-foreground/40" />
      )}
      <Avatar name={comment.authorName} image={comment.authorImage ?? undefined} size="md" className="mt-0.5 shrink-0" />

      <div className="min-w-0 flex-1">
        <div className="relative rounded-none border-2 border-border bg-card px-4 py-3">
          {/* header */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{comment.authorName}</span>
              <span>·</span>
              <span>{fmt(comment.createdAt)}</span>
            </div>

            {canDelete && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setMenuOpen((v) => !v); setConfirmDelete(false); }}
                  className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/comment:opacity-100 focus-visible:opacity-100 pointer-coarse:p-2.5 pointer-coarse:opacity-100 hover:text-foreground"
                >
                  <MoreHorizontal className="size-4" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-6 z-20 min-w-[140px] border-2 border-border bg-background shadow-lg">
                    {!confirmDelete ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3.5" />
                        Delete comment
                      </button>
                    ) : (
                      <div className="px-3 py-2 space-y-2">
                        <p className="text-xs text-muted-foreground">Delete this comment?</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={deleting}
                            onClick={handleDelete}
                            className="flex-1 border-2 border-destructive bg-destructive px-2 py-1 text-[10px] font-semibold text-destructive-foreground disabled:opacity-50 hover:bg-destructive/90"
                          >
                            {deleting ? "Deleting…" : "Delete"}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setConfirmDelete(false); setMenuOpen(false); }}
                            className="flex-1 border-2 border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:border-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* body */}
          <RichTextContent html={comment.body} />

          {/* attachments */}
          {comment.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {comment.attachments.map((a) => (
                <a
                  key={a.fileUrl}
                  href={a.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                >
                  {a.fileName}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* reactions + reply */}
        <div className="flex items-center justify-between px-1 pt-1">
          <ReactionPills
            commentId={comment.id}
            reactions={reactions}
            onToggle={onToggleReaction}
          />
          {!isReply && (
            <button
              type="button"
              onClick={() => setReplyOpen((v) => !v)}
              className="ml-auto text-[11px] font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
            >
              Reply
            </button>
          )}
        </div>

        {replyOpen && (
          <ReplyComposer
            taskId={taskId}
            parentCommentId={comment.id}
            onDone={() => setReplyOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

// ── Thread (root + replies) ───────────────────────────────────────────────────

const REPLIES_INITIAL = 2;

function CommentThread({
  comment,
  taskId,
  workspaceSlug,
  currentUserId,
  canModerate,
  reactionOverrides,
  onToggleReaction,
}: {
  comment: CommentDTO;
  taskId: string;
  workspaceSlug: string;
  currentUserId: string;
  canModerate: boolean;
  reactionOverrides: Map<string, ReactionSummary[]>;
  onToggleReaction: (commentId: string, emoji: string, current: ReactionSummary[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const replies = comment.replies;
  const hiddenCount = replies.length - REPLIES_INITIAL;
  const visibleReplies = expanded || hiddenCount <= 0 ? replies : replies.slice(0, REPLIES_INITIAL);

  return (
    <li className="space-y-2">
      <CommentCard
        comment={comment}
        taskId={taskId}
        workspaceSlug={workspaceSlug}
        currentUserId={currentUserId}
        canModerate={canModerate}
        reactions={reactionOverrides.get(comment.id) ?? comment.reactions}
        onToggleReaction={onToggleReaction}
      />

      {replies.length > 0 && (
        <div className="space-y-2">
          {visibleReplies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              taskId={taskId}
              workspaceSlug={workspaceSlug}
              currentUserId={currentUserId}
              canModerate={canModerate}
              reactions={reactionOverrides.get(reply.id) ?? reply.reactions}
              onToggleReaction={onToggleReaction}
              isReply
            />
          ))}

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="ml-10 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
            >
              {expanded ? "Hide replies ↑" : `Show ${hiddenCount} more repl${hiddenCount === 1 ? "y" : "ies"} ↓`}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────

export function TaskComments({
  taskId,
  comments,
  editable,
  currentUserId,
  canModerate,
  workspaceSlug,
  members,
}: {
  taskId: string;
  comments: CommentDTO[];
  editable: boolean;
  currentUserId: string;
  canModerate: boolean;
  workspaceSlug: string;
  members: EditorMember[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [resetSignal, setResetSignal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Live updates: re-fetch the page when anyone posts a comment on this task.
  usePusherRefresh(`task-${taskId}`, COMMENT_EVENTS);

  // Optimistic reaction state — keyed by commentId
  const [reactionOverrides, setReactionOverrides] = useState<Map<string, ReactionSummary[]>>(
    new Map(),
  );

  const handleToggleReaction = useCallback(
    (commentId: string, emoji: string, current: ReactionSummary[]) => {
      const existing = current.find((r) => r.emoji === emoji);
      const myReaction = existing?.myReaction ?? false;

      // Optimistic update
      let next: ReactionSummary[];
      if (myReaction) {
        next = current
          .map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, myReaction: false } : r))
          .filter((r) => r.count > 0);
      } else if (existing) {
        next = current.map((r) =>
          r.emoji === emoji ? { ...r, count: r.count + 1, myReaction: true } : r,
        );
      } else {
        next = [...current, { emoji, count: 1, myReaction: true }];
      }

      setReactionOverrides((prev) => new Map(prev).set(commentId, next));
      // Fire-and-forget — no refresh needed, state is local
      reactToCommentAction(commentId, emoji, myReaction ? "remove" : "add");
    },
    [],
  );

  const totalCount = comments.length + comments.reduce((s, c) => s + c.replies.length, 0);

  return (
    <MembersContext.Provider value={members}>
    <section className="space-y-4">
      <h2 className="font-sans text-sm font-semibold uppercase tracking-widest">
        Comments{totalCount > 0 ? ` (${totalCount})` : ""}
      </h2>

      <ul className="space-y-4">
        {comments.length === 0 ? (
          <li className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquare className="size-4" />
            No comments yet — be the first.
          </li>
        ) : (
          comments.map((c) => (
            <CommentThread
              key={c.id}
              comment={c}
              taskId={taskId}
              workspaceSlug={workspaceSlug}
              currentUserId={currentUserId}
              canModerate={canModerate}
              reactionOverrides={reactionOverrides}
              onToggleReaction={handleToggleReaction}
            />
          ))
        )}
      </ul>

      {editable && (
        <div className="space-y-2 border-t-2 border-border pt-4">
          <RichTextEditor
            value={body}
            onChange={setBody}
            members={members}
            resetSignal={resetSignal}
            placeholder="Write a comment… use @ to mention a teammate"
            disabled={pending}
            minHeight="5rem"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="button"
            disabled={pending || !body.trim()}
            onClick={() => {
              if (!body.trim()) return;
              start(async () => {
                const res = await createCommentAction(taskId, { body });
                if (!res.ok) { setError(res.error); return; }
                setBody("");
                setResetSignal((s) => s + 1);
                setError(null);
                router.refresh();
              });
            }}
            className="border-2 border-foreground bg-foreground px-4 py-1.5 font-sans text-xs font-semibold text-background transition-colors disabled:opacity-40 hover:bg-background hover:text-foreground"
          >
            {pending ? "Posting…" : "Comment"}
          </button>
        </div>
      )}
    </section>
    </MembersContext.Provider>
  );
}
