import type { Session } from "next-auth";

import { parseGitHubId } from "../../../../lib/auth/options";
import {
  getCurrentSession,
  getSessionIdentity,
} from "../../../../lib/auth/session";
import { getEnv } from "../../../../lib/env";

export interface BootstrapTransaction {
  findUserByGithubId(
    githubId: string,
  ): Promise<{ id: string; githubId: string } | null>;
  claimCompletion(userId: string): Promise<boolean>;
  addProfessor(userId: string): Promise<void>;
  recordBootstrapAudit(actorUserId: string, subjectId: string): Promise<void>;
}

export interface BootstrapRepository {
  transaction<T>(
    work: (transaction: BootstrapTransaction) => Promise<T>,
  ): Promise<T>;
}

export type BootstrapResult =
  | { status: "created"; userId: string }
  | { status: "already-completed" }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "missing-user" };

export async function bootstrapProfessor(
  session: Session | null,
  configuredProfessorId: string,
  repository: BootstrapRepository,
): Promise<BootstrapResult> {
  const identity = getSessionIdentity(session);

  if (!identity) {
    return { status: "unauthenticated" };
  }

  const professorId = parseGitHubId(configuredProfessorId);

  if (!professorId || identity.githubId !== professorId) {
    return { status: "forbidden" };
  }

  return repository.transaction(async (transaction) => {
    const user = await transaction.findUserByGithubId(identity.githubId);

    if (!user) {
      return { status: "missing-user" };
    }

    const claimed = await transaction.claimCompletion(user.id);

    if (!claimed) {
      return { status: "already-completed" };
    }

    await transaction.addProfessor(user.id);
    await transaction.recordBootstrapAudit(user.id, user.id);

    return { status: "created", userId: user.id };
  });
}

export const databaseBootstrapRepository: BootstrapRepository = {
  async transaction(work) {
    const [{ db }, { auditLog, bootstrapState, staff, users }, { eq }] =
      await Promise.all([
        import("../../../../lib/db/client"),
        import("../../../../lib/db/schema"),
        import("drizzle-orm"),
      ]);

    return db.transaction(async (databaseTransaction) =>
      work({
        async findUserByGithubId(githubId) {
          const [user] = await databaseTransaction
            .select({ id: users.id, githubId: users.githubId })
            .from(users)
            .where(eq(users.githubId, githubId))
            .limit(1);

          return user ?? null;
        },
        async claimCompletion(userId) {
          const marker = await databaseTransaction
            .insert(bootstrapState)
            .values({ completedBy: userId })
            .onConflictDoNothing({ target: bootstrapState.singleton })
            .returning({ singleton: bootstrapState.singleton });

          return marker.length === 1;
        },
        async addProfessor(userId) {
          await databaseTransaction
            .insert(staff)
            .values({
              userId,
              role: "professor",
              addedBy: userId,
            })
            .onConflictDoNothing({ target: staff.userId });
        },
        async recordBootstrapAudit(actorUserId, subjectId) {
          await databaseTransaction.insert(auditLog).values({
            actorUserId,
            action: "staff.bootstrap",
            subjectType: "staff",
            subjectId,
            reason: "Initial professor bootstrap",
            metadata: {},
          });
        },
      }),
    );
  },
};

export async function POST(): Promise<Response> {
  try {
    const [session, environment] = await Promise.all([
      getCurrentSession(),
      Promise.resolve(getEnv()),
    ]);
    const result = await bootstrapProfessor(
      session,
      environment.PROFESSOR_GITHUB_ID,
      databaseBootstrapRepository,
    );

    switch (result.status) {
      case "created":
        return Response.json(result, { status: 201 });
      case "already-completed":
        return Response.json(result);
      case "unauthenticated":
        return Response.json(result, { status: 401 });
      case "forbidden":
        return Response.json(result, { status: 403 });
      case "missing-user":
        return Response.json(result, { status: 409 });
    }
  } catch {
    return Response.json({ status: "error" }, { status: 500 });
  }
}
