"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <div className="flex items-center gap-2">
      <Link className="text-xs text-muted-foreground underline" href="/account/security">
        Security
      </Link>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Sign out"
        title="Sign out"
        className="size-9 text-muted-foreground"
        onClick={() => signOut({ callbackUrl: "/sign-in" })}
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}
