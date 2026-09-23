import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { db } from "@/lib/db/client";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";
import type { Adapter } from "next-auth/adapters";
import { eq, and } from "drizzle-orm";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      avatarUrl?: string;
      githubLogin?: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    sub?: string;
    githubLogin?: string;
    githubAvatarUrl?: string;
  }
}

function generateUuid(): string {
  return crypto.randomUUID();
}

/*
 * Auth.js PostgreSQL adapter using Drizzle ORM.
 * Maps Auth.js models to our schema tables.
 */
const drizzleAdapter: Adapter = {
  async createUser(data) {
    const id = generateUuid();
    const now = new Date();
    await db.insert(users).values({
      id,
      email: data.email,
      name: data.name ?? null,
      image: data.image ?? null,
      githubLogin: null,
      githubId: null,
      createdAt: now,
      updatedAt: now,
    });
    return {
      id,
      name: data.name,
      email: data.email,
      image: data.image,
      emailVerified: data.emailVerified,
    };
  },

  async getUser(id) {
    const row = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (row.length === 0) return null;
    const u = row[0];
    return {
      id: u.id,
      name: u.name ?? undefined,
      email: u.email,
      image: u.image ?? undefined,
      emailVerified: null,
    };
  },

  async getUserByEmail(email) {
    const row = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (row.length === 0) return null;
    const u = row[0];
    return {
      id: u.id,
      name: u.name ?? undefined,
      email: u.email,
      image: u.image ?? undefined,
      emailVerified: null,
    };
  },

  async getUserByAccount({ providerAccountId, provider }) {
    const acc = await db
      .select({ userId: accounts.userId })
      .from(accounts)
      .where(
        and(
          eq(accounts.provider, provider),
          eq(accounts.providerAccountId, providerAccountId),
        ),
      )
      .limit(1);
    if (acc.length === 0) return null;
    const getUser = this?.getUser;
    if (!getUser) return null;
    return await getUser(acc[0].userId);
  },

  async updateUser(data) {
    const { id, ...updates } = data;
    const now = new Date();
    const setFields: Record<string, unknown> = { updatedAt: now };
    if (updates.name !== undefined) setFields.name = updates.name;
    if (updates.email !== undefined) setFields.email = updates.email;
    if (updates.image !== undefined) setFields.image = updates.image;
    if (Object.keys(setFields).length > 1) {
      await db.update(users).set(setFields).where(eq(users.id, id));
    }
    const row = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const u = row[0];
    return {
      id: u.id,
      name: u.name ?? undefined,
      email: u.email,
      image: u.image ?? undefined,
      emailVerified: null,
    };
  },

  async linkAccount(data) {
    await db.insert(accounts).values({
      userId: data.userId,
      type: data.type,
      provider: data.provider,
      providerAccountId: data.providerAccountId,
      refresh_token: data.refresh_token ? String(data.refresh_token) : null,
      access_token: data.access_token ? String(data.access_token) : null,
      expiresAt: data.expires_at ? Number(data.expires_at) : null,
      token_type: data.token_type ? String(data.token_type) : null,
      scope: data.scope ? String(data.scope) : null,
      id_token: data.id_token ? String(data.id_token) : null,
      session_state: data.session_state ? String(data.session_state) : null,
    });
    return data;
  },

  async unlinkAccount({ providerAccountId, provider }) {
    await db
      .delete(accounts)
      .where(
        and(
          eq(accounts.provider, provider),
          eq(accounts.providerAccountId, providerAccountId),
        ),
      );
  },

  async createSession(data) {
    await db.insert(sessions).values({
      sessionToken: data.sessionToken,
      userId: data.userId,
      expires: data.expires,
    });
    return {
      sessionToken: data.sessionToken,
      userId: data.userId,
      expires: data.expires,
    };
  },

  async getSessionAndUser(sessionToken) {
    const rows = await db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.sessionToken, sessionToken))
      .limit(1);
    if (rows.length === 0) return null;
    const { session, user } = rows[0];
    return {
      session: {
        id: session.id,
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires,
      },
      user: {
        id: user.id,
        name: user.name ?? undefined,
        email: user.email,
        image: user.image ?? undefined,
        emailVerified: null,
      },
    };
  },

  async updateSession(session) {
    const now = new Date();
    const setFields: Record<string, unknown> = { updatedAt: now };
    if (session.expires) setFields.expires = session.expires;
    await db.update(sessions).set(setFields).where(eq(sessions.sessionToken, session.sessionToken));
    return {
      sessionToken: session.sessionToken,
      userId: session.userId ?? "",
      expires: session.expires ?? now,
    };
  },

  async deleteSession(sessionToken) {
    await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
  },

  async createVerificationToken(data) {
    await db.insert(verificationTokens).values({
      identifier: data.identifier,
      token: data.token,
      expires: data.expires,
    });
    return data;
  },

  async useVerificationToken({ identifier, token }) {
    const row = await db
      .select()
      .from(verificationTokens)
      .where(and(eq(verificationTokens.identifier, identifier), eq(verificationTokens.token, token)))
      .limit(1);
    if (row.length === 0) return null;
    await db.delete(verificationTokens).where(
      and(eq(verificationTokens.identifier, identifier), eq(verificationTokens.token, token)),
    );
    return row[0];
  },
};

export const {
  handlers: { GET, POST },
  auth,
} = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  adapter: drizzleAdapter,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // On first sign-in, attach user id to token
      if (user) {
        token.sub = user.id;
      }
      // Store minimal profile info on token
      if (account?.provider === "github" && profile) {
        token.githubLogin = (profile as { login?: string }).login;
        token.githubAvatarUrl = (profile as { avatar_url?: string }).avatar_url;
      }
      return token;
    },
    async session({ session, token }) {
      // Inject user id into session so downstream code can use it
      session.user.id = token.sub as string;
      (session.user as { avatarUrl?: string; githubLogin?: string }).avatarUrl = token.githubAvatarUrl as string | undefined;
      (session.user as { avatarUrl?: string; githubLogin?: string }).githubLogin = token.githubLogin as string | undefined;
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Only allow relative redirects or redirects back to baseUrl
      if (url.startsWith("/") || url.startsWith(baseUrl)) {
        return url;
      }
      return baseUrl;
    },
  },
  secret: process.env.AUTH_SECRET,
});
