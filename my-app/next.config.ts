import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Injected once per build so the client can cache-bust /sw.js on every deploy —
  // sw.js is a static file with no access to process.env at runtime, so the version
  // has to travel in via the registration URL instead. VERCEL_GIT_COMMIT_SHA is only
  // set on Vercel; Date.now() covers local builds.
  env: {
    NEXT_PUBLIC_SW_VERSION: process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now()),
  },
  // Server-only deps: keep them out of Next's server bundle tracing (faster
  // builds/cold starts). All are confirmed server-side only.
  serverExternalPackages: ["mongoose", "bcryptjs", "googleapis", "@aws-sdk/client-s3"],
  experimental: {
    // recharts / lucide-react / date-fns are already optimized by default in
    // Next 16 — only the Radix packages + cmdk need listing here.
    optimizePackageImports: [
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-separator",
      "cmdk",
    ],
  },
  // No remotePatterns on purpose: next/image only serves the local logo today, and
  // /_next/image is public (the proxy skips it), so each allowed remote host — `**.amazonaws.com`
  // was one — made it an open image proxy. Add hosts back when avatars/previews move to next/image.
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // The task/project REST routes moved under /api/v1 (W0.2 contract). 308 — not 307/302 —
  // because it is the only redirect status that permanently preserves the method AND body,
  // so an in-flight POST /api/tasks/:id/move still lands as a POST with its payload intact.
  async redirects() {
    return [
      { source: "/api/tasks/:path*", destination: "/api/v1/tasks/:path*", permanent: true },
      { source: "/api/projects/:path*", destination: "/api/v1/projects/:path*", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // A stale cached sw.js can never update itself, so it must never be cached —
        // this entry is applied after /:path* above and its keys win on overlap.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;