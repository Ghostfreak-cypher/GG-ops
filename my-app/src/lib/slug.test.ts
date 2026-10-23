import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("My Workspace")).toBe("my-workspace");
  });

  it("drops punctuation and trailing separators", () => {
    expect(slugify("Acme, Inc.")).toBe("acme-inc");
  });

  it("trims and collapses runs of separators", () => {
    expect(slugify("  spaced   out  ")).toBe("spaced-out");
    expect(slugify("Hello__World--Foo")).toBe("hello-world-foo");
  });

  it("returns an empty string when there is nothing slug-able", () => {
    expect(slugify("!!!")).toBe("");
  });
});
