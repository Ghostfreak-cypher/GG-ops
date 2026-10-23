import { Types } from "mongoose";

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

/** Thrown by parseObjectIdOrThrow; caught by the API handler as HTTP 400. */
export class InvalidObjectIdError extends Error {
  readonly status = 400;
  constructor(value: unknown) {
    super(`Invalid ObjectId: ${String(value)}`);
    this.name = "InvalidObjectIdError";
  }
}

/**
 * Strict 24-char hex check. Note this is intentionally stricter than
 * Mongoose's own `Types.ObjectId.isValid`, which accepts any 12-char string.
 */
export function isValidObjectId(value: unknown): value is string {
  return typeof value === "string" && OBJECT_ID_RE.test(value);
}

/** Parse an untrusted value into an ObjectId, throwing InvalidObjectIdError (HTTP 400) if invalid. */
export function parseObjectIdOrThrow(value: unknown): Types.ObjectId {
  if (!isValidObjectId(value)) {
    throw new InvalidObjectIdError(value);
  }
  return new Types.ObjectId(value);
}
