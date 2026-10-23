import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      {/* Left inverted panel — desktop only */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-black p-12 text-white border-r-[3px] border-black">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center border-2 border-white bg-white p-1">
            <Image src="/logo-icon.png" alt="GG" width={28} height={28} className="size-full object-contain" />
          </span>
          <span className="inline-block border-[3px] border-white px-3 py-1 font-display text-xs uppercase tracking-widest text-white">
            GGOps
          </span>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <h2 className="font-display text-6xl leading-none text-white">
              Work<br />smarter.
            </h2>
            <p className="max-w-sm font-sans text-base leading-relaxed text-white/70">
              The project management platform that keeps your team aligned and your projects on track.
            </p>
          </div>

          <ul className="space-y-3 font-sans text-sm text-white/60">
            <li className="border-l-[3px] border-white/30 pl-3">Manage projects and tasks with ease</li>
            <li className="border-l-[3px] border-white/30 pl-3">Collaborate seamlessly with your team</li>
            <li className="border-l-[3px] border-white/30 pl-3">Track progress and hit your goals</li>
          </ul>
        </div>

        <p className="font-sans text-xs uppercase tracking-widest text-white/30">
          © 2025 GGOps
        </p>
      </div>

      {/* Right form panel */}
      <div className="relative flex w-full lg:w-1/2 flex-col items-center justify-center px-4 pb-4 pt-16 sm:p-8 lg:p-12">
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>

        {/* Mobile wordmark */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <span className="grid size-9 shrink-0 place-items-center border-2 border-border bg-white p-1">
            <Image src="/logo-icon.png" alt="GG" width={28} height={28} className="size-full object-contain" />
          </span>
          <span className="inline-block border-[3px] border-border px-3 py-1 font-display text-xs uppercase tracking-widest">
            GGOps
          </span>
        </div>

        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
