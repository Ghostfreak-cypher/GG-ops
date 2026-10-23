import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Account pages sit outside the workspace shell, so they need their own padding and a
// way back — the installed PWA has no browser back button. `/` redirects to the
// user's workspace.
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh p-4 md:p-6">
      <Link
        href="/"
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to workspace
      </Link>
      {children}
    </div>
  );
}
