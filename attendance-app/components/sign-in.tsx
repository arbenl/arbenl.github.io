"use client";

import { signIn } from "next-auth/react";

interface SignInProps {
  callbackUrl?: string;
}

export function SignIn({ callbackUrl = "/student" }: SignInProps) {
  return (
    <button
      type="button"
      onClick={() => void signIn("github", { callbackUrl })}
    >
      Hyr me GitHub
    </button>
  );
}
