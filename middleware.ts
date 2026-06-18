import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Use only the lightweight config in middleware — no Prisma, no bcrypt.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
