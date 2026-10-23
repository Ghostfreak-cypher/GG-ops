import { describe, it, expect } from "vitest";
import { createAttachmentSchema } from "@/modules/attachment/schemas";

describe("createAttachmentSchema", () => {
  it("accepts a file name + url", () => {
    expect(
      createAttachmentSchema.safeParse({
        fileName: "spec.pdf",
        fileUrl: "https://example.com/spec.pdf",
      }).success,
    ).toBe(true);
  });

  it("accepts provider upload metadata", () => {
    expect(
      createAttachmentSchema.safeParse({
        fileName: "spec.pdf",
        fileUrl: "https://example.com/spec.pdf",
        mimeType: "application/pdf",
        fileSize: 1234,
        storageKey: "uploads/spec.pdf",
      }).success,
    ).toBe(true);
  });

  it("rejects a non-url", () => {
    expect(
      createAttachmentSchema.safeParse({ fileName: "x", fileUrl: "not a url" }).success,
    ).toBe(false);
  });

  it("rejects an empty file name", () => {
    expect(
      createAttachmentSchema.safeParse({ fileName: "", fileUrl: "https://x.com/a" }).success,
    ).toBe(false);
  });
});
