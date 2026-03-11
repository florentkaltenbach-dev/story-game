import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// === Types ===

export interface AuthContext {
  role: "mc" | "player";
  playerId?: string;
  iat: number;
  exp: number;
}

// === Secret management ===

let _secret: string | null = null;

function getSecret(): string {
  if (_secret) return _secret;
  _secret = process.env.CEREMONY_TOKEN_SECRET || randomBytes(32).toString("hex");
  return _secret;
}

// Exposed for testing only
export function _setSecretForTesting(secret: string): void {
  _secret = secret;
}

// === Token creation & verification ===

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function base64urlEncode(str: string): string {
  return Buffer.from(str, "utf-8").toString("base64url");
}

function base64urlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf-8");
}

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function createToken(opts: { role: "mc" | "player"; playerId?: string }): string {
  const now = Date.now();
  const payload: AuthContext = {
    role: opts.role,
    ...(opts.playerId ? { playerId: opts.playerId } : {}),
    iat: now,
    exp: now + TOKEN_EXPIRY_MS,
  };

  const payloadStr = base64urlEncode(JSON.stringify(payload));
  const sig = base64url(
    createHmac("sha256", getSecret()).update(payloadStr).digest()
  );

  return `${payloadStr}.${sig}`;
}

export function verifyToken(token: string): AuthContext | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadStr, sig] = parts;

  const expectedSig = base64url(
    createHmac("sha256", getSecret()).update(payloadStr).digest()
  );

  // Timing-safe comparison
  const sigBuf = Buffer.from(sig, "base64url");
  const expectedBuf = Buffer.from(expectedSig, "base64url");
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(base64urlDecode(payloadStr)) as AuthContext;

    // Check expiry
    if (payload.exp < Date.now()) return null;

    // Validate shape
    if (payload.role !== "mc" && payload.role !== "player") return null;
    if (typeof payload.iat !== "number" || typeof payload.exp !== "number") return null;

    return payload;
  } catch {
    return null;
  }
}

// === Request authentication ===

export function authenticateRequest(request: Request): AuthContext | Response {
  // Try custom header first (avoids gateway auth interception)
  const customToken = request.headers.get("X-Ceremony-Token");
  if (customToken) {
    const ctx = verifyToken(customToken);
    if (ctx) return ctx;
  }

  // Fallback: Authorization header
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const ctx = verifyToken(token);
    if (ctx) return ctx;
  }

  // Try ?token= query param (for SSE)
  const url = new URL(request.url);
  const tokenParam = url.searchParams.get("token");
  if (tokenParam) {
    const ctx = verifyToken(tokenParam);
    if (ctx) return ctx;
  }

  return new Response(JSON.stringify({ error: "Authentication required" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export function requireRole(ctx: AuthContext, role: "mc" | "player"): boolean {
  return ctx.role === role;
}
