import { describe, it, expect } from "vitest";
import {
  extractMentionTokens,
  matchMentions,
  hasAllMention,
  parseMentionBody,
  rankMentionCandidates,
  resolveMentionRecipients,
} from "@/lib/mentions";

describe("extractMentionTokens", () => {
  it("pulls unique @tokens, lowercased", () => {
    expect(extractMentionTokens("hey @John and @jane.roe, also @john")).toEqual([
      "john",
      "jane.roe",
    ]);
  });
  it("strips trailing punctuation", () => {
    expect(extractMentionTokens("ping @john.")).toEqual(["john"]);
  });
  it("returns [] when there are no mentions", () => {
    expect(extractMentionTokens("no mentions here")).toEqual([]);
  });
  it("picks the all token out of TipTap mention-span HTML", () => {
    const html =
      '<p><span class="mention" data-id="all" data-type="mention">@all</span> standup in 5</p>';
    expect(extractMentionTokens(html)).toContain("all");
  });
});

describe("matchMentions", () => {
  const members = [
    { userId: "u1", name: "John Doe", email: "john@acme.com" },
    { userId: "u2", name: "Jane Roe", email: "jane.roe@acme.com" },
  ];
  it("matches by email local-part or first name", () => {
    expect(matchMentions(["john"], members)).toEqual(["u1"]);
    expect(matchMentions(["jane.roe"], members)).toEqual(["u2"]);
  });
  it("ignores unknown tokens and de-dupes", () => {
    expect(matchMentions(["nobody"], members)).toEqual([]);
    expect(matchMentions(["john", "john"], members)).toEqual(["u1"]);
  });
});

describe("hasAllMention", () => {
  it("detects the all token", () => {
    expect(hasAllMention(["john", "all"])).toBe(true);
    expect(hasAllMention(["john"])).toBe(false);
  });
});

describe("resolveMentionRecipients", () => {
  const members = [
    { userId: "u1", name: "John Doe", email: "john@acme.com" },
    { userId: "u2", name: "Jane Roe", email: "jane.roe@acme.com" },
    { userId: "u3", name: "Bob Poe", email: "bob@acme.com" },
  ];

  it("returns explicit mentions minus the author, no @all", () => {
    expect(resolveMentionRecipients("hi @john", members, "u2")).toEqual({
      explicitIds: ["u1"],
      allIds: [],
    });
  });

  it("never includes the author, even when self-mentioned", () => {
    expect(resolveMentionRecipients("note to self @john", members, "u1")).toEqual({
      explicitIds: [],
      allIds: [],
    });
  });

  it("@all expands to every member except the author", () => {
    expect(resolveMentionRecipients("@all standup", members, "u1")).toEqual({
      explicitIds: [],
      allIds: ["u2", "u3"],
    });
  });

  it("explicit mentions stay explicit; @all sweeps up the rest", () => {
    expect(resolveMentionRecipients("@john please review @all", members, "u2")).toEqual({
      explicitIds: ["u1"],
      allIds: ["u3"],
    });
  });
});

