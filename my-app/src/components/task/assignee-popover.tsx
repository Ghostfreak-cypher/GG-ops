"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type AssigneeMember = { id: string; name: string; image?: string | null };

interface AssigneePopoverProps {
  value: string[];
  members: AssigneeMember[];
  disabled?: boolean;
  onSelect: (ids: string[]) => void;
  children: React.ReactNode;
}

export function AssigneePopover({ value, members, disabled, onSelect, children }: AssigneePopoverProps) {
  const [open, setOpen] = React.useState(false);

  function toggle(id: string) {
    const next = value.includes(id) ? value.filter((v) => v !== id) : [...value, id];
    onSelect(next);
  }

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0">
        <Command>
          <CommandInput placeholder="Search members…" />
          <CommandList>
            <CommandEmpty>No members found.</CommandEmpty>
            <CommandGroup>
              {members.map((m) => (
                <CommandItem
                  key={m.id}
                  value={m.name}
                  onSelect={() => toggle(m.id)}
                  className="gap-2"
                >
                  <Avatar name={m.name} image={m.image} size="xs" />
                  <span className={cn("flex-1", value.includes(m.id) && "font-medium")}>
                    {m.name}
                  </span>
                  {value.includes(m.id) && <Check className="size-3.5 text-primary" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
