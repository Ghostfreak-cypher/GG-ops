import type { Metadata, Viewport } from "next";
import { Archivo_Black, Work_Sans, Space_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegistration } from "@/components/service-worker";

const archivoBlack = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GGOps",
  description: "GGOps — project management for GeneGenius teams",
  applicationName: "GGOps",
  appleWebApp: {
    capable: true,
    title: "GGOps",
    statusBarStyle: "default",
  },
};

// width/initial-scale are Next's defaults and stay implicit. No maximumScale or
// userScalable — pinch-zoom must keep working. viewportFit lets the layout reach
// under the notch; the safe-area padding that pays for it is in globals.css.
// resizes-content makes the Android keyboard shrink dvh, so sheet footers stay visible.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`h-full antialiased ${archivoBlack.variable} ${workSans.variable} ${spaceMono.variable}`}
    >
      <body className="min-h-full bg-background text-foreground">
        <Providers>{children}</Providers>
        <Toaster />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
