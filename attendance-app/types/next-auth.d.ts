import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    authMethod?: "classroom";
    userId?: string;
    rosterId?: string;
    semesterId?: string;
  }
  interface Session {
    user: DefaultSession["user"] & {
      authMethod?: "classroom";
      userId?: string;
      rosterId?: string;
      semesterId?: string;
      githubId?: string;
      githubLogin?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    authMethod?: "classroom";
    userId?: string;
    rosterId?: string;
    semesterId?: string;
    githubId?: string;
    githubLogin?: string;
  }
}
