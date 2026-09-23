import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createStateToken } from "@/lib/github/app/state-token";

/**
 * GET /api/github-install/link
 *
 * Requires authentication. Generates a signed state token that encodes
 * the user's ID and returns it so the client can build the GitHub
 * installation URL with the correct callback state.
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Sign in required" },
      { status: 401 }
    );
  }

  const result = createStateToken(session.user.id);

  if (!result.ok) {
    return NextResponse.json(
      { code: result.error.code, message: result.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ stateToken: result.token });
}
