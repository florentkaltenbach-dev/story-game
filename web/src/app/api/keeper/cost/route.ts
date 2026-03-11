import { NextResponse } from "next/server";
import { authenticateRequest, requireRole } from "@/lib/auth";
import type { AuthContext } from "@/lib/auth";
import { RemoteKeeper } from "@/lib/keeper";

export async function GET(request: Request) {
  try {
    const auth = authenticateRequest(request);
    if (auth instanceof Response) return auth;
    if (!requireRole(auth as AuthContext, "mc")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const keeper = new RemoteKeeper();
    const cost = await keeper.getCost();
    return NextResponse.json(cost);
  } catch (err) {
    console.error("[keeper/cost/GET]", err);
    return NextResponse.json({ error: "Cost data unavailable" }, { status: 500 });
  }
}
