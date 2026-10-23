import { describe, expect, it } from "vitest";
import { isSafeRichHtml } from "@/lib/rich-html";

describe("isSafeRichHtml", () => {
  it.each([
    "Plain text & more",
    "<p>Hello <strong>world</strong> <em>and</em> <s>x</s> <u>y</u> <code>z</code></p>",
    '<p><a target="_blank" rel="noopener noreferrer nofollow" class="text-primary underline" href="https://example.com/?a=1&amp;b=2">link</a></p>',
    '<p><span data-type="mention" class="mention" data-id="65f0c0ffee" data-label="Sam" data-mention-suggestion-char="@">@Sam</span></p>',
    "<h2>Title</h2><ul><li><p>one</p></li></ul><ol><li><p>two</p></li></ol><blockquote><p>q</p></blockquote><hr><br /><pre><code>x</code></pre>",
    '<p><a href="mailto:a@b.co">mail</a></p>',
  ])("allows editor markup: %s", (html) => {
    expect(isSafeRichHtml(html)).toBe(true);
  });

  it.each([
    "<img src=x onerror=alert(1)>",
    '<p onclick="alert(1)">x</p>',
    "<script>alert(1)</script>",
    "<svg><script>alert(1)</script></svg>",
    '<a href="javascript:alert(1)">x</a>',
    '<a href="&#106;avascript:alert(1)">x</a>',
    '<a href="https://ok.com" href="javascript:alert(1)">x</a>',
    "<a href='https://ok.com'>x</a>",
    '<a href="https://ok.com"onclick="alert(1)">x</a>',
    "<p>unclosed <b",
    "<!-- c --><p>x</p>",
    '<iframe src="https://example.com"></iframe>',
    "<STYLE>p{}</STYLE>",
  ])("rejects anything else: %s", (html) => {
    expect(isSafeRichHtml(html)).toBe(false);
  });
});
