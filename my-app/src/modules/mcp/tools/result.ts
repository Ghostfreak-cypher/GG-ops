/**
 * MCP `tools/call` result shapes.
 *
 * The distinction that matters: a **tool error** is `isError: true` inside a successful
 * result, NOT a JSON-RPC `-32xxx`. Protocol errors are addressed to the client library and
 * are usually invisible to the model; `isError` results land in the conversation where the
 * model can read them and try something else. So anything the model could plausibly fix —
 * a bad name, a missing permission, a validation failure — belongs here.
 */

export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: true;
};

export function toolOk(data: unknown): ToolResult {
  const text =
    typeof data === "string" ? data : JSON.stringify(data, null, 2) ?? String(data);
  return { content: [{ type: "text", text }] };
}

export function toolError(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}
