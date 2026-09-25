import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-required";
import { listCredentials, createCredential } from "@/lib/vault/service";

export async function GET() {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const credentials = await listCredentials(authResult.user.id);
    return NextResponse.json({ credentials });
  } catch (err: any) {
    return NextResponse.json(
      { code: "SERVER_ERROR", message: err.message || "Failed to list credentials" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { provider, model, apiKey, label } = body;

    if (!provider || !model || !apiKey) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "provider, model, and apiKey are required" },
        { status: 400 },
      );
    }

    const credential = await createCredential(
      authResult.user.id,
      provider,
      model,
      apiKey,
      label,
    );

    return NextResponse.json({ credential }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { code: "SERVER_ERROR", message: err.message || "Failed to create credential" },
      { status: 500 },
    );
  }
}
