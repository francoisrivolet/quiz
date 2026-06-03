import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export const { auth: proxy } = NextAuth(authConfig);

export const config = {
  matcher: ["/admin/:path*"],
};
