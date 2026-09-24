import { createHmac, timingSafeEqual } from "node:crypto";

interface RegistrationPermit {
  githubId: string;
  semesterId: string;
  groupName: string;
  kind: string;
  expires: number;
}

export function issueRegistrationPermit(input: Omit<RegistrationPermit, "expires">, secret: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ ...input, expires: now + 600_000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(`registration:${payload}`).digest("base64url")}`;
}

export function readRegistrationPermit(token: string, secret: string, now = Date.now()): RegistrationPermit | null {
  if (token.length > 1500) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", secret).update(`registration:${payload}`).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const result = JSON.parse(Buffer.from(payload, "base64url").toString()) as RegistrationPermit;
    return typeof result.expires === "number" && result.expires > now ? result : null;
  } catch { return null; }
}
