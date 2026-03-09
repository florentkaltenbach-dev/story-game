import { NextRequest, NextResponse } from "next/server";
import {
  invites,
  createInvite,
  validateInvite,
  initializeStore,
} from "@/lib/store";
import { authenticateRequest, requireRole } from "@/lib/auth";
import type { AuthContext } from "@/lib/auth";

// GET /api/invites — list invites (MC auth) or validate a token (public)
export async function GET(request: NextRequest) {
  try {
    await initializeStore();

    // Validate is public (needed before join)
    const token = request.nextUrl.searchParams.get("validate");
    if (token) {
      return NextResponse.json({ valid: validateInvite(token) });
    }

    // List requires MC auth
    const auth = authenticateRequest(request);
    if (auth instanceof Response) return auth;
    if (!requireRole(auth as AuthContext, "mc")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(invites);
  } catch (err) {
    console.error("[invites/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/invites — generate a new invite (MC-only)
export async function POST(request: Request) {
  try {
    await initializeStore();

    const auth = authenticateRequest(request);
    if (auth instanceof Response) return auth;
    if (!requireRole(auth as AuthContext, "mc")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invite = createInvite();
    return NextResponse.json(invite, { status: 201 });
  } catch (err) {
    console.error("[invites/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
