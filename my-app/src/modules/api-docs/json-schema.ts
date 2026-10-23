import { z } from "zod";

/**
 * Zod → JSON Schema, with the one fix this codebase needs.
 *
 * `createTaskSchema`/`updateTaskSchema` type their date fields as
 * `z.union([z.null(), z.coerce.date()])` — the coercion is what lets a route accept an ISO
 * string and hand a real `Date` to Mongoose. But a `Date` has no JSON Schema
 * representation, so a plain `z.toJSONSchema()` call throws
 * *"Date cannot be represented in JSON Schema"* on exactly the two schemas the public API
 * most needs to document.
 *
 * Rather than maintain a parallel set of "wire" schemas that could silently drift from the
 * ones actually enforcing validation, we convert the real schemas and rewrite `date` nodes
 * into `{ type: "string", format: "date-time" }` on the way out. That matches what the API
 * genuinely accepts and what Docs/API-V1-CONTRACT.md promises: "Dates on the wire — always
 * ISO strings or null, both directions."
 *
 * Shared with the MCP tool layer (V4), which needs JSON Schema for `tools/list` and must
 * describe the same inputs the same way.
 */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, {
    target: "draft-2020-12",
    // What a client SENDS — pre-coercion. Without this we'd document the parsed `Date`.
    io: "input",
    // Don't throw on Date; hand it to `override` below instead.
    unrepresentable: "any",
    override: (ctx) => {
      const def = (ctx.zodSchema as { _zod?: { def?: { type?: string } } })._zod?.def;
      if (def?.type !== "date") return;
      // `unrepresentable: "any"` leaves `{}`; replace it wholesale.
      for (const key of Object.keys(ctx.jsonSchema)) {
        delete (ctx.jsonSchema as Record<string, unknown>)[key];
      }
      Object.assign(ctx.jsonSchema, { type: "string", format: "date-time" });
    },
  }) as Record<string, unknown>;
}

/** `toJsonSchema` minus the `$schema` key — the form OpenAPI `components.schemas` wants. */
export function toComponentSchema(schema: z.ZodType): Record<string, unknown> {
  const out = toJsonSchema(schema);
  delete out.$schema;
  return out;
}
