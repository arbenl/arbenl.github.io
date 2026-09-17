import { createHash, randomBytes } from "node:crypto";

const CHALLENGE_LIFETIME_MILLISECONDS = 40_000;

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
