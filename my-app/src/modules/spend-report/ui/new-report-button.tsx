"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Local calendar date as YYYY-MM-DD (not UTC — reports are keyed to the local day). */
function todayISO(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** Opens the entry form for a chosen date (defaults to today) to create/edit that day's report. */
export function NewReportButton({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useRouter();
  const [date, setDate] = useState(todayISO);

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        aria-label="Report date"
        value={date}
        max={todayISO()}
        onChange={(e) => setDate(e.target.value)}
        className="h-8 w-auto py-0 text-xs"
      />
      <Button
        type="button"
        size="sm"
        disabled={!date}
        onClick={() => date && router.push(`/w/${workspaceSlug}/spend/${date}`)}
      >
        <Plus className="size-4" />
        New Report
      </Button>
    </div>
  );
}
