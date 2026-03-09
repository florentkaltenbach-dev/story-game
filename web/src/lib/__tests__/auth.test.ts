import { describe, it, expect, beforeAll } from "vitest";
import {
  createToken,
  verifyToken,
  authenticateRequest,
  requireRole,
  _setSecretForTesting,
  type AuthContext,
} from "../auth";

beforeAll(() => {
  _setSecretForTesting("test-secret-for-unit-tests-only");
});

describe("createToken", () => {
  it("returns a two-part base64url string", () => {
    const token = createToken({ role: "mc" });
    const parts = token.split(".");
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it("embeds role in payload", () => {
    const token = createToken({ role: "mc" });
    const payload = JSON.parse(
      Buffer.from(token.split(".")[0], "base64url").toString()
    );
    expect(payload.role).toBe("mc");
  });

  it("embeds playerId for player tokens", () => {
    const token = createToken({ role: "player", playerId: "player-abc123" });
    const payload = JSON.parse(
      Buffer.from(token.split(".")[0], "base64url").toString()
    );
    expect(payload.playerId).toBe("player-abc123");
  });

  it("omits playerId for MC tokens", () => {
    const token = createToken({ role: "mc" });
    const payload = JSON.parse(
      Buffer.from(token.split(".")[0], "base64url").toString()
    );
    expect(payload.playerId).toBeUndefined();
  });

  it("includes iat and exp timestamps", () => {
    const before = Date.now();
    const token = createToken({ role: "mc" });
    const after = Date.now();
    const payload = JSON.parse(
      Buffer.from(token.split(".")[0], "base64url").toString()
    );
    expect(payload.iat).toBeGreaterThanOrEqual(before);
    expect(payload.iat).toBeLessThanOrEqual(after);
    expect(payload.exp).toBeGreaterThan(payload.iat);
    // 24h expiry
    expect(payload.exp - payload.iat).toBe(24 * 60 * 60 * 1000);
  });
});

describe("verifyToken", () => {
  it("returns AuthContext for a valid token", () => {
    const token = createToken({ role: "mc" });
    const ctx = verifyToken(token);
    expect(ctx).not.toBeNull();
    expect(ctx!.role).toBe("mc");
  });

  it("returns null for expired tokens", () => {
    // Create token then tamper with payload to set exp in the past
    const payload = {
      role: "mc",
      iat: Date.now() - 100000,
      exp: Date.now() - 50000,
    };
    // We can't create a properly signed expired token without access to internals,
    // so test via createToken and time manipulation isn't feasible.
    // Instead, test with a manually crafted but correctly signed token:
    const { createHmac } = require("crypto");
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = createHmac("sha256", "test-secret-for-unit-tests-only")
      .update(payloadStr)
      .digest()
      .toString("base64url");
    const token = `${payloadStr}.${sig}`;
    expect(verifyToken(token)).toBeNull();
  });

  it("returns null for tampered payload", () => {
    const token = createToken({ role: "mc" });
    const [payload, sig] = token.split(".");
    // Tamper with the payload
    const tampered = Buffer.from(
      JSON.stringify({ role: "mc", iat: Date.now(), exp: Date.now() + 999999999 })
    ).toString("base64url");
    expect(verifyToken(`${tampered}.${sig}`)).toBeNull();
  });

  it("returns null for tampered signature", () => {
    const token = createToken({ role: "mc" });
    const [payload] = token.split(".");
    expect(verifyToken(`${payload}.AAAA`)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(verifyToken("")).toBeNull();
  });

  it("returns null for malformed token", () => {
    expect(verifyToken("not.a.valid.token")).toBeNull();
    expect(verifyToken("just-one-part")).toBeNull();
  });

  it("preserves playerId in verified context", () => {
    const token = createToken({ role: "player", playerId: "player-xyz" });
    const ctx = verifyToken(token);
    expect(ctx!.playerId).toBe("player-xyz");
  });
});

describe("authenticateRequest", () => {
  function makeRequest(opts: { header?: string; queryToken?: string } = {}): Request {
    const url = new URL("http://localhost/api/test");
    if (opts.queryToken) url.searchParams.set("token", opts.queryToken);

    const headers: Record<string, string> = {};
    if (opts.header) headers["Authorization"] = opts.header;

    return new Request(url, { headers });
  }

  it("authenticates via Bearer header", () => {
    const token = createToken({ role: "mc" });
    const result = authenticateRequest(makeRequest({ header: `Bearer ${token}` }));
    expect(result).not.toBeInstanceOf(Response);
    expect((result as AuthContext).role).toBe("mc");
  });

  it("authenticates via query param", () => {
    const token = createToken({ role: "player", playerId: "p1" });
    const result = authenticateRequest(makeRequest({ queryToken: token }));
    expect(result).not.toBeInstanceOf(Response);
    expect((result as AuthContext).role).toBe("player");
    expect((result as AuthContext).playerId).toBe("p1");
  });

  it("prefers header over query param", () => {
    const mcToken = createToken({ role: "mc" });
    const playerToken = createToken({ role: "player", playerId: "p1" });
    const result = authenticateRequest(
      makeRequest({ header: `Bearer ${mcToken}`, queryToken: playerToken })
    );
    expect((result as AuthContext).role).toBe("mc");
  });

  it("returns 401 Response when no auth provided", () => {
    const result = authenticateRequest(makeRequest());
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it("returns 401 for invalid token in header", () => {
    const result = authenticateRequest(makeRequest({ header: "Bearer invalid.token" }));
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });
});

describe("requireRole", () => {
  it("returns true when role matches", () => {
    const ctx: AuthContext = { role: "mc", iat: Date.now(), exp: Date.now() + 1000 };
    expect(requireRole(ctx, "mc")).toBe(true);
  });

  it("returns false when role does not match", () => {
    const ctx: AuthContext = { role: "player", playerId: "p1", iat: Date.now(), exp: Date.now() + 1000 };
    expect(requireRole(ctx, "mc")).toBe(false);
  });
});
