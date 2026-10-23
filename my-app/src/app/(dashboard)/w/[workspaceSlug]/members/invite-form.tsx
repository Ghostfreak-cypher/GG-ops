"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { inviteMemberAction } from "@/modules/workspace/server/actions/invite-member";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

type Message = { kind: "ok" | "warn" | "err"; text: string };

export function InviteForm({ slug }: { slug: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<Message | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMsg(null);
    const res = await inviteMemberAction(slug, { email, role });
    setPending(false);
    if (!res.ok) {
      setMsg({ kind: "err", text: res.error });
      return;
    }
    setEmail("");
    const url = res.data ? `${window.location.origin}${res.data.inviteUrl}` : "";
    if (res.warning) {
      setMsg({ kind: "warn", text: `${res.warning} ${url}`.trim() });
      return;
    }
    setMsg({ kind: "ok", text: `Invite created. Share this link: ${url}` });
  }

  return (
    <Card className="p-4">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <UserPlus className="size-4 text-muted-foreground" />
          Invite a teammate
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            placeholder="teammate@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Select
            wrapperClassName="w-auto"
            className="h-10"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            aria-label="Invite role"
          >
            <option value="ADMIN">Admin</option>
            <option value="MEMBER">Member</option>
            <option value="GUEST">Guest</option>
          </Select>
          <Button type="submit" disabled={pending}>
            {pending ? "..." : "Invite"}
          </Button>
        </div>
        {msg && (
          <p
            className={
              msg.kind === "ok"
                ? "break-all rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : msg.kind === "warn"
                  ? "break-all rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                  : "text-sm text-destructive"
            }
          >
            {msg.text}
          </p>
        )}
      </form>
    </Card>
  );
}