describe("rankMentionCandidates", () => {
  // The real GG-sprint workspace has 16 members; the old hard-coded
  // `.slice(0, 6)` hid 10 of them, which is what made people unmentionable.
  const sixteen = Array.from({ length: 16 }, (_, i) => ({
    name: `Person ${String(i).padStart(2, "0")}`,
    email: `person${i}@acme.com`,
  }));

  it("shows every member of a 16-person workspace on an empty query", () => {
    expect(rankMentionCandidates(sixteen, "")).toHaveLength(16);
  });

  it("still caps very large workspaces", () => {
    const many = Array.from({ length: 400 }, (_, i) => ({ name: `P${i}`, email: `p${i}@x.com` }));
    expect(rankMentionCandidates(many, "")).toHaveLength(50);
  });

  const members = [
    { name: "John Doe", email: "john@acme.com" },
    { name: "Jane Roe", email: "jane.roe@acme.com" },
    { name: "John Smith", email: "jsmith@acme.com" },
    { name: "Zoë Müller", email: "zoe@acme.com" },
  ];

  it("finds people by email, which the old name-only filter could not", () => {
    expect(rankMentionCandidates(members, "jsmith").map((m) => m.name)).toEqual(["John Smith"]);
    expect(rankMentionCandidates(members, "jane.r").map((m) => m.name)).toEqual(["Jane Roe"]);
  });

  it("matches across a space without needing allowSpaces", () => {
    expect(rankMentionCandidates(members, "johnd").map((m) => m.name)).toEqual(["John Doe"]);
  });

  it("matches an accented name by its plain-ASCII surname", () => {
    expect(rankMentionCandidates(members, "müller").map((m) => m.name)).toEqual(["Zoë Müller"]);
  });

  it("returns both Johns for an ambiguous query, best-sorted and stable", () => {
    expect(rankMentionCandidates(members, "john").map((m) => m.name)).toEqual([
      "John Doe",
      "John Smith",
    ]);
  });

  it("returns nothing for a query that matches nobody", () => {
    expect(rankMentionCandidates(members, "nobodyhere")).toEqual([]);
  });

  it("tolerates members with no email", () => {
    expect(rankMentionCandidates([{ name: "Solo" }], "solo").map((m) => m.name)).toEqual(["Solo"]);
  });
});

// ---------------------------------------------------------------------------
// Mention nodes: the editor stores the real userId in `data-id`, so resolution
// must key off that rather than the visible label.
// ---------------------------------------------------------------------------

const mentionSpan = (id: string, label: string) =>
  `<span class="mention" data-id="${id}" data-type="mention">@${label}</span>`;

describe("parseMentionBody", () => {
  it("takes the data-id and drops the label from the text tokens", () => {
    expect(parseMentionBody(`<p>${mentionSpan("u1", "John Doe")} ping</p>`)).toEqual({
      nodeIds: ["u1"],
      textTokens: [],
    });
  });

  it("keeps @tokens that live outside a mention span", () => {
    const body = `<p>${mentionSpan("u1", "John")} and @bob</p>`;
    expect(parseMentionBody(body)).toEqual({ nodeIds: ["u1"], textTokens: ["bob"] });
  });

  it("tolerates single quotes and reordered attributes", () => {
    const body = `<p><span data-type='mention' data-id='u9' class='mention'>@Zoe</span></p>`;
    expect(parseMentionBody(body).nodeIds).toEqual(["u9"]);
  });

  it("falls back to the label text when a mention span has no data-id", () => {
    const body = `<p><span class="mention" data-type="mention">@john</span></p>`;
    expect(parseMentionBody(body)).toEqual({ nodeIds: [], textTokens: ["john"] });
  });

  it("leaves non-mention spans untouched", () => {
    const body = `<p><span class="highlight">@john</span></p>`;
    expect(parseMentionBody(body)).toEqual({ nodeIds: [], textTokens: ["john"] });
  });

  it("de-dupes repeated ids", () => {
    const body = `${mentionSpan("u1", "John")} ${mentionSpan("u1", "John")}`;
    expect(parseMentionBody(body).nodeIds).toEqual(["u1"]);
  });
});

