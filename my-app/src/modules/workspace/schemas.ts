import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(50),
});

// MAINTAINER is intentionally excluded — you can't invite someone as maintainer.
export const inviteSchema = z.object({
  email: z.email(),
  role: z.enum(["ADMIN", "MEMBER", "GUEST"]),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  // Present when signing up from a workspace invite — triggers auto-join.
  inviteToken: z.string().optional(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
