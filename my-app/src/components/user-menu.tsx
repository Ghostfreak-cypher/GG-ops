"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronDown, Download, KeyRound, LogOut, Shield, User } from "lucide-react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Not in lib.dom.d.ts — Chromium-only, no standard type exists.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

const STANDALONE_QUERY = "(display-mode: standalone)";
const subscribeStandalone = (cb: () => void) => {
  const mq = window.matchMedia(STANDALONE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const noopSubscribe = () => () => {};

/** True only in iOS Safari (the property doesn't exist elsewhere). */
function useIsIOSBrowser() {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof (navigator as { standalone?: boolean }).standalone === "boolean",
    () => false,
  );
}

/**
 * Chromium fires `beforeinstallprompt` once, shortly after load, and never again —
 * so the listener has to live somewhere always-mounted. UserMenu is rendered in the
 * header on every dashboard page, which is as close to "always" as this app gets;
 * a listener registered only while the dropdown is open (inside DropdownMenuContent,
 * which Radix unmounts when closed) would miss the event outright.
 */
function useInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setEvent(e);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!event) return;
    void event.prompt();
    await event.userChoice;
    setEvent(null);
  }

  return { canInstall: event !== null, install };
}

export function UserMenu({
  name,
  email,
  image,
  profileHref,
}: {
  name: string;
  email: string;
  image?: string | null;
  profileHref: string;
}) {
  const { canInstall, install } = useInstallPrompt();
  const isIOSBrowser = useIsIOSBrowser();
  const isStandalone = useSyncExternalStore(
    subscribeStandalone,
    () => window.matchMedia(STANDALONE_QUERY).matches || (navigator as { standalone?: boolean }).standalone === true,
    () => false,
  );
  const showInstall = !isStandalone && (canInstall || isIOSBrowser);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar name={name} image={image} size="md" />
          <span className="hidden font-sans text-sm text-muted-foreground sm:inline">
            {name}
          </span>
          <ChevronDown className="hidden size-4 text-muted-foreground sm:inline" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium text-foreground">
            {name}
          </span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {email}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href={profileHref}>
            <User className="size-4" />
            Profile
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/account/security">
            <Shield className="size-4" />
            Security
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/account/api-keys">
            <KeyRound className="size-4" />
            API keys
          </Link>
        </DropdownMenuItem>

        {showInstall && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                if (canInstall) {
                  void install();
                } else {
                  toast("Tap the Share button, then \"Add to Home Screen\".");
                }
              }}
            >
              <Download className="size-4" />
              Install app
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          destructive
          onClick={() => signOut({ callbackUrl: "/sign-in" })}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
