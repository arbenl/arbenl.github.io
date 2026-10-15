import { createHash, randomBytes } from "node:crypto";

import { CHECKIN_WINDOW_SECONDS } from "./policy";

const CHALLENGE_LIFETIME_MILLISECONDS = CHECKIN_WINDOW_SECONDS * 1_000;

export function createChallengeToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashChallengeToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

export function challengeExpiresAt(now: Date, sessionDeadline: Date): Date {
  return new Date(
    Math.min(
      now.getTime() + CHALLENGE_LIFETIME_MILLISECONDS,
      sessionDeadline.getTime(),
    ),
  );
}
