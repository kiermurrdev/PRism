import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-required";
import { testCredential } from "@/lib/vault/service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const result = await testCredential(authResult.user.id, id);
    return NextResponse.json(result);
  } catch (err: any) {
    if (err.message === "Credential not found or access denied") {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Credential not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { code: "SERVER_ERROR", message: err.message || "Test failed" },
      { status: 500 },
    );
  }
}
