"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { addTeamMemberAction } from "@/modules/people/server/actions/manage-team";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type Candidate = {
  userId: string;
  name: string;
  image: string | null;
  jobTitle: string | null;
};

export function AddMemberPicker({
  slug,
  teamId,
  candidates,
}: {
  slug: string;
  teamId: string;
  candidates: Candidate[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (candidates.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Everyone in this workspace is already on the team.
      </p>
    );
  }

  function handleAdd(userId: string) {
    startTransition(async () => {
      const res = await addTeamMemberAction(slug, teamId, userId);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={isPending}>
          <Plus className="size-4" />
          Add member
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Search members…" />
          <CommandList>
            <CommandEmpty>No matching members.</CommandEmpty>
            {candidates.map((c) => (
              <CommandItem
                key={c.userId}
                value={`${c.name} ${c.jobTitle ?? ""}`}
                disabled={isPending}
                onSelect={() => handleAdd(c.userId)}
                className="cursor-pointer gap-3"
              >
                <Avatar name={c.name} image={c.image} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  {c.jobTitle && (
                    <p className="truncate text-xs text-muted-foreground">{c.jobTitle}</p>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