describe("resolveMentionRecipients — mention nodes", () => {
  // Two Johns (the collision the old text matching could not resolve) and one
  // accented name (unmatchable by the ASCII-only token regex).
  const JOHN_DOE = "aaaaaaaaaaaaaaaaaaaaaaa1";
  const JANE = "aaaaaaaaaaaaaaaaaaaaaaa2";
  const JOHN_SMITH = "aaaaaaaaaaaaaaaaaaaaaaa3";
  const ZOE = "aaaaaaaaaaaaaaaaaaaaaaa4";
  const OUTSIDER = "bbbbbbbbbbbbbbbbbbbbbbb1";

  const members = [
    { userId: JOHN_DOE, name: "John Doe", email: "john@acme.com" },
    { userId: JANE, name: "Jane Roe", email: "jane.roe@acme.com" },
    { userId: JOHN_SMITH, name: "John Smith", email: "jsmith@acme.com" },
    { userId: ZOE, name: "Zoë Müller", email: "zoe@acme.com" },
  ];

  it("targets exactly one of two people sharing a first name", () => {
    const body = `<p>${mentionSpan(JOHN_SMITH, "John Smith")} take a look</p>`;
    expect(resolveMentionRecipients(body, members, JANE)).toEqual({
      explicitIds: [JOHN_SMITH],
      allIds: [],
    });
  });

  it("resolves a name the ASCII token regex can never match", () => {
    const body = `<p>${mentionSpan(ZOE, "Zoë Müller")} hi</p>`;
    expect(resolveMentionRecipients(body, members, JANE).explicitIds).toEqual([ZOE]);
  });

  it("ignores a well-formed id that is not a workspace member", () => {
    const body = `<p>${mentionSpan(OUTSIDER, "Mallory")}</p>`;
    expect(resolveMentionRecipients(body, members, JANE)).toEqual({
      explicitIds: [],
      allIds: [],
    });
  });

  it("ignores malformed data-id values without throwing", () => {
    for (const bad of ["__proto__", "constructor", "", "aaaaaaaaaaaaaaaaaaaaaaa", "all "]) {
      const body = `<p>${mentionSpan(bad, "x")}</p>`;
      expect(resolveMentionRecipients(body, members, JANE)).toEqual({
        explicitIds: [],
        allIds: [],
      });
    }
  });

  it("expands an @all node to everyone but the author, never as an explicit id", () => {
    const body = `<p>${mentionSpan("all", "all")} standup</p>`;
    const result = resolveMentionRecipients(body, members, JOHN_DOE);
    expect(result.explicitIds).toEqual([]);
    expect(result.allIds).toEqual([JANE, JOHN_SMITH, ZOE]);
    expect(result.explicitIds).not.toContain("all");
  });

  it("keeps explicit node mentions explicit while @all sweeps the rest", () => {
    const body = `${mentionSpan(JOHN_SMITH, "John Smith")} ${mentionSpan("all", "all")}`;
    expect(resolveMentionRecipients(body, members, JANE)).toEqual({
      explicitIds: [JOHN_SMITH],
      allIds: [JOHN_DOE, ZOE],
    });
  });

  it("excludes the author's own node mention", () => {
    const body = `<p>${mentionSpan(JANE, "Jane Roe")} note to self</p>`;
    expect(resolveMentionRecipients(body, members, JANE)).toEqual({
      explicitIds: [],
      allIds: [],
    });
  });

  it("still resolves plain-text mentions alongside node mentions", () => {
    const body = `<p>${mentionSpan(JOHN_SMITH, "John Smith")} and @jane.roe</p>`;
    const result = resolveMentionRecipients(body, members, JOHN_DOE);
    expect([...result.explicitIds].sort()).toEqual([JOHN_SMITH, JANE].sort());
  });

  it("de-dupes a person mentioned as both a node and plain text", () => {
    // "@jsmith" is John Smith's email local-part — unambiguous, unlike "@john".
    const body = `<p>${mentionSpan(JOHN_SMITH, "John Smith")} @jsmith</p>`;
    expect(resolveMentionRecipients(body, members, JANE).explicitIds).toEqual([JOHN_SMITH]);
  });

  it("leaves plain-text ambiguity intact — a bare @john still hits both Johns", () => {
    // Documents the tradeoff: only a mention node can disambiguate. Typed text
    // keeps its historical, deliberately permissive matching.
    const result = resolveMentionRecipients("<p>@john</p>", members, JANE);
    expect([...result.explicitIds].sort()).toEqual([JOHN_DOE, JOHN_SMITH].sort());
  });
});
