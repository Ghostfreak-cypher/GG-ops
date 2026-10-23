// Keep this module free of server-only dependencies (mongoose, db, …). The editor
// is a client component and imports ALL_MENTION_ID from here.
import { slugify } from "@/lib/slug";

/**
 * The synthetic mention that fans out to the whole workspace. Shared with the
 * editor so the client and server can't drift on the sentinel.
 */
export const ALL_MENTION_ID = "all";

/** Mirrors `isValidObjectId` in `@/lib/mongo/ids` — duplicated to keep this module client-safe. */
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

/**
 * One `<span>` and its contents. Mention nodes never nest and StarterKit emits no
 * other spans, so pairing with the first `</span>` is safe here.
 */
const SPAN_RE = /<span\b([^>]*)>([\s\S]*?)<\/span>/gi;
const DATA_ID_RE = /\bdata-id=["']([^"']*)["']/i;

function isMentionAttrs(attrs: string): boolean {
  return (
    /\bdata-type=["']mention["']/i.test(attrs) ||
    /\bclass=["'][^"']*\bmention\b/i.test(attrs)
  );
}

/** Pull unique `@token`s out of comment text, lowercased and trimmed of trailing punctuation. */
export function extractMentionTokens(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9._-]+)/g) ?? [];
  const tokens = matches.map((m) => m.slice(1).toLowerCase().replace(/[._-]+$/, ""));
  return [...new Set(tokens.filter(Boolean))];
}

export type MentionMember = { userId: string; name: string; email: string };

/** Resolve mention tokens to member user ids (by email local-part, first name, or name slug). */
export function matchMentions(tokens: string[], members: MentionMember[]): string[] {
  const wanted = new Set(tokens);
  const result = new Set<string>();
  for (const m of members) {
    const local = (m.email.split("@")[0] ?? "").toLowerCase();
    const first = (m.name.trim().toLowerCase().split(/\s+/)[0] ?? "");
    const slug = slugify(m.name);
    if (wanted.has(local) || wanted.has(first) || wanted.has(slug)) {
      result.add(m.userId);
    }
  }
  return [...result];
}

/** `@all` mentions every workspace member. */
export function hasAllMention(tokens: string[]): boolean {
  return tokens.includes(ALL_MENTION_ID);
}

export type MentionRecipients = {
  /** Explicitly @named members (minus the author) — get notifications and emails. */
  explicitIds: string[];
  /** Members swept in by `@all` (minus author and explicit) — in-app notifications only. */
  allIds: string[];
};

/** Minimum shape the mention dropdown needs to rank a candidate. */
export type MentionCandidate = { name: string; email?: string | null };

/** Generous upper bound so nobody falls off the list; ranking does the real work. */
export const MAX_MENTION_SUGGESTIONS = 50;

/** Punctuation-free form, so "johnd" matches "John Doe" and "janer" matches jane.roe@… */
const normalizeForSearch = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Lower is better; -1 means no match. Exported for testing. */
export function scoreMentionCandidate(m: MentionCandidate, query: string): number {
  if (!query) return 0;
  const name = m.name.toLowerCase();
  const email = (m.email ?? "").toLowerCase();
  if (name.split(/\s+/).some((word) => word.startsWith(query))) return 0;
  if (email.startsWith(query)) return 1;
  const nq = normalizeForSearch(query);
  if (normalizeForSearch(m.name).includes(nq) || normalizeForSearch(email).includes(nq)) return 2;
  if (name.includes(query) || email.includes(query)) return 3;
  return -1;
}

/**
 * Rank and cap the @mention dropdown candidates. Matches on name AND email, so a
 * person is reachable by either; sorting by relevance keeps the best match inside
 * the cap, which is why the cap can be generous instead of the old hard 6.
 */
export function rankMentionCandidates<T extends MentionCandidate>(
  members: readonly T[],
  query: string,
  limit: number = MAX_MENTION_SUGGESTIONS,
): T[] {
  const q = query.trim().toLowerCase();
  return members
    .map((m) => ({ m, score: scoreMentionCandidate(m, q) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => a.score - b.score || a.m.name.localeCompare(b.m.name))
    .map((x) => x.m)
    .slice(0, limit);
}

export type ParsedMentionBody = {
  /** Raw `data-id` values off mention nodes. UNTRUSTED — this is client-submitted HTML. */
  nodeIds: string[];
  /** `@token`s from the text that remains once mention nodes are removed. */
  textTokens: string[];
};

/**
 * Split a body into mention-node ids and leftover plain-text tokens.
 *
 * The span is removed *before* tokenizing on purpose. A node's label is redundant
 * with its `data-id`, so dropping it is lossless — and keeping it would let the
 * text fallback fuzzy-match the label (`@John`) and notify every other John.
 */
export function parseMentionBody(body: string): ParsedMentionBody {
  const nodeIds: string[] = [];
  const rest = body.replace(SPAN_RE, (whole: string, attrs: string, inner: string) => {
    if (!isMentionAttrs(attrs)) return whole;
    const id = attrs.match(DATA_ID_RE)?.[1];
    if (!id) return ` ${inner} `; // malformed node — let the text fallback try
    nodeIds.push(id);
    return " ";
  });
  return { nodeIds: [...new Set(nodeIds)], textTokens: extractMentionTokens(rest) };
}

/** Split a rich-text body's mentions into explicit recipients and `@all` overflow. */
export function resolveMentionRecipients(
  body: string,
  members: MentionMember[],
  authorId: string,
): MentionRecipients {
  const { nodeIds, textTokens } = parseMentionBody(body);

  // TRUST BOUNDARY: `data-id` arrives inside client-submitted HTML. An id counts only
  // if it is also in the server's own member list — never notify a user just because
  // the client asked for them.
  const memberIds = new Set(members.map((m) => m.userId));
  const fromNodes = nodeIds.filter((id) => OBJECT_ID_RE.test(id) && memberIds.has(id));

  // Fallback for bodies with no mention nodes: hand-typed "@john", inbound email, …
  const fromText = matchMentions(textTokens, members);

  const explicitIds = [...new Set([...fromNodes, ...fromText])].filter(
    (id) => id !== authorId,
  );

  // ALL_MENTION_ID fails OBJECT_ID_RE, so it can never leak into explicitIds.
  const wantsAll = nodeIds.includes(ALL_MENTION_ID) || hasAllMention(textTokens);
  if (!wantsAll) return { explicitIds, allIds: [] };

  const explicit = new Set(explicitIds);
  const allIds = members
    .map((m) => m.userId)
    .filter((id) => id !== authorId && !explicit.has(id));
  return { explicitIds, allIds };
}
