import { describe, it, expect, vi } from "vitest";

// The registry imports server actions, which import the session DAL → next-auth →
// `next/server`, a module vitest cannot resolve outside the Next runtime. These tests only
// inspect tool metadata and never invoke a handler, so stubbing the DAL is enough.
vi.mock("@/modules/auth/server/session", () => ({
  getCurrentUser: async () => null,
  requireUser: async () => {
    throw new Error("requireUser must not be called while inspecting tool schemas");
  },
}));

const { MCP_TOOLS, TOOLS_BY_NAME } = await import("@/modules/mcp/tools");
const { toolDescriptor } = await import("@/modules/mcp/tools/schema");

/**
 * Registry-wide invariants. These matter more with every tool added: a single tool whose
 * schema can't be serialised takes down `tools/list` for the whole server, and the model's
 * only guidance is the text in `name`/`title`/`description`.
 */
describe("MCP tool registry", () => {
  it("has at least one tool", () => {
    expect(MCP_TOOLS.length).toBeGreaterThan(0);
  });

  it("converts every input schema to JSON Schema without throwing", () => {
    // The trap this guards: z.coerce.date() throws "Date cannot be represented in JSON
    // Schema". Reusing createTaskSchema directly in a tool would break tools/list entirely.
    for (const tool of MCP_TOOLS) {
      expect(() => toolDescriptor(tool), `tool ${tool.name} has an unserialisable schema`).not.toThrow();
      const d = toolDescriptor(tool);
      expect(d.inputSchema.type, `tool ${tool.name} must take an object`).toBe("object");
      expect(d.inputSchema.$schema).toBeUndefined();
    }
  });

  it("uses unique snake_case names", () => {
    const names = MCP_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
    expect(TOOLS_BY_NAME.size).toBe(MCP_TOOLS.length);
  });

  it("gives the model something substantive to choose on", () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.title.length, `${tool.name} needs a title`).toBeGreaterThan(0);
      // Short descriptions are the top cause of a model picking the wrong tool.
      expect(tool.description.length, `${tool.name} needs a real description`).toBeGreaterThan(40);
    }
  });

  it("declares a valid scope on every tool", () => {
    for (const tool of MCP_TOOLS) expect(["read", "write"]).toContain(tool.scope);
  });

  it("marks read tools readOnlyHint and never claims a tool is destructive", () => {
    for (const tool of MCP_TOOLS) {
      const d = toolDescriptor(tool);
      expect(d.annotations.readOnlyHint).toBe(tool.scope === "read");
      expect(d.annotations.destructiveHint).toBe(false);
    }
  });

  it("never exposes a raw workspaceId argument", () => {
    // The central invariant: agents address workspaces by name/slug, and resolution against
    // the caller's memberships IS the authorization boundary. A workspaceId argument would
    // let an agent name a workspace the caller isn't in.
    for (const tool of MCP_TOOLS) {
      const props = Object.keys(
        (toolDescriptor(tool).inputSchema.properties ?? {}) as Record<string, unknown>,
      );
      expect(props, `${tool.name} must not accept a workspaceId`).not.toContain("workspaceId");
    }
  });
});
