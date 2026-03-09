import { NextRequest, NextResponse } from "next/server";
import {
  invites,
  createInvite,
  validateInvite,
  initializeStore,
} from "@/lib/store";

// GET /api/invites — list invites or validate a token
export async function GET(request: NextRequest) {
  try {
    await initializeStore();

    const token = request.nextUrl.searchParams.get("validate");
    if (token) {
      return NextResponse.json({ valid: validateInvite(token) });
    }

    return NextResponse.json(invites);
  } catch (err) {
    console.error("[invites/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/invites — generate a new invite
export async function POST() {
  try {
    await initializeStore();
    const invite = createInvite();
    return NextResponse.json(invite, { status: 201 });
  } catch (err) {
    console.error("[invites/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
