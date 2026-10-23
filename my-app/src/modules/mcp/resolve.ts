import { isValidObjectId } from "@/lib/mongo/ids";
import { getUserWorkspaces, getWorkspaceForUser, listMembers } from "@/modules/workspace/server/queries";
import { listProjects } from "@/modules/project/server/queries";
import { listLabels } from "@/modules/label/server/queries";
import type { WorkspaceSummary } from "@/modules/workspace/server/dto";

/**
 * Turning the names an agent uses into the ids the data layer needs.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE CENTRAL INVARIANT
 *
 * Every `workspaceId` that reaches a caller-must-check query — `listProjects`,
 * `listMembers`, `searchTasks`, `getMyTasks`, `listLabels` — must come out of THIS module,
 * never out of tool arguments. `resolveWorkspace` goes through `getWorkspaceForUser` /
 * `getUserWorkspaces`, both of which require an ACTIVE membership, so **resolution is the
 * authorization boundary** for that whole family of queries.
 *
 * That is why no MCP tool schema has a `workspaceId` field, and why the ObjectId
 * passthrough below re-verifies scope instead of trusting a well-formed id.
 * `tools/schema.test.ts` enforces the no-workspaceId rule across the registry.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Matching is a ladder — exact before prefix before substring — and stops at the first
 * tier that produces anything. It never guesses: zero matches and multiple matches are
 * both errors, because silently picking one would write a task into the wrong project.
 * There is deliberately no fuzzy/edit-distance matching for the same reason.
 */

export type ResolutionKind = "not_found" | "ambiguous";
export type ResolvedEntity = "workspace" | "project" | "member" | "label";

/**
 * A failure the *model* can fix by retrying with a better value, so `tools/call` turns it
 * into an `isError` tool result rather than a JSON-RPC protocol error.
 */
export class ResolutionError extends Error {
  constructor(
    readonly kind: ResolutionKind,
    readonly entity: ResolvedEntity,
    readonly query: string,
    readonly candidates: string[],
    message: string,
  ) {
    super(message);
    this.name = "ResolutionError";
  }
}

/** Beyond this, listing every option is noise rather than help. */
const MAX_CANDIDATES_LISTED = 25;

function candidateList(candidates: string[], noun: string): string {
  if (candidates.length === 0) return `There are no ${noun} available to you.`;
  if (candidates.length > MAX_CANDIDATES_LISTED) {
    return `There are ${candidates.length} ${noun} — too many to list.`;
  }
  return `Available ${noun}: ${candidates.map((c) => `"${c}"`).join(", ")}.`;
}

function notFound(entity: ResolvedEntity, query: string, candidates: string[], noun: string): never {
  throw new ResolutionError(
    "not_found",
    entity,
    query,
    candidates,
    `No ${entity} matching "${query}". ${candidateList(candidates, noun)}`,
  );
}

function ambiguous(entity: ResolvedEntity, query: string, matched: string[]): never {
  throw new ResolutionError(
    "ambiguous",
    entity,
    query,
    matched,
    `"${query}" is ambiguous — it matches ${matched.length} ${entity}s: ` +
      `${matched.map((m) => `"${m}"`).join(", ")}. Use the exact name.`,
  );
}

const norm = (value: string) => value.trim().toLowerCase();

/**
 * Run the ladder over `items`. `keys(item)` returns that item's match keys in priority
 * order (e.g. slug before name), so an exact slug hit beats an exact name hit.
 */
function matchLadder<T>(query: string, items: T[], keys: (item: T) => string[]): T[] {
  const q = norm(query);
  if (q.length === 0) return [];

  const keyCount = Math.max(0, ...items.map((i) => keys(i).length));

  // Tier 1..N: exact match, per key position (primary key first).
  for (let position = 0; position < keyCount; position++) {
    const hits = items.filter((i) => norm(keys(i)[position] ?? "") === q);
    if (hits.length > 0) return hits;
  }
  // Tier N+1: prefix on any key.
  const prefix = items.filter((i) => keys(i).some((k) => norm(k).startsWith(q)));
  if (prefix.length > 0) return prefix;

  // Tier N+2: substring on any key.
  return items.filter((i) => keys(i).some((k) => norm(k).includes(q)));
}

