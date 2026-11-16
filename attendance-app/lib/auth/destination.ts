/** NextAuth can supply either an absolute same-origin URL or a relative path. */
export function signInDestination(value: unknown, origin: string): string {
  if (typeof value !== "string" || /[\\\x00-\x20]|%5c|%0[ad]/i.test(value)) return "/progress";
  try {
    const base = new URL(origin);
    const url = new URL(value, base);
    if (url.origin !== base.origin || !value.startsWith("/") && !value.startsWith(base.origin + "/")) return "/progress";
    if (url.pathname === "/signin" || url.pathname.startsWith("/api/auth/")) return "/progress";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/progress";
  }
}
