import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Lightweight config used by the Edge proxy — no Prisma import
export const authConfig = {
  trustHost: true,
  providers: [Credentials({})],
  pages: { signIn: "/auth/signin" },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
