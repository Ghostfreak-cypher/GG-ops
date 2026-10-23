import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/modules/auth/auth.config";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { enqueue } from "@/lib/queue";
import { absoluteUrl } from "@/lib/urls";
import { logSecurityError, normalizeEmail, recordLoginEvent } from "@/lib/auth-security";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        await connectDB();
        const user = await User.findOne({ email: normalizeEmail(parsed.data.email) });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        void recordLoginEvent({ userId: String(user._id), provider: "credentials", request }).catch(
          (error) => logSecurityError("recordLoginEvent failed", error),
        );

        return {
          id: String(user._id),
          name: user.name,
          email: user.email,
          image: user.image ?? undefined,
          authVersion: user.authVersion ?? 0,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (!user.email) return true;
      await connectDB();

      const email = normalizeEmail(user.email);
      if (account?.provider === "google") {
        const existing = await User.findOne({ email }).select("_id authVersion").lean();
        if (!existing) {
          const created = await User.create({
            name: user.name ?? user.email,
            email,
            image: user.image ?? null,
            isActive: true,
            emailVerifiedAt: new Date(),
            authVersion: 0,
          });
          enqueue("welcome-email", {
            email,
            name: created.name,
            appUrl: absoluteUrl("/"),
          });
          user.id = String(created._id);
          user.authVersion = 0;
        } else {
          await User.updateOne(
            { _id: existing._id },
            { $set: { name: user.name ?? user.email, image: user.image ?? null, isActive: true } },
          );
          user.id = String(existing._id);
          user.authVersion = existing.authVersion ?? 0;
        }

        if (user.id) {
          void recordLoginEvent({ userId: user.id, provider: "google" }).catch((error) =>
            logSecurityError("recordLoginEvent failed", error),
          );
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        await connectDB();
        const dbUser = await User.findOne({ email: normalizeEmail(user.email) })
          .select("_id authVersion")
          .lean();
        if (dbUser) {
          token.id = String(dbUser._id);
          token.authVersion = dbUser.authVersion ?? 0;
        }
      }
      return token;
    },
  },
});
