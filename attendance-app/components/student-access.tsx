"use client";
import { signOut } from "next-auth/react";
export function SwitchAccount({ callbackUrl = "/progress" }: { callbackUrl?: string } = {}) {
  return (
    <button
      type="button"
      onClick={() => void signOut({ callbackUrl })}
    >
      Dil / Ndërro llogarinë
    </button>
  );
}
