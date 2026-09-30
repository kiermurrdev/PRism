import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { User } from "@/lib/db/schema";

/**
 * Require an authenticated user in an API route or server component.
 * Returns the user record or a JSON error response.
 */
export async function requireUser(): Promise<{ user: User } | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Sign in required" }, { status: 401 });
  }

  const rows = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (rows.length === 0) {
    return NextResponse.json({ code: "NOT_FOUND", message: "User not found" }, { status: 404 });
  }

  return { user: rows[0] };
}

/**
 * Require authentication and return the user id.
 * Throws for convenience in server components.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  return session.user.id;
}

/**
 * Check if a user owns a resource identified by userId.
 */
export function isOwner(sessionUserId: string, resourceUserId: string): boolean {
  return sessionUserId === resourceUserId;
}
