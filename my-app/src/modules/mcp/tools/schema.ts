import { toJsonSchema } from "@/modules/api-docs/json-schema";
import type { McpTool } from "@/modules/mcp/tools/types";

export type ToolDescriptor = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; openWorldHint: boolean };
};

/**
 * A tool as it appears in `tools/list`.
 *
 * Uses the same `toJsonSchema` helper the OpenAPI spec does, so a given input is described
 * identically to an agent whether it arrives over REST or MCP — and so the
 * `z.coerce.date()` workaround lives in exactly one place.
 */
export function toolDescriptor(tool: McpTool): ToolDescriptor {
  const inputSchema = toJsonSchema(tool.inputSchema);
  // `$schema` is meaningful in a standalone document but noise inside a tools/list entry.
  delete inputSchema.$schema;

  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema,
    annotations: {
      readOnlyHint: tool.scope === "read",
      // Nothing in this tool set hard-deletes: archive is a soft delete and isn't exposed.
      destructiveHint: false,
      // All effects are confined to this app's own database.
      openWorldHint: false,
    },
  };
}
