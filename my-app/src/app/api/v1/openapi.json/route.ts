import { handle } from "@/lib/api/handler";
import { buildOpenApiSpec } from "@/modules/api-docs/spec";

/**
 * GET /api/v1/openapi.json — the machine-readable description of this API.
 *
 * Deliberately unauthenticated (`handle`, not `handleAuthed`): a spec is public API
 * metadata, it contains no data, and a client that can't read it before authenticating
 * can't discover how to authenticate. It is also the one `/api/v1` response that does NOT
 * use the `{ok, data}` envelope — an OpenAPI document has its own schema, and wrapping it
 * would break every standard tool that consumes it. Same reasoning as `lib/oauth-response.ts`.
 */
export const GET = handle(async () => {
  // Built per request, not at import: building reads APP_URL, and `next build` imports this
  // route while collecting page data, where lib/env.ts's production check must not run.
  return Response.json(buildOpenApiSpec(), {
    headers: {
      // Cheap to rebuild but fully static; let clients and CDNs hold it briefly.
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
});
