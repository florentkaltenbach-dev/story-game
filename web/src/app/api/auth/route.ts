import { NextResponse } from "next/server";
import { createToken, verifyToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "mc_auth") {
      const mcSecret = process.env.MC_SECRET;
      if (!mcSecret) {
        return NextResponse.json(
          { error: "MC_SECRET not configured on server" },
          { status: 500 }
        );
      }
      if (body.secret !== mcSecret) {
        return NextResponse.json(
          { error: "Invalid secret" },
          { status: 401 }
        );
      }
      const token = createToken({ role: "mc" });
      return NextResponse.json({ token });
    }

    if (action === "refresh") {
      const ctx = verifyToken(body.token ?? "");
      if (!ctx) {
        return NextResponse.json(
          { error: "Invalid or expired token" },
          { status: 401 }
        );
      }
      const token = createToken({
        role: ctx.role,
        ...(ctx.playerId ? { playerId: ctx.playerId } : {}),
      });
      return NextResponse.json({ token });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[auth/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
