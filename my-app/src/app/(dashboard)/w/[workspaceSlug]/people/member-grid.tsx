"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { MemberProfileDTO } from "@/modules/people/server/dto";

const ROLE_ORDER = ["MAINTAINER", "ADMIN", "MEMBER", "GUEST"] as const;

export function MemberGrid({
  members,
  slug,
  currentUserId,
}: {
  members: MemberProfileDTO[];
  slug: string;
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  const filtered = members.filter((m) => {
    const q = query.toLowerCase();
    const matchQ =
      !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || (m.jobTitle ?? "").toLowerCase().includes(q);
    const matchRole = roleFilter === "ALL" || m.role === roleFilter;
    return matchQ && matchRole;
  });

  return (
    <div className="space-y-4">
      {/* Search + filter bar */}
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
        <div className="flex flex-wrap gap-1">
          {(["ALL", ...ROLE_ORDER] as const).map((r) => (
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
      </div>

      {/* Stats */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} of {members.length} member{members.length !== 1 ? "s" : ""}
      </p>

      {/* Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((m) => (
          <MemberCard key={m.userId} member={m} slug={slug} isSelf={m.userId === currentUserId} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">No members match your search.</p>
      )}
    </div>
  );
}

function MemberCard({
  member,
  slug,
  isSelf,
}: {
  member: MemberProfileDTO;
  slug: string;
  isSelf: boolean;
}) {
  const isOoo =
    member.outOfOfficeEnabled &&
    member.outOfOfficeUntil &&
    new Date(member.outOfOfficeUntil) >= new Date();

  return (
    <Link
      href={`/w/${slug}/people/${member.userId}`}
      className="group flex flex-col gap-3 border border-border p-4 transition-colors hover:border-foreground hover:bg-muted/30"
    >
      <div className="flex items-start justify-between gap-2">
        <Avatar name={member.name} image={member.image} size="lg" />
        <Badge
          variant={member.role === "MAINTAINER" ? "default" : "secondary"}
          className="shrink-0 font-mono text-[10px] uppercase"
        >
          {member.role}
        </Badge>
      </div>

      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold text-sm">{member.name}</span>
          {isSelf && (
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">(you)</span>
          )}
        </div>
        {member.jobTitle && (
          <p className="truncate text-xs text-muted-foreground">{member.jobTitle}</p>
        )}
        {member.department && (
          <p className="truncate text-xs text-muted-foreground">{member.department}</p>
        )}
        {isOoo && (
          <span className="inline-block border border-amber-600 px-1.5 py-0.5 font-mono text-[10px] uppercase text-amber-600">
            Out of office
          </span>
        )}
      </div>
    </Link>
  );
}
