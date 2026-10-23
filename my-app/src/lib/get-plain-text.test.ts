import { describe, it, expect } from "vitest";
import { getPlainText } from "@/lib/get-plain-text";

describe("getPlainText", () => {
  it("strips tags and keeps mention labels", () => {
    const html =
      '<p><span class="mention" data-id="u1" data-type="mention">@Vansh</span> please review</p>';
    expect(getPlainText(html)).toBe("@Vansh please review");
  });

  it("drops an unterminated trailing tag from mid-tag truncation", () => {
    const truncated =
      '<p><span class="mention" data-id="u1" data-type="mention">@Vansh</span> <span class="mention" data-id="6a4671d2a4e1fdc';
    expect(getPlainText(truncated)).toBe("@Vansh");
  });

  it("turns paragraph boundaries into newlines", () => {
    expect(getPlainText("<p>one</p><p>two</p>")).toBe("one\ntwo");
  });

  it("turns <br> into a newline and collapses runs", () => {
    expect(getPlainText("<p>one<br><br>two</p>")).toBe("one\ntwo");
  });

  it("passes plain text through unchanged", () => {
    expect(getPlainText("no markup here")).toBe("no markup here");
  });
});
