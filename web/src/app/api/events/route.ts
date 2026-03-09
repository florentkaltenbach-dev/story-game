import { NextRequest } from "next/server";
import { createSSEStream } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const role = request.nextUrl.searchParams.get("role") ?? undefined;
  const playerId = request.nextUrl.searchParams.get("playerId") ?? undefined;
  const stream = createSSEStream("all", request.signal, { role, playerId });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
