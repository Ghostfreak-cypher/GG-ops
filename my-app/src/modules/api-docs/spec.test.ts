import { describe, it, expect, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/env", () => ({ env: { APP_URL: "https://ggops.test" } }));

const { buildOpenApiSpec } = await import("@/modules/api-docs/spec");
const { toJsonSchema } = await import("@/modules/api-docs/json-schema");

const spec = buildOpenApiSpec() as {
  openapi: string;
  paths: Record<string, Record<string, { operationId?: string; responses: Record<string, unknown> }>>;
  components: { schemas: Record<string, unknown> };
};

/** Walk src/app/api/v1 and derive the routes that actually exist, in OpenAPI path syntax. */
function discoverRoutes(dir: string, prefix = "/api/v1"): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      const segment = entry.startsWith("[") && entry.endsWith("]") ? `{${entry.slice(1, -1)}}` : entry;
      for (const [p, m] of discoverRoutes(full, `${prefix}/${segment}`)) found.set(p, m);
    } else if (entry === "route.ts") {
      const src = readFileSync(full, "utf8");
      const methods = [...src.matchAll(/export const (GET|POST|PATCH|DELETE|PUT)\b/g)].map((m) =>
        m[1].toLowerCase(),
      );
      if (methods.length > 0) found.set(prefix, methods);
    }
  }
  return found;
}

const V1_DIR = join(process.cwd(), "src", "app", "api", "v1");

describe("openapi spec", () => {
  it("is OpenAPI 3.1", () => {
    expect(spec.openapi).toBe("3.1.0");
  });

  it("documents every route that exists, with every method", () => {
    const actual = discoverRoutes(V1_DIR);
    // The spec endpoint documents itself only implicitly; it isn't part of the API surface.
    actual.delete("/api/v1/openapi.json");

    for (const [path, methods] of actual) {
      expect(spec.paths[path], `route ${path} exists on disk but is missing from the spec`).toBeDefined();
      for (const method of methods) {
        expect(
          spec.paths[path]?.[method],
          `${method.toUpperCase()} ${path} exists on disk but is missing from the spec`,
        ).toBeDefined();
      }
    }
  });

  it("documents no route that does not exist", () => {
    const actual = discoverRoutes(V1_DIR);
    for (const path of Object.keys(spec.paths)) {
      expect(actual.has(path), `spec documents ${path}, which has no route.ts`).toBe(true);
    }
  });

  it("gives every operation a unique operationId", () => {
    const ids = Object.values(spec.paths).flatMap((ops) =>
      Object.values(ops).map((op) => op.operationId),
    );
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("declares 401 on every authenticated operation", () => {
    for (const [path, ops] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(ops)) {
        expect(op.responses["401"], `${method.toUpperCase()} ${path} has no 401`).toBeDefined();
      }
    }
  });

  it("resolves every $ref to a defined component", () => {
    const refs = [...JSON.stringify(spec).matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(refs.length).toBeGreaterThan(0);
    for (const name of new Set(refs)) {
      expect(spec.components.schemas[name], `$ref to undefined schema ${name}`).toBeDefined();
    }
  });
});

describe("date coercion workaround", () => {
  it("emits ISO date-time strings for coerced Date fields instead of throwing", async () => {
    // The whole reason json-schema.ts exists: a bare z.toJSONSchema() throws
    // "Date cannot be represented in JSON Schema" on these two schemas.
    const { createTaskSchema, updateTaskSchema } = await import("@/modules/task/schemas");

    for (const schema of [createTaskSchema, updateTaskSchema]) {
      const json = toJsonSchema(schema) as {
        properties: { dueDate?: { anyOf?: { type?: string; format?: string }[] } };
      };
      const variants = json.properties.dueDate?.anyOf ?? [];
      expect(variants).toContainEqual({ type: "string", format: "date-time" });
      expect(variants).toContainEqual({ type: "null" });
    }
  });

  it("keeps the real validators' constraints (so the spec cannot drift from validation)", async () => {
    const { createTaskSchema } = await import("@/modules/task/schemas");
    const json = toJsonSchema(createTaskSchema) as {
      required: string[];
      properties: { title: { maxLength: number; minLength: number } };
    };
    // These numbers come from createTaskSchema itself, not from a hand-written copy.
    expect(json.required).toEqual(["title"]);
    expect(json.properties.title.maxLength).toBe(300);
    expect(json.properties.title.minLength).toBe(1);
  });
});
