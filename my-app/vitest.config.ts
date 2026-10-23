import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: fileURLToPath(new URL("./src/", import.meta.url)) },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // next-auth's ESM build does `import ... from "next/server"` with no extension,
    // relying on bundler magic (webpack/Turbopack). `next` has no "exports" map, so
    // Vitest's default SSR externalization hands it to Node's native loader, which
    // requires an explicit extension and throws ERR_MODULE_NOT_FOUND. Inlining forces
    // Vite to transform it instead, resolving the bare specifier itself.
    server: { deps: { inline: [/next-auth/] } },
    // src/lib/auth.ts reads these at module-load time (via auth.config.ts), and several
    // unit-tested modules import it transitively (e.g. session.ts) without ever calling
    // auth() — same 4 required vars the CI build step already stubs in ci.yml.
    env: {
      MONGODB_URI: "mongodb://localhost:27017/test",
      AUTH_SECRET: "test-secret",
      AUTH_GOOGLE_ID: "test-google-id",
      AUTH_GOOGLE_SECRET: "test-google-secret",
    },
  },
});
