import type { AuthOptions, Profile, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";

import type { ServerEnv } from "../env";
import { getEnv } from "../env";
import { getSessionIdentity } from "./session";

export type AuthEnvironment = Pick<
  ServerEnv,
  "GITHUB_ID" | "GITHUB_SECRET" | "NEXTAUTH_SECRET"
>;

export interface GitHubUserRecord {
  githubId: string;
  githubLogin: string;
  name: string | null;
}

interface ClassroomRegistrationInput {
  token: string;
  email: string;
  firstName: string;
  lastName: string;
  studentId: string;
  groupName: string;
}
interface ClassroomUser extends User {
  authMethod: "classroom";
  semesterId: string;
  rosterId: string;
  email: string;
}
interface AuthDependencies {
  registerClassroomStudent?: (input: ClassroomRegistrationInput, ip: string) => Promise<ClassroomUser>;
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
      {
        ...CredentialsProvider({
        id: "classroom", name: "Classroom registration",
        credentials: { token: {}, email: {}, firstName: {}, lastName: {}, studentId: {}, groupName: {} },
        async authorize(credentials, request) {
          if (!credentials) return null;
          try {
            const register = dependencies.registerClassroomStudent ?? (await import("../attendance/classroom-registration")).registerClassroomStudent;
            const result = await register({ token: credentials.token, email: credentials.email, firstName: credentials.firstName, lastName: credentials.lastName, studentId: credentials.studentId, groupName: credentials.groupName }, request.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown");
            return { id: result.id, name: result.name, email: result.email, userId: result.id, authMethod: "classroom", rosterId: result.rosterId, semesterId: result.semesterId };
          } catch (error) {
            const code = error instanceof Error && "code" in error && typeof error.code === "string" && ["invalid_registration", "invalid_qr", "profile_conflict", "staff_forbidden", "rate_limited", "classroom_unavailable"].includes(error.code) ? error.code : "registration_failed";
            throw new Error(code);
          }
        },
        }),
        id: "classroom",
      },
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
      async signIn({ user, profile, account }) {
        if (account?.provider === "classroom") return getSessionIdentity({ expires: "", user })?.authMethod === "classroom";
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
      async jwt({ token, profile, user, account }) {
        if (account?.provider === "classroom") {
          const identity = getSessionIdentity({ expires: "", user });
          delete token.githubId;
          delete token.githubLogin;
          delete token.authMethod;
          delete token.userId;
          delete token.rosterId;
          delete token.semesterId;
          delete token.email;
          if (identity?.authMethod === "classroom") Object.assign(token, identity);
          return token;
        }
        if (profile || account?.provider === "github") {
          if (token.authMethod === "classroom") delete token.email;
          delete token.authMethod;
          delete token.userId;
          delete token.rosterId;
          delete token.semesterId;
        }
        return copyProfileToToken(token, profile);
      },
      async session({ session, token }) {
        if (session.user) {
          delete session.user.githubId;
          delete session.user.githubLogin;
          delete session.user.authMethod;
          delete session.user.userId;
          delete session.user.rosterId;
          delete session.user.semesterId;
        }
        const identity = getSessionIdentity({ expires: "", user: { ...token, email: token.email } });
        if (identity?.authMethod === "classroom" && session.user) {
          Object.assign(session.user, identity);
          return session;
        }
        if (!identity) return session;
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
