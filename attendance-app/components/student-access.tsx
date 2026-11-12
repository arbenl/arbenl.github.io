"use client";
import { signOut } from "next-auth/react";
export function SwitchAccount() {
  return (
    <button
      type="button"
      onClick={() => void signOut({ callbackUrl: "/progress" })}
    >
      Dil / Ndërro llogarinë
    </button>
  );
}
