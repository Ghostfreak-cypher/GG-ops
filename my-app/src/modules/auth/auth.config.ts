import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Edge-safe config: providers and callbacks that do NOT touch Mongoose.
 * `proxy.ts` instantiates NextAuth from this so the proxy bundle stays lean.
 * The Credentials provider + DB-aware callbacks are added in `lib/auth.ts`.
 *
 * Google reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET itself (Auth.js v5 env inference), so this
 * module reads no env when imported. `next build` imports it while collecting page data, and
 * reading `env` here tripped lib/env.ts's production check and failed every CI build.
 */
export const authConfig = {
  providers: [Google],
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
