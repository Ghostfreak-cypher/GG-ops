import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { env } from "@/lib/env";

/**
 * Edge-safe config: providers and callbacks that do NOT touch Mongoose.
 * `proxy.ts` instantiates NextAuth from this so the proxy bundle stays lean.
 * The Credentials provider + DB-aware callbacks are added in `lib/auth.ts`.
 */
export const authConfig = {
  providers: [
    Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET }),
  ],
  pages: { signIn: "/sign-in" },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
    session({ session, token }) {
      if (session.user) {
        if (token.id) session.user.id = token.id as string;
        session.user.authVersion = (token.authVersion as number | undefined) ?? 0;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
