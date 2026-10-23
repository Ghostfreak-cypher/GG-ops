import Link from "next/link";

// Covers every notFound() call site (workspace layout, spend layout, search, …).
// Without this they render Next's default page outside the app shell — on mobile
// that is a dead end with no navigation once the sidebar is behind a drawer.
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6">
      <h1 className="font-display text-3xl uppercase tracking-widest">Not found</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        That page doesn&apos;t exist, or you no longer have access to it.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-11 w-fit items-center border-[3px] border-border bg-primary px-6 font-sans text-sm font-semibold uppercase tracking-widest text-primary-foreground transition-colors hover:bg-background hover:text-foreground"
      >
        Back to your workspace
      </Link>
    </div>
  );
}
