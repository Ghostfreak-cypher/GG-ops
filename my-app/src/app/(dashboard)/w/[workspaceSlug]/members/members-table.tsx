"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2, Download, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { DataCard, DataCardField, DataCardList } from "@/components/ui/data-card-list";
import { cn } from "@/lib/utils";
import { removeMemberAction } from "@/modules/workspace/server/actions/remove-member";
import { bulkUpdateMembersAction } from "@/modules/workspace/server/actions/bulk-update-members";
import { MemberRoleSelect } from "./member-role-select";
import type { MemberDTO } from "@/modules/workspace/server/dto";

type WorkspaceRole = MemberDTO["role"];

const ROLES: WorkspaceRole[] = ["MAINTAINER", "ADMIN", "MEMBER", "GUEST"];
const ROLE_COLORS: Record<WorkspaceRole, string> = {
  MAINTAINER: "font-bold",
  ADMIN: "",
  MEMBER: "",
  GUEST: "opacity-70",
};

export function MembersTable({
  members,
  slug,
  currentUserId,
  canManage,
}: {
  members: MemberDTO[];
  slug: string;
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<WorkspaceRole | "ALL">("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [bulkRole, setBulkRole] = useState<string>("MEMBER");
  const [bulkError, setBulkError] = useState<string | null>(null);

  const filtered = members.filter((m) => {
    const q = query.toLowerCase();
    const matchQ =
      !q ||
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.jobTitle ?? "").toLowerCase().includes(q);
    const matchRole = roleFilter === "ALL" || m.role === roleFilter;
    return matchQ && matchRole;
  });

  const allIds = filtered.map((m) => m.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected((s) => {
        const next = new Set(s);
        allIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((s) => new Set([...s, ...allIds]));
    }
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleRemoveSingle(id: string) {
    if (confirmRemove === id) {
      setConfirmRemove(null);
      startTransition(async () => {
        await removeMemberAction(slug, { memberId: id });
        setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
        router.refresh();
      });
    } else {
      setConfirmRemove(id);
    }
  }

  function handleBulkRemove() {
    const ids = [...selected];
    startTransition(async () => {
      setBulkError(null);
      const res = await bulkUpdateMembersAction(slug, { memberIds: ids, action: "remove" });
      if (!res.ok) { setBulkError(res.error); return; }
      setSelected(new Set());
      router.refresh();
    });
  }

  function handleBulkRole() {
    const ids = [...selected];
    startTransition(async () => {
      setBulkError(null);
      const res = await bulkUpdateMembersAction(slug, {
        memberIds: ids,
        action: "role",
        role: bulkRole as "ADMIN" | "MEMBER" | "GUEST",
      });
      if (!res.ok) { setBulkError(res.error); return; }
      setSelected(new Set());
      router.refresh();
    });
  }

  // Shared by the md+ table row and the mobile card so the two can't drift apart.
  function removeActions(memberId: string, name: string, canRemove: boolean) {
    if (!canRemove) return null;
    if (confirmRemove === memberId) {
      return (
        <>
          <button
            onClick={() => handleRemoveSingle(memberId)}
            disabled={isPending}
            className="font-mono text-[10px] uppercase text-destructive hover:underline disabled:opacity-50"
          >
            Confirm?
          </button>
          <button
            onClick={() => setConfirmRemove(null)}
            className="font-mono text-[10px] uppercase text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </>
      );
    }
    return (
      <button
        onClick={() => handleRemoveSingle(memberId)}
        disabled={isPending}
        className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50 pointer-coarse:p-2.5"
        aria-label={`Remove ${name}`}
        title="Remove member"
      >
        <Trash2 className="size-4" />
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Role filter */}
        <div className="flex flex-wrap gap-1">
          {(["ALL", ...ROLES] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={cn(
                "border px-3 py-1.5 font-sans text-xs font-semibold uppercase tracking-widest transition-colors",
                roleFilter === r
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
              )}
            >
              {r === "ALL" ? "All" : r}
            </button>
          ))}
        </div>

        {/* Export */}
        <a
          href={`/api/workspaces/${slug}/members/export`}
          download
          className="flex items-center gap-1.5 border border-border px-3 py-1.5 font-sans text-xs font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          <Download className="size-3.5" />
          Export
        </a>
      </div>

      {/* Bulk action bar */}
      {someSelected && canManage && (
        <div className="flex flex-wrap items-center gap-3 border border-foreground bg-foreground/5 px-4 py-2.5">
          <span className="font-mono text-xs text-muted-foreground">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Change role:</span>
            <select
              value={bulkRole}
              onChange={(e) => setBulkRole(e.target.value)}
              className="border border-border bg-background px-2 py-1 font-sans text-xs"
            >
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Member</option>
              <option value="GUEST">Guest</option>
            </select>
            <button
              onClick={handleBulkRole}
              disabled={isPending}
              className="border border-border px-3 py-1 font-sans text-xs font-semibold uppercase tracking-widest transition-colors hover:border-foreground disabled:opacity-50"
            >
              Apply
            </button>
          </div>
          <button
            onClick={handleBulkRemove}
            disabled={isPending}
            className="flex items-center gap-1.5 border border-destructive px-3 py-1 font-sans text-xs font-semibold uppercase tracking-widest text-destructive transition-colors hover:bg-destructive hover:text-white disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
            Remove {selected.size}
          </button>
          {bulkError && <span className="text-xs text-destructive">{bulkError}</span>}
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Stats */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} of {members.length} member{members.length !== 1 ? "s" : ""}
      </p>

      {/* Table — md and up. Below that the same rows render as cards (see DataCardList). */}
      <div className="hidden border border-border md:block">
        {/* Header. Both conditional cells fall back to <span /> so the six grid tracks
            stay aligned with the rows when canManage is false. */}
        <div className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto] items-center gap-4 border-b border-border bg-muted/30 px-4 py-2.5 font-mono text-[10px] uppercase text-muted-foreground">
          {canManage ? (
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="size-4"
              title="Select all"
            />
          ) : (
            <span />
          )}
          <span>Member</span>
          <span>Email</span>
          <span>Role</span>
          <span>Joined</span>
          <span />
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No members match your search.
          </div>
        ) : (
          filtered.map((m) => {
            const isSelf = m.userId === currentUserId;
            const canRemove = canManage && m.role !== "MAINTAINER" && !isSelf;

            return (
              <div
                key={m.id}
                className={cn(
                  "grid grid-cols-[auto_1fr_1fr_auto_auto_auto] items-center gap-4 border-b border-border px-4 py-3 last:border-b-0 transition-colors",
                  selected.has(m.id) && "bg-muted/20",
                )}
              >
                {/* Checkbox */}
                {canManage ? (
                  <input
                    type="checkbox"
                    checked={selected.has(m.id)}
                    onChange={() => toggle(m.id)}
                    disabled={m.role === "MAINTAINER"}
                    className="size-4 disabled:opacity-40"
                  />
                ) : (
                  <span />
                )}

                {/* Name + avatar */}
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={m.name} image={m.image} size="md" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("truncate text-sm font-medium", ROLE_COLORS[m.role])}>
                        {m.name}
                      </span>
                      {isSelf && (
                        <span className="font-mono text-[10px] text-muted-foreground">(you)</span>
                      )}
                    </div>
                    {m.jobTitle && (
                      <p className="truncate text-xs text-muted-foreground">{m.jobTitle}</p>
                    )}
                  </div>
                </div>

                {/* Email */}
                <span className="truncate text-xs text-muted-foreground">{m.email}</span>

                {/* Role */}
                <div className="space-y-1">
                  {canManage && m.role !== "MAINTAINER" ? (
                    <MemberRoleSelect slug={slug} memberId={m.id} role={m.role} />
                  ) : (
                    <Badge variant={m.role === "MAINTAINER" ? "default" : "secondary"} className="font-mono text-[10px] uppercase">
                      {m.role}
                    </Badge>
                  )}
                </div>

                {/* Joined */}
                <span className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                  {m.joinedAt
                    ? new Date(m.joinedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </span>

                {/* Remove */}
                {canManage ? (
                  <div className="flex items-center gap-2">
                    {removeActions(m.id, m.name, canRemove)}
                  </div>
                ) : (
                  <span />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Mobile: six columns can't fit a phone, so each row becomes a card. */}
      {filtered.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground md:hidden">
          No members match your search.
        </p>
      ) : (
        <div className="space-y-2 md:hidden">
          {canManage && (
            <label className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="size-5" />
              Select all
            </label>
          )}
          <DataCardList>
          {filtered.map((m) => {
            const isSelf = m.userId === currentUserId;
            const canRemove = canManage && m.role !== "MAINTAINER" && !isSelf;
            return (
              <DataCard
                key={m.id}
                selected={selected.has(m.id)}
                leading={
                  canManage ? (
                    <input
                      type="checkbox"
                      checked={selected.has(m.id)}
                      onChange={() => toggle(m.id)}
                      disabled={m.role === "MAINTAINER"}
                      className="size-4 disabled:opacity-40"
                      aria-label={`Select ${m.name}`}
                    />
                  ) : (
                    <Avatar name={m.name} image={m.image} size="sm" />
                  )
                }
                title={
                  <span className={ROLE_COLORS[m.role]}>
                    {m.name}
                    {isSelf ? " (you)" : ""}
                  </span>
                }
                subtitle={m.jobTitle ? `${m.jobTitle} · ${m.email}` : m.email}
                actions={removeActions(m.id, m.name, canRemove)}
              >
                {/* full: the role select needs the whole card width */}
                <DataCardField label="Role" full>
                  <div className="space-y-1">
                    {canManage && m.role !== "MAINTAINER" ? (
                      <MemberRoleSelect slug={slug} memberId={m.id} role={m.role} />
                    ) : (
                      <Badge
                        variant={m.role === "MAINTAINER" ? "default" : "secondary"}
                        className="font-mono text-[10px] uppercase"
                      >
                        {m.role}
                      </Badge>
                    )}
                  </div>
                </DataCardField>
                <DataCardField label="Joined">
                  {m.joinedAt
                    ? new Date(m.joinedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </DataCardField>
              </DataCard>
            );
          })}
          </DataCardList>
        </div>
      )}
    </div>
  );
}
