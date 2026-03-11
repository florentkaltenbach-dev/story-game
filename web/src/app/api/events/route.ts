import { NextRequest } from "next/server";
import { createSSEStream } from "@/lib/events";
import { authenticateRequest } from "@/lib/auth";
import type { AuthContext } from "@/lib/auth";
import { getPlayerGroupChannels } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Auth via ?token= query param (EventSource doesn't support headers)
  const auth = authenticateRequest(request);
  if (auth instanceof Response) return auth;
  const ctx = auth as AuthContext;

  // Build group membership set for SSE filtering
  const groupMembership = ctx.playerId
    ? new Set(getPlayerGroupChannels(ctx.playerId).map((c) => c.id))
    : undefined;

  const stream = createSSEStream("all", request.signal, {
    role: ctx.role,
    playerId: ctx.playerId,
    groupMembership,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
