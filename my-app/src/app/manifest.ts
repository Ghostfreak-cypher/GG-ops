import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest; <link rel="manifest"> is emitted automatically.
// No env reads here — that keeps this route statically prerendered.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GGOps — GeneGenius Ops",
    short_name: "GGOps",
    id: "/",
    start_url: "/",
    display: "standalone",
    lang: "en",
    dir: "ltr",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
