import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-required";
import {
  getCredentialSummary,
  updateCredential,
  deleteCredential,
} from "@/lib/vault/service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const credential = await getCredentialSummary(authResult.user.id, id);

    if (!credential) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Credential not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ credential });
  } catch (err: any) {
    return NextResponse.json(
      { code: "SERVER_ERROR", message: err.message || "Failed to get credential" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const body = await request.json();
    const { label, model } = body;

    const credential = await updateCredential(authResult.user.id, id, {
      label,
      model,
    });

    return NextResponse.json({ credential });
  } catch (err: any) {
    if (err.message === "Credential not found or access denied") {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Credential not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { code: "SERVER_ERROR", message: err.message || "Failed to update credential" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const result = await deleteCredential(authResult.user.id, id);

    if (!result.success) {
      return NextResponse.json(
        { code: "CONFLICT", message: result.message },
        { status: 409 },
      );
    }

    return NextResponse.json({ deleted: true });
  } catch (err: any) {
    if (err.message === "Credential not found or access denied") {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Credential not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { code: "SERVER_ERROR", message: err.message || "Failed to delete credential" },
      { status: 500 },
    );
  }
}