/**
 * A workspace by slug, name, or id — but only one the caller actually belongs to.
 * This is the gate the rest of the module (and every workspace-scoped tool) relies on.
 */
export async function resolveWorkspace(userId: string, ref: string): Promise<WorkspaceSummary> {
  const workspaces = await getUserWorkspaces(userId);
  const names = workspaces.map((w) => `${w.name} (${w.slug})`);

  if (isValidObjectId(ref)) {
    // An id the agent read from an earlier result. Accept it, but only after confirming
    // it is one of *this caller's* workspaces — otherwise this is an IDOR.
    const byId = workspaces.find((w) => w.id === ref);
    if (byId) return byId;
    notFound("workspace", ref, names, "workspaces");
  }

  const hits = matchLadder(ref, workspaces, (w) => [w.slug, w.name]);
  if (hits.length === 0) notFound("workspace", ref, names, "workspaces");
  if (hits.length > 1) ambiguous("workspace", ref, hits.map((w) => `${w.name} (${w.slug})`));

  // Re-fetch through the membership check so the returned object is the authorized one.
  const workspace = await getWorkspaceForUser(hits[0]!.slug, userId);
  if (!workspace) notFound("workspace", ref, names, "workspaces");
  return workspace;
}

export async function resolveProject(
  workspace: WorkspaceSummary,
  ref: string,
): Promise<{ id: string; name: string }> {
  const projects = await listProjects(workspace.id);
  const names = projects.map((p) => p.name);

  if (isValidObjectId(ref)) {
    // Scope check: the id must belong to the workspace we already authorized.
    const byId = projects.find((p) => p.id === ref);
    if (byId) return { id: byId.id, name: byId.name };
    notFound("project", ref, names, `projects in ${workspace.name}`);
  }

  const hits = matchLadder(ref, projects, (p) => [p.name]);
  if (hits.length === 0) notFound("project", ref, names, `projects in ${workspace.name}`);
  if (hits.length > 1) ambiguous("project", ref, hits.map((p) => p.name));

  return { id: hits[0]!.id, name: hits[0]!.name };
}

/**
 * Emails or display names → user ids.
 *
 * Only ACTIVE members resolve. `listMembers` also returns INVITED rows, and assigning a
 * task to someone who hasn't accepted their invite would fan out notifications to a
 * non-member.
 */
export async function resolveMembers(
  workspace: WorkspaceSummary,
  refs: string[],
): Promise<string[]> {
  if (refs.length === 0) return [];

  const members = (await listMembers(workspace.id)).filter((m) => m.status === "ACTIVE");
  const labels = members.map((m) => (m.email ? `${m.name} <${m.email}>` : m.name));

  return refs.map((ref) => {
    if (isValidObjectId(ref)) {
      const byId = members.find((m) => m.userId === ref);
      if (byId) return byId.userId;
      notFound("member", ref, labels, `members of ${workspace.name}`);
    }

    // Email is the primary key — it's unique, whereas two people can share a name.
    const hits = matchLadder(ref, members, (m) => [m.email, m.name]);
    if (hits.length === 0) notFound("member", ref, labels, `members of ${workspace.name}`);
    if (hits.length > 1) {
      ambiguous("member", ref, hits.map((m) => (m.email ? `${m.name} <${m.email}>` : m.name)));
    }
    return hits[0]!.userId;
  });
}

export async function resolveLabels(
  workspace: WorkspaceSummary,
  refs: string[],
): Promise<string[]> {
  if (refs.length === 0) return [];

  const labels = await listLabels(workspace.id);
  const names = labels.map((l) => l.name);

  return refs.map((ref) => {
    if (isValidObjectId(ref)) {
      const byId = labels.find((l) => l.id === ref);
      if (byId) return byId.id;
      notFound("label", ref, names, `labels in ${workspace.name}`);
    }

    const hits = matchLadder(ref, labels, (l) => [l.name]);
    if (hits.length === 0) notFound("label", ref, names, `labels in ${workspace.name}`);
    if (hits.length > 1) ambiguous("label", ref, hits.map((l) => l.name));
    return hits[0]!.id;
  });
}
