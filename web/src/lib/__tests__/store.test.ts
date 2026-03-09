import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock memory.ts before importing store
vi.mock("../memory", () => ({
  appendMessage: vi.fn().mockResolvedValue(undefined),
  writeSessionSnapshot: vi.fn().mockResolvedValue(undefined),
  readSessionSnapshot: vi.fn().mockResolvedValue(null),
  readAllMessages: vi.fn().mockResolvedValue([]),
  archiveSessionMessages: vi.fn().mockResolvedValue(undefined),
  readMemoryLevel: vi.fn().mockResolvedValue({}),
}));

import {
  session,
  messages,
  invites,
  createInvite,
  validateInvite,
  claimInvite,
  addPlayer,
  updateSessionStatus,
  advanceAct,
  toggleKeeperAutoRespond,
  nextSession,
  _resetForTesting,
} from "../store";

beforeEach(() => {
  _resetForTesting();
});

describe("invites", () => {
  it("createInvite generates a new invite with uuid token", () => {
    const invite = createInvite();
    expect(invite.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(invite.status).toBe("new");
    expect(invites).toHaveLength(1);
  });

  it("validateInvite returns true for unused invite", () => {
    const invite = createInvite();
    expect(validateInvite(invite.token)).toBe(true);
  });

  it("validateInvite returns false for nonexistent token", () => {
    expect(validateInvite("bogus-token")).toBe(false);
  });

  it("claimInvite succeeds for valid invite", () => {
    const invite = createInvite();
    expect(claimInvite(invite.token, "Alice")).toBe(true);
    expect(invite.status).toBe("used");
    expect(invite.usedBy).toBe("Alice");
  });

  it("claimInvite fails for already-used invite", () => {
    const invite = createInvite();
    claimInvite(invite.token, "Alice");
    expect(claimInvite(invite.token, "Bob")).toBe(false);
  });

  it("claimInvite fails for nonexistent token", () => {
    expect(claimInvite("nonexistent", "Alice")).toBe(false);
  });

  it("claimInvite is atomic — no partial state on failure", () => {
    const invite = createInvite();
    claimInvite(invite.token, "Alice"); // consumes
    claimInvite(invite.token, "Bob");   // should fail
    expect(invite.usedBy).toBe("Alice"); // unchanged
  });
});

describe("players", () => {
  it("addPlayer creates a new player", () => {
    const player = addPlayer("Alice");
    expect(player.name).toBe("Alice");
    expect(player.id).toMatch(/^player-[0-9a-f]{8}$/);
    expect(session.players).toHaveLength(1);
  });

  it("addPlayer returns existing player for duplicate name", () => {
    const p1 = addPlayer("Alice");
    const p2 = addPlayer("Alice");
    expect(p1.id).toBe(p2.id);
    expect(session.players).toHaveLength(1);
  });

  it("addPlayer generates unique IDs", () => {
    const p1 = addPlayer("Alice");
    const p2 = addPlayer("Bob");
    expect(p1.id).not.toBe(p2.id);
  });
});

describe("session management", () => {
  it("updateSessionStatus changes status", async () => {
    await updateSessionStatus("active");
    expect(session.status).toBe("active");
  });

  it("advanceAct increments act", async () => {
    const act = await advanceAct();
    expect(act).toBe(2);
    expect(session.act).toBe(2);
  });

  it("advanceAct caps at 4", async () => {
    session.act = 4;
    const act = await advanceAct();
    expect(act).toBe(4);
  });

  it("toggleKeeperAutoRespond toggles", async () => {
    expect(session.keeperAutoRespond).toBe(false);
    const result = await toggleKeeperAutoRespond();
    expect(result).toBe(true);
    expect(session.keeperAutoRespond).toBe(true);
  });

  it("nextSession resets state", async () => {
    session.number = 1;
    session.act = 3;
    session.status = "ended";
    messages.push({
      id: "1",
      channel: "all",
      sender: { role: "system", name: "System" },
      content: "test",
      timestamp: Date.now(),
    });

    await nextSession();
    expect(session.number).toBe(2);
    expect(session.act).toBe(1);
    expect(session.status).toBe("lobby");
    expect(messages).toHaveLength(0);
  });
});
