import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  challengeExpiresAt,
  createChallengeToken,
  hashChallengeToken,
} from "../lib/attendance/challenge";
import {
  getRetryDelaySeconds,
  reconcileLiveSnapshot,
  type LiveSnapshot,
} from "../lib/attendance/live-state";
import {
  maskDisplayName,
  normalizeAlbanianName,
  normalizeStudentId,
} from "../lib/attendance/normalize";

describe("attendance identity normalization", () => {
  it("normalizes Albanian names without discarding diacritics", () => {
    expect(normalizeAlbanianName("  ËNDRRA\t  ÇELA  ")).toBe("ëndrra çela");
    expect(normalizeAlbanianName("Endrra Cela")).not.toBe(
      normalizeAlbanianName("Ëndrra Çela"),
    );
  });

  it("trims Student IDs without changing their contents", () => {
    expect(normalizeStudentId("  Ab-001  ")).toBe("Ab-001");
  });

  it("masks a full name as the given name and surname initial", () => {
    expect(maskDisplayName("  Ëndrra   Çela ")).toBe("Ëndrra Ç.");
    expect(maskDisplayName("Arben")).toBe("Arben");
  });
});

describe("attendance challenge rules", () => {
  it("creates a random token encoded as exactly 64 hexadecimal characters", () => {
    const first = createChallengeToken();
    const second = createChallengeToken();

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toMatch(/^[0-9a-f]{64}$/);
    expect(second).not.toBe(first);
  });

  it("hashes tokens with SHA-256", () => {
    const token = "attendance-token";
    const expected = createHash("sha256").update(token).digest("hex");

    expect(hashChallengeToken(token).toString("hex")).toBe(expected);
  });

  it("expires a challenge at five minutes or the session deadline", () => {
    const now = new Date("2026-09-17T10:00:00.000Z");
    const sessionDeadline = new Date("2026-09-17T10:10:00.000Z");

    expect(challengeExpiresAt(now, sessionDeadline)).toEqual(
      new Date("2026-09-17T10:05:00.000Z"),
    );
  });

  it("caps challenge expiry at the session deadline", () => {
    const now = new Date("2026-09-17T10:00:00.000Z");
    const sessionDeadline = new Date("2026-09-17T10:00:12.345Z");

    expect(challengeExpiresAt(now, sessionDeadline)).toEqual(sessionDeadline);
  });
});

describe("live projector state rules", () => {
  it("retries after 1, 2, 4, 5 and then 5 seconds", () => {
    expect([1, 2, 3, 4, 5].map(getRetryDelaySeconds)).toEqual([
      1, 2, 4, 5, 5,
    ]);
  });

  it("replaces the full snapshot and detects only newly added roster entries", () => {
    const previous: LiveSnapshot = {
      sessionId: "session-1",
      state: "open",
      serverTime: "2026-09-17T10:00:00.000Z",
      checkinEndsAt: "2026-09-17T10:02:00.000Z",
      entries: [
        {
          rosterId: "student-a",
          displayName: "Arta K.",
          recordedAt: "2026-09-17T10:00:01.000Z",
        },
        {
          rosterId: "removed-by-correction",
          displayName: "Blerim H.",
          recordedAt: "2026-09-17T10:00:02.000Z",
        },
      ],
      total: 2,
    };
    const incoming: LiveSnapshot = {
      ...previous,
      serverTime: "2026-09-17T10:00:03.000Z",
      entries: [
        {
          rosterId: "student-a",
          displayName: "Arta K.",
          recordedAt: "2026-09-17T10:00:01.000Z",
        },
        {
          rosterId: "student-c",
          displayName: "Çlirim D.",
          recordedAt: "2026-09-17T10:00:03.000Z",
        },
      ],
      total: 2,
    };

    const result = reconcileLiveSnapshot(previous, incoming);

    expect(result.snapshot).toBe(incoming);
    expect(result.snapshot.entries.map(({ rosterId }) => rosterId)).toEqual([
      "student-a",
      "student-c",
    ]);
    expect(result.newRosterIds).toEqual(["student-c"]);
  });
});
