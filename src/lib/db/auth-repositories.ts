import { eq, and, desc, asc, like } from "drizzle-orm";
import { db } from "./client";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "./schema";
import type { NewUser, NewAccount, NewSession } from "./schema";

export class UserRepository {
  async findById(id: string) {
    return db.select().from(users).where(eq(users.id, id)).limit(1);
  }

  async findByEmail(email: string) {
    return db.select().from(users).where(eq(users.email, email)).limit(1);
  }

  async findByGithubId(githubId: bigint) {
    return db.select().from(users).where(eq(users.githubId, githubId)).limit(1);
  }

  async findByGithubLogin(login: string) {
    return db.select().from(users).where(eq(users.githubLogin, login)).limit(1);
  }

  async create(data: NewUser) {
    return db.insert(users).values(data).returning();
  }

  async update(id: string, data: Partial<Pick<NewUser, "email" | "name" | "githubLogin" | "githubId" | "image">>) {
    return db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
  }

  async upsertByGithub(githubId: bigint, data: Omit<NewUser, "id">) {
    const existing = await this.findByGithubId(githubId);
    if (existing.length > 0) {
      return [await this.update(existing[0].id, data)][0];
    }
    return (await this.create({ ...data, githubId }))[0];
  }
}

export class AccountRepository {
  async findByProvider(provider: string, providerAccountId: string) {
    return db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.provider, provider),
          eq(accounts.providerAccountId, providerAccountId),
        ),
      )
      .limit(1);
  }

  async create(data: NewAccount) {
    return db.insert(accounts).values(data).returning();
  }

  async deleteByProvider(provider: string, providerAccountId: string) {
    return db
      .delete(accounts)
      .where(
        and(
          eq(accounts.provider, provider),
          eq(accounts.providerAccountId, providerAccountId),
        ),
      );
  }
}

export class SessionRepository {
  async findBySessionToken(token: string) {
    return db
      .select({
        session: sessions,
        user: users,
      })
      .from(sessions)
      .leftJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.sessionToken, token))
      .limit(1);
  }

  async create(data: NewSession) {
    return db.insert(sessions).values(data).returning();
  }

  async deleteBySessionToken(token: string) {
    return db.delete(sessions).where(eq(sessions.sessionToken, token));
  }

  async deleteByUserId(userId: string) {
    return db.delete(sessions).where(eq(sessions.userId, userId));
  }
}

export class VerificationTokenRepository {
  async findByToken(token: string) {
    return db
      .select()
      .from(verificationTokens)
      .where(eq(verificationTokens.token, token))
      .limit(1);
  }

  async findByIdentifier(identifier: string) {
    return db
      .select()
      .from(verificationTokens)
      .where(eq(verificationTokens.identifier, identifier))
      .limit(1);
  }

  async create(identifier: string, token: string, expires: Date) {
    return db
      .insert(verificationTokens)
      .values({ identifier, token, expires })
      .returning();
  }

  async deleteByToken(token: string) {
    return db.delete(verificationTokens).where(eq(verificationTokens.token, token));
  }
}

export const userRepository = new UserRepository();
export const accountRepository = new AccountRepository();
export const sessionRepository = new SessionRepository();
export const verificationTokenRepository = new VerificationTokenRepository();
