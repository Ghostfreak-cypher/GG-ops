import { describe, it, expect } from "vitest";
import {
  createWorkspaceSchema,
  inviteSchema,
  signUpSchema,
} from "@/modules/workspace/schemas";

describe("createWorkspaceSchema", () => {
  it("accepts a reasonable name", () => {
    expect(createWorkspaceSchema.safeParse({ name: "Acme" }).success).toBe(true);
  });
  it("rejects a too-short name", () => {
    expect(createWorkspaceSchema.safeParse({ name: "A" }).success).toBe(false);
  });
});

describe("inviteSchema", () => {
  it("accepts a valid email + assignable role", () => {
    expect(inviteSchema.safeParse({ email: "a@b.com", role: "MEMBER" }).success).toBe(true);
  });
  it("rejects MAINTAINER as an invitable role", () => {
    expect(inviteSchema.safeParse({ email: "a@b.com", role: "MAINTAINER" }).success).toBe(false);
  });
  it("rejects a malformed email", () => {
    expect(inviteSchema.safeParse({ email: "nope", role: "MEMBER" }).success).toBe(false);
  });
});

describe("signUpSchema", () => {
  it("accepts a valid signup", () => {
    const r = signUpSchema.safeParse({ name: "Jo", email: "a@b.com", password: "password123" });
    expect(r.success).toBe(true);
  });
  it("rejects a short password", () => {
    expect(
      signUpSchema.safeParse({ name: "Jo", email: "a@b.com", password: "short" }).success,
    ).toBe(false);
  });
});
