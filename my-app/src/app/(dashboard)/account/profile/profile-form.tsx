"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateProfileAction, type ProfileFormData } from "@/modules/people/server/actions/update-profile";

type Props = {
  initial: {
    name: string;
    jobTitle: string | null;
    department: string | null;
    bio: string | null;
    pronounceUrl: string | null;
    outOfOfficeEnabled: boolean;
    outOfOfficeFrom: string | null;
    outOfOfficeUntil: string | null;
    outOfOfficeMessage: string | null;
  };
};

function toDateInput(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

export function ProfileForm({ initial }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState<ProfileFormData>({
    name: initial.name,
    jobTitle: initial.jobTitle ?? null,
    department: initial.department ?? null,
    bio: initial.bio ?? null,
    pronounceUrl: initial.pronounceUrl ?? null,
    outOfOfficeEnabled: initial.outOfOfficeEnabled,
    outOfOfficeFrom: initial.outOfOfficeFrom,
    outOfOfficeUntil: initial.outOfOfficeUntil,
    outOfOfficeMessage: initial.outOfOfficeMessage ?? null,
  });

  const set = (key: keyof ProfileFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value || null }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await updateProfileAction(form);
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic info */}
      <div className="space-y-4">
        <h2 className="font-semibold uppercase tracking-widest text-xs text-muted-foreground">
          Basic info
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={form.name} onChange={set("name")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jobTitle">Job title</Label>
            <Input
              id="jobTitle"
              value={form.jobTitle ?? ""}
              onChange={set("jobTitle")}
              placeholder="e.g. Lead Engineer"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              value={form.department ?? ""}
              onChange={set("department")}
              placeholder="e.g. Engineering"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pronounceUrl">
              Pronounce name URL
              <span className="ml-1 text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="pronounceUrl"
              type="url"
              value={form.pronounceUrl ?? ""}
              onChange={set("pronounceUrl")}
              placeholder="https://…"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bio">About me</Label>
          <textarea
            id="bio"
            value={form.bio ?? ""}
            onChange={set("bio")}
            rows={3}
            maxLength={500}
            placeholder="A short bio visible to your teammates…"
            className="w-full border border-border bg-transparent px-3 py-2 font-sans text-base md:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">
            {(form.bio ?? "").length}/500
          </p>
        </div>
      </div>

      {/* Out of office */}
      <div className="space-y-4 border-t border-border pt-6">
        <h2 className="font-semibold uppercase tracking-widest text-xs text-muted-foreground">
          Out of office
        </h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.outOfOfficeEnabled}
            onChange={(e) => setForm((p) => ({ ...p, outOfOfficeEnabled: e.target.checked }))}
            className="size-4 border-border"
          />
          <span className="text-sm">I&apos;m currently out of office</span>
        </label>
        {form.outOfOfficeEnabled && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="oooFrom">From</Label>
              <Input
                id="oooFrom"
                type="date"
                value={toDateInput(form.outOfOfficeFrom)}
                onChange={(e) =>
                  setForm((p) => ({ ...p, outOfOfficeFrom: e.target.value || null }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oooUntil">Until</Label>
              <Input
                id="oooUntil"
                type="date"
                value={toDateInput(form.outOfOfficeUntil)}
                onChange={(e) =>
                  setForm((p) => ({ ...p, outOfOfficeUntil: e.target.value || null }))
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="oooMessage">Auto-reply message</Label>
              <textarea
                id="oooMessage"
                value={form.outOfOfficeMessage ?? ""}
                onChange={set("outOfOfficeMessage")}
                rows={2}
                maxLength={300}
                placeholder="I'm currently out of the office and will respond when I return."
                className="w-full border border-border bg-transparent px-3 py-2 font-sans text-base md:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 border-t border-border pt-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        {success && (
          <p className="text-sm text-green-600 dark:text-green-400">Profile updated.</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </form>
  );
}
