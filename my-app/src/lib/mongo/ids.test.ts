import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { isValidObjectId, parseObjectIdOrThrow, InvalidObjectIdError } from "@/lib/mongo/ids";

describe("isValidObjectId", () => {
  it("returns true for a 24-char hex string", () => {
    expect(isValidObjectId("507f1f77bcf86cd799439011")).toBe(true);
  });

  it("returns false for a short non-hex string", () => {
    expect(isValidObjectId("not-an-id")).toBe(false);
  });

  // Mongoose's own isValid() accepts any 12-char string; we are stricter.
  it("returns false for a 12-char non-hex string", () => {
    expect(isValidObjectId("123456789012")).toBe(false);
  });

  it("returns false for non-string input", () => {
    expect(isValidObjectId(undefined)).toBe(false);
    expect(isValidObjectId(null)).toBe(false);
    expect(isValidObjectId(123)).toBe(false);
  });
});

describe("parseObjectIdOrThrow", () => {
  it("returns an ObjectId for a valid id string", () => {
    const id = parseObjectIdOrThrow("507f1f77bcf86cd799439011");
    expect(id).toBeInstanceOf(Types.ObjectId);
    expect(id.toString()).toBe("507f1f77bcf86cd799439011");
  });

  it("throws InvalidObjectIdError for an invalid id", () => {
    expect(() => parseObjectIdOrThrow("nope")).toThrow(InvalidObjectIdError);
  });

  it("thrown error has status 400", () => {
    try {
      parseObjectIdOrThrow("bad");
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidObjectIdError);
      expect((e as InvalidObjectIdError).status).toBe(400);
    }
  });

  it("thrown error message includes the invalid value", () => {
    expect(() => parseObjectIdOrThrow("abc")).toThrow(/Invalid ObjectId/);
  });
});

describe("InvalidObjectIdError", () => {
  it("is an instance of Error", () => {
    const err = new InvalidObjectIdError("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("has name InvalidObjectIdError", () => {
    const err = new InvalidObjectIdError("test");
    expect(err.name).toBe("InvalidObjectIdError");
  });

  it("has status 400", () => {
    const err = new InvalidObjectIdError("test");
    expect(err.status).toBe(400);
  });
});
