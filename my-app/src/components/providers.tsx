"use client";

import { useState, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* No SessionProvider: nothing calls useSession, and it refetched /api/auth/session
          on every page load and tab refocus. signIn/signOut work without it. */}
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
