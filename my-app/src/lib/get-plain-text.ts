/** Converts TipTap-generated rich text (e.g. comment bodies) to plain text.
 * Mention spans' `@Label` text content is preserved since it's inside the
 * tag, not an attribute; block-element and <br> boundaries become newlines so
 * multi-paragraph comments stay readable. Also drops an unterminated trailing
 * tag left behind when stored HTML was sliced mid-tag. */
export function getPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/<[^>]*$/, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
