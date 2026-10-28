import type { Session } from "next-auth";

import { parseGitHubId } from "./options";

export interface GitHubSessionIdentity {
  authMethod?: undefined;
  githubId: string;
  githubLogin: string;
}

export interface ClassroomSessionIdentity {
  authMethod: "classroom";
  userId: string;
  rosterId: string;
  semesterId: string;
  email: string;
}
export type SessionIdentity = GitHubSessionIdentity | ClassroomSessionIdentity;

export interface StaffIdentity extends GitHubSessionIdentity {
  userId: string;
  role: "professor" | "administrator";
}

export interface StaffDirectory {
  findByGitHubId(githubId: string): Promise<{
    userId: string;
    githubId: string;
    githubLogin: string;
    role: string;
  } | null>;
}

export type SessionLoader = () => Promise<Session | null>;

export class AuthorizationError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function getSessionIdentity(session: Session | null): SessionIdentity | null {
  const user = session?.user;
  if (user?.authMethod === "classroom") {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (user.githubId !== undefined || user.githubLogin !== undefined ||
      ![user.userId, user.rosterId, user.semesterId].every(value => typeof value === "string" && uuid.test(value)) ||
      typeof user.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) || user.email !== user.email.trim().toLowerCase()) return null;
    return { authMethod: "classroom", userId: user.userId!, rosterId: user.rosterId!, semesterId: user.semesterId!, email: user.email };
  }
  if (user?.authMethod !== undefined || user?.userId !== undefined || user?.rosterId !== undefined || user?.semesterId !== undefined) return null;
  const githubId = parseGitHubId(user?.githubId);
  const githubLogin = session?.user?.githubLogin;

  if (
    !githubId ||
    typeof githubLogin !== "string" ||
    githubLogin.length === 0
  ) {
    return null;
  }

  return { githubId, githubLogin };
}

export function requireSessionIdentity(session: Session | null): SessionIdentity {
  const identity = getSessionIdentity(session);

  if (!identity) {
    throw new AuthorizationError("Authentication required", 401);
  }

  return identity;
}

export const databaseStaffDirectory: StaffDirectory = {
  async findByGitHubId(githubId) {
    const [{ db }, { staff, users }, { eq }] = await Promise.all([
      import("../db/client"),
      import("../db/schema"),
      import("drizzle-orm"),
    ]);
    const [row] = await db
      .select({
        userId: users.id,
        githubId: users.githubId,
        githubLogin: users.githubUsername,
        role: staff.role,
      })
      .from(staff)
      .innerJoin(users, eq(staff.userId, users.id))
      .where(eq(users.githubId, githubId))
      .limit(1);

    return row?.githubId && row.githubLogin ? { ...row, githubId: row.githubId, githubLogin: row.githubLogin } : null;
  },
};

export async function requireStaff(
  session: Session | null,
  directory: StaffDirectory = databaseStaffDirectory,
): Promise<StaffIdentity> {
  const identity = requireSessionIdentity(session);
  const permittedId = process.env.PROFESSOR_GITHUB_ID;
  if (identity.authMethod === "classroom" || !permittedId || identity.githubId !== permittedId) {
    throw new AuthorizationError("Staff access required", 403);
  }
  const staffMember = await directory.findByGitHubId(identity.githubId);

  if (
    !staffMember ||
    (staffMember.role !== "professor" && staffMember.role !== "administrator")
  ) {
    throw new AuthorizationError("Staff access required", 403);
  }

  return {
    ...identity,
    userId: staffMember.userId,
    role: staffMember.role,
  };
}

async function loadServerSession(): Promise<Session | null> {
  const [{ getServerSession }, { getAuthOptions }] = await Promise.all([
    import("next-auth"),
    import("./options"),
  ]);

  return getServerSession(getAuthOptions());
}

export async function getCurrentSession(
  loadSession: SessionLoader = loadServerSession,
): Promise<Session | null> {
  return loadSession();
}

export async function requireCurrentIdentity(
  loadSession: SessionLoader = loadServerSession,
): Promise<SessionIdentity> {
  return requireSessionIdentity(await loadSession());
}

export async function requireCurrentStaff(
  loadSession: SessionLoader = loadServerSession,
  directory: StaffDirectory = databaseStaffDirectory,
): Promise<StaffIdentity> {
  return requireStaff(await loadSession(), directory);
}
