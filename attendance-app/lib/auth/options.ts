import type { AuthOptions, Profile, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GitHubProvider from "next-auth/providers/github";

import type { ServerEnv } from "../env";
import { getEnv } from "../env";

export type AuthEnvironment = Pick<
  ServerEnv,
  "GITHUB_ID" | "GITHUB_SECRET" | "NEXTAUTH_SECRET"
>;

export interface GitHubUserRecord {
  githubId: string;
  githubLogin: string;
  name: string | null;
}

interface AuthDependencies {
  production?: boolean;
  upsertUser?: (record: GitHubUserRecord) => Promise<void>;
}

interface GitHubIdentity {
  githubId: string;
  githubLogin: string;
}

export function parseGitHubId(value: unknown): string | null {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) {
      return null;
    }

    return String(value);
  }

  if (typeof value === "bigint") {
    return value >= BigInt(0) ? value.toString() : null;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  return BigInt(value).toString();
}

function readGitHubIdentity(profile: Profile | undefined): GitHubIdentity | null {
  if (!profile || !("id" in profile) || !("login" in profile)) {
    return null;
  }

  const githubId = parseGitHubId(profile.id);
  const githubLogin =
    typeof profile.login === "string" && profile.login.length > 0
      ? profile.login
      : null;

  if (!githubId || !githubLogin) {
    return null;
  }

  return { githubId, githubLogin };
}

function readProfileName(profile: Profile | undefined): string | null {
  return profile && typeof profile.name === "string" ? profile.name : null;
}

async function upsertDatabaseUser(record: GitHubUserRecord): Promise<void> {
  const [{ db }, { users }] = await Promise.all([
    import("../db/client"),
    import("../db/schema"),
  ]);

  await db
    .insert(users)
    .values({
      githubId: record.githubId,
      githubUsername: record.githubLogin,
      name: record.name,
    })
    .onConflictDoUpdate({
      target: users.githubId,
      set: {
        githubUsername: record.githubLogin,
        name: record.name,
        updatedAt: new Date(),
      },
    });
}

function copyProfileToToken(token: JWT, profile: Profile | undefined): JWT {
  if (!profile) {
    return token;
  }

  const identity = readGitHubIdentity(profile);

  if (!identity) {
    delete token.githubId;
    delete token.githubLogin;
    return token;
  }

  token.githubId = identity.githubId;
  token.githubLogin = identity.githubLogin;
  return token;
}

export function createAuthOptions(
  environment: AuthEnvironment,
  dependencies: AuthDependencies = {},
): AuthOptions {
  const production = dependencies.production ?? false;
  const upsertUser = dependencies.upsertUser ?? upsertDatabaseUser;

  return {
    secret: environment.NEXTAUTH_SECRET,
    providers: [
      GitHubProvider({
        clientId: environment.GITHUB_ID,
        clientSecret: environment.GITHUB_SECRET,
      }),
    ],
    session: { strategy: "jwt" },
    useSecureCookies: production,
    cookies: {
      sessionToken: {
        name: production
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
        options: {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: production,
        },
      },
    },
    callbacks: {
      async signIn({ user, profile }) {
        const identity = readGitHubIdentity(profile);

        if (!identity) {
          return false;
        }

        await upsertUser({
          ...identity,
          name: readUserName(user, profile),
        });
        return true;
      },
      async jwt({ token, profile }) {
        return copyProfileToToken(token, profile);
      },
      async session({ session, token }) {
        const githubId = parseGitHubId(token.githubId);
        const githubLogin =
          typeof token.githubLogin === "string" && token.githubLogin.length > 0
            ? token.githubLogin
            : null;

        if (session.user && githubId && githubLogin) {
          session.user.githubId = githubId;
          session.user.githubLogin = githubLogin;
        }

        return session;
      },
    },
  };
}

function readUserName(user: User, profile: Profile | undefined): string | null {
  return user.name ?? readProfileName(profile);
}

export function getAuthOptions(): AuthOptions {
  const environment = getEnv();

  return createAuthOptions(environment, {
    production: process.env.NODE_ENV === "production",
  });
}
