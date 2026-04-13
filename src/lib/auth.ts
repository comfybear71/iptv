import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getDb } from "./mongodb";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "sfrench71@gmail.com";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const db = await getDb();
      const existingUser = await db
        .collection("users")
        .findOne({ email: user.email });

      if (!existingUser) {
        await db.collection("users").insertOne({
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.email === ADMIN_EMAIL ? "admin" : "user",
          createdAt: new Date(),
        });
      }
      return true;
    },
    async session({ session }) {
      if (session.user?.email) {
        const db = await getDb();
        const dbUser = await db
          .collection("users")
          .findOne({ email: session.user.email });
        if (dbUser) {
          (session.user as any).role = dbUser.role;
          (session.user as any).id = dbUser._id.toString();
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export function isAdmin(email: string | null | undefined): boolean {
  return email === ADMIN_EMAIL;
}
