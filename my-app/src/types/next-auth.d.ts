import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
    authVersion?: number;
  }

  interface Session {
    user: {
      id: string;
      authVersion?: number;
      emailVerified?: boolean;
      hasPassword?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    authVersion?: number;
  }
}
