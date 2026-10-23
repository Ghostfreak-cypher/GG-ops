/** The markup rich text may contain — DOMPurify's allow-list in `RichTextContent`. */
export const RICH_TAGS = [
  "p", "br", "strong", "em", "s", "u", "code", "pre",
  "ul", "ol", "li", "a", "span",
  "h1", "h2", "h3", "h4", "blockquote", "hr",
];
export const RICH_ATTRS = ["href", "target", "rel", "class", "data-id", "data-type"];

const TAG = `(?:${RICH_TAGS.join("|")})`;
const ATTR = String.raw`\s+(?:${RICH_ATTRS.join("|")}|data-[a-z0-9-]+)="[^"<>]*"`;
const SAFE_TAG = new RegExp(String.raw`^<(?:/${TAG}\s*|${TAG}(?:${ATTR})*\s*/?)>$`);
const UNSAFE_HREF = /\shref="(?!https?:\/\/|mailto:)/;

/**
 * True when `html` is plain editor markup that DOMPurify would leave alone: only allow-listed
 * tags, only allow-listed double-quoted attributes, and http(s)/mailto links. There is no DOM on
 * the server for DOMPurify, so `RichTextContent` server-renders HTML only when this holds and
 * leaves anything else for the client to sanitize.
 */
export function isSafeRichHtml(html: string): boolean {
  for (const [tag] of html.matchAll(/<[^>]*>?/g)) {
    if (!SAFE_TAG.test(tag) || UNSAFE_HREF.test(tag)) return false;
  }
  return true;
}
