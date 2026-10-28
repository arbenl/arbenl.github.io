import type { Profile, Session } from "next-auth";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAuthOptions, parseGitHubId } from "../lib/auth/options";
import {
  AuthorizationError,
  getSessionIdentity,
  requireSessionIdentity,
  requireStaff,
  type StaffDirectory,
} from "../lib/auth/session";
import {
  bootstrapProfessor,
  type BootstrapRepository,
  type BootstrapResult,
  type BootstrapTransaction,
} from "../app/api/admin/bootstrap/route";

const authEnvironment = {
  GITHUB_ID: "github-client-id",
  GITHUB_SECRET: "github-client-secret",
  NEXTAUTH_SECRET: "signed-session-secret",
};

function sessionFor(
  githubId: string,
  githubLogin = "arbenl",
): Session {
  return {
    expires: "2099-01-01T00:00:00.000Z",
    user: {
      githubId,
      githubLogin,
    },
  };
}

function callbackArguments<T extends (...arguments_: never[]) => unknown>(
  _callback: T,
  arguments_: Parameters<T>[0],
): Parameters<T>[0] {
  return arguments_;
}

class MemoryBootstrapRepository implements BootstrapRepository {
  completed = false;
  staff = new Set<string>();
  auditEntries: Array<{ actorUserId: string; subjectId: string }> = [];
  transactionCount = 0;
  user = {
    id: "00000000-0000-4000-8000-000000000001",
    githubId: "42",
  };

  async transaction<T>(work: (transaction: BootstrapTransaction) => Promise<T>) {
    this.transactionCount += 1;

    return work({
      findUserByGithubId: async (githubId) =>
        githubId === this.user.githubId ? this.user : null,
      claimCompletion: async () => {
        if (this.completed) {
          return false;
        }

        this.completed = true;
        return true;
      },
      addProfessor: async (userId) => {
        this.staff.add(userId);
      },
      recordBootstrapAudit: async (actorUserId, subjectId) => {
        this.auditEntries.push({ actorUserId, subjectId });
      },
    });
  }
}

describe("GitHub session identity", () => {
  it.each([
    [42, "42"],
    ["00042", "42"],
    [BigInt("9007199254740991"), "9007199254740991"],
  ])("parses the numeric GitHub ID %s", (value, expected) => {
    expect(parseGitHubId(value)).toBe(expected);
  });

  it.each([undefined, null, "", "42x", -1, 4.2, Number.MAX_SAFE_INTEGER + 1])(
    "rejects the malformed GitHub ID %s",
    (value) => {
      expect(parseGitHubId(value)).toBeNull();
    },
  );

  it("extracts the immutable ID and display login from a valid session", () => {
    expect(getSessionIdentity(sessionFor("42", "professor-renamed"))).toEqual({
      githubId: "42",
      githubLogin: "professor-renamed",
    });
  });

  it("does not treat a GitHub username as session identity", () => {
    expect(
      getSessionIdentity({
        expires: "2099-01-01T00:00:00.000Z",
        user: { githubLogin: "arbenl" },
      } as Session),
    ).toBeNull();
  });

  it("denies a request without a valid server session", () => {
    expect(() => requireSessionIdentity(null)).toThrowError(
      new AuthorizationError("Authentication required", 401),
    );
  });
});

describe("Auth.js policy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses signed JWT sessions and a secure production session cookie", () => {
    const options = createAuthOptions(authEnvironment, {
      production: true,
      upsertUser: vi.fn(),
    });

    expect(options.session?.strategy).toBe("jwt");
    expect(options.secret).toBe(authEnvironment.NEXTAUTH_SECRET);
    expect(options.cookies?.sessionToken).toEqual({
      name: "__Secure-next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
      },
    });
  });

  it("copies the GitHub ID and login into the JWT and session", async () => {
    const options = createAuthOptions(authEnvironment, {
      production: false,
      upsertUser: vi.fn(),
    });
    const jwtCallback = options.callbacks?.jwt;
    const sessionCallback = options.callbacks?.session;

    expect(jwtCallback).toBeTypeOf("function");
    expect(sessionCallback).toBeTypeOf("function");

    if (!jwtCallback || !sessionCallback) {
      throw new Error("Auth callbacks are required");
    }

    const token = await jwtCallback(
      callbackArguments(jwtCallback, {
        token: {},
        account: null,
        user: { id: "provider-user" },
        profile: { id: 42, login: "arbenl" } as Profile,
        trigger: "signIn",
      }),
    );
    const session = await sessionCallback(
      callbackArguments(sessionCallback, {
        session: {
          expires: "2099-01-01T00:00:00.000Z",
          user: { name: "Professor" },
        },
        token,
        user: {
          id: "adapter-user",
          email: "professor@example.test",
          emailVerified: null,
        },
        newSession: undefined,
        trigger: "update",
      }),
    );

    expect(token).toMatchObject({ githubId: "42", githubLogin: "arbenl" });
    expect(session.user).toMatchObject({
      githubId: "42",
      githubLogin: "arbenl",
    });
  });

  it("upserts only durable GitHub identity fields on sign-in", async () => {
    const records: unknown[] = [];
    const options = createAuthOptions(authEnvironment, {
      production: false,
      upsertUser: async (record) => {
        records.push(record);
      },
    });
    const signInCallback = options.callbacks?.signIn;

    if (!signInCallback) {
      throw new Error("The sign-in callback is required");
    }

    const accepted = await signInCallback(
      callbackArguments(signInCallback, {
        user: { id: "provider-user", name: "Professor Name" },
        account: {
          access_token: "must-not-be-persisted",
          provider: "github",
          providerAccountId: "42",
          type: "oauth",
        },
        profile: {
          id: 42,
          login: "arbenl",
          name: "GitHub Name",
        } as Profile,
      }),
    );

    expect(accepted).toBe(true);
    expect(records).toEqual([
      {
        githubId: "42",
        githubLogin: "arbenl",
        name: "Professor Name",
      },
    ]);
    expect(JSON.stringify(records)).not.toContain("must-not-be-persisted");
  });
});

describe("professor bootstrap", () => {
  it("does not enter a transaction for an unauthenticated request", async () => {
    const repository = new MemoryBootstrapRepository();

    expect(await bootstrapProfessor(null, "42", repository)).toEqual({
      status: "unauthenticated",
    } satisfies BootstrapResult);
    expect(repository.transactionCount).toBe(0);
  });

  it("authorizes only the configured immutable GitHub ID", async () => {
    const repository = new MemoryBootstrapRepository();

    expect(
      await bootstrapProfessor(sessionFor("7", "arbenl"), "42", repository),
    ).toEqual({ status: "forbidden" } satisfies BootstrapResult);
    expect(repository.transactionCount).toBe(0);
    expect(repository.staff).toHaveLength(0);
  });

  it("adds the matching internal user, closes bootstrap and audits atomically", async () => {
    const repository = new MemoryBootstrapRepository();

    expect(
      await bootstrapProfessor(sessionFor("42"), "00042", repository),
    ).toEqual({
      status: "created",
      userId: repository.user.id,
    } satisfies BootstrapResult);
    expect(repository.completed).toBe(true);
    expect(repository.staff).toEqual(new Set([repository.user.id]));
    expect(repository.auditEntries).toEqual([
      { actorUserId: repository.user.id, subjectId: repository.user.id },
    ]);
  });

  it("keeps bootstrap permanently closed after the staff row is removed", async () => {
    const repository = new MemoryBootstrapRepository();

    await bootstrapProfessor(sessionFor("42"), "42", repository);
    repository.staff.clear();

    expect(
      await bootstrapProfessor(sessionFor("42"), "42", repository),
    ).toEqual({ status: "already-completed" } satisfies BootstrapResult);
    expect(repository.staff).toHaveLength(0);
    expect(repository.auditEntries).toHaveLength(1);
  });
});

describe("ongoing staff authorization", () => {
  it("denies an environment-matching professor who has no staff row", async () => {
    const previousProfessorId = process.env.PROFESSOR_GITHUB_ID;
    process.env.PROFESSOR_GITHUB_ID = "42";
    const lookedUpIds: string[] = [];
    const directory: StaffDirectory = {
      findByGitHubId: async (githubId) => {
        lookedUpIds.push(githubId);
        return null;
      },
    };

    try {
      await expect(requireStaff(sessionFor("42"), directory)).rejects.toEqual(
        new AuthorizationError("Staff access required", 403),
      );
      expect(lookedUpIds).toEqual(["42"]);
    } finally {
      if (previousProfessorId === undefined) {
        delete process.env.PROFESSOR_GITHUB_ID;
      } else {
        process.env.PROFESSOR_GITHUB_ID = previousProfessorId;
      }
    }
  });

  it("denies a staff member whose GitHub ID differs from the configured professor", async () => {
    const previousProfessorId = process.env.PROFESSOR_GITHUB_ID;
    process.env.PROFESSOR_GITHUB_ID = "999";
    const directory: StaffDirectory = {
      findByGitHubId: async (githubId) => ({
        userId: "00000000-0000-4000-8000-000000000042",
        githubId,
        githubLogin: "renamed-professor",
        role: "administrator",
      }),
    };

    try {
      await expect(
        requireStaff(sessionFor("42", "renamed-professor"), directory),
      ).rejects.toEqual(new AuthorizationError("Staff access required", 403));
    } finally {
      if (previousProfessorId === undefined) {
        delete process.env.PROFESSOR_GITHUB_ID;
      } else {
        process.env.PROFESSOR_GITHUB_ID = previousProfessorId;
      }
    }
  });
});

const classroomUser = {
  id: "00000000-0000-4000-8000-000000000020",
  userId: "00000000-0000-4000-8000-000000000020",
  rosterId: "00000000-0000-4000-8000-000000000021",
  semesterId: "00000000-0000-4000-8000-000000000022",
  email: "student@example.test", name: "Student Name", authMethod: "classroom" as const,
};
function classroomSession(): Session {
  return { expires: "2099-01-01", user: { ...classroomUser } };
}
describe("classroom identities", () => {
  it("accepts complete scoped identities and rejects mixed claims", () => {
    expect(getSessionIdentity(classroomSession())).toMatchObject({ authMethod: "classroom", userId: classroomUser.id });
    expect(getSessionIdentity({ ...classroomSession(), user: { ...classroomUser, githubId: "42", githubLogin: "professor" } })).toBeNull();
    expect(getSessionIdentity({ ...classroomSession(), user: { ...classroomUser, rosterId: "invalid" } })).toBeNull();
    expect(getSessionIdentity({ ...sessionFor("42"), user: { githubId: "42", githubLogin: "staff", semesterId: classroomUser.semesterId } })).toBeNull();
  });
  it("rejects classroom staff and bootstrap without database lookup", async () => {
    const directory = { findByGitHubId: vi.fn() };
    await expect(requireStaff(classroomSession(), directory)).rejects.toMatchObject({ status: 403 });
    expect(directory.findByGitHubId).not.toHaveBeenCalled();
    const repository = new MemoryBootstrapRepository();
    expect(await bootstrapProfessor(classroomSession(), "42", repository)).toEqual({ status: "forbidden" });
    expect(repository.transactionCount).toBe(0);
  });
  it("delegates credentials and first forwarded IP without client authority claims", async () => {
    const registerClassroomStudent = vi.fn().mockResolvedValue(classroomUser);
    const options = createAuthOptions(authEnvironment, { registerClassroomStudent });
    const provider = options.providers.find(item => item.id === "classroom") as unknown as { options: { authorize: (credentials: unknown, request: unknown) => Promise<unknown> } };
    expect(provider).toBeDefined();
    const credentials = { token: "qr", email: "student@example.test", firstName: "Student", lastName: "Name", studentId: "123", groupName: "G1", githubId: "42", semesterId: "forged" };
    expect(await provider.options.authorize(credentials, { headers: { "x-forwarded-for": "198.51.100.1, 10.0.0.1" } })).toMatchObject({ id: classroomUser.id, authMethod: "classroom" });
    expect(registerClassroomStudent).toHaveBeenCalledWith({ token: "qr", email: "student@example.test", firstName: "Student", lastName: "Name", studentId: "123", groupName: "G1" }, "198.51.100.1");
  });
  it("clears claims on provider changes and ignores client session update fields", async () => {
    const options = createAuthOptions(authEnvironment, { upsertUser: vi.fn() });
    const jwt = options.callbacks!.jwt!;
    const token = await jwt(callbackArguments(jwt, { token: { githubId: "42", githubLogin: "staff" }, user: classroomUser, account: { provider: "classroom", providerAccountId: classroomUser.id, type: "credentials" }, trigger: "signIn" }));
    expect(token).toMatchObject({ userId: classroomUser.id, rosterId: classroomUser.rosterId, semesterId: classroomUser.semesterId, authMethod: "classroom" });
    expect(token.githubId).toBeUndefined();
    const updated = await jwt(callbackArguments(jwt, { token, trigger: "update", session: { githubId: "42" }, account: null, user: { id: "unused" } }));
    expect(updated).toEqual(token);
    const github = await jwt(callbackArguments(jwt, { token, profile: { id: 42, login: "staff" } as Profile, account: null, user: { id: "42" }, trigger: "signIn" }));
    expect(github.githubId).toBe("42");
    expect(github.rosterId).toBeUndefined();
    expect(github.authMethod).toBeUndefined();
    expect(github.email).toBeUndefined();
  });
});

describe('classroom callback security', () => {
  it('accepts trusted authorize users and exposes only scoped classroom claims in session', async () => {
    const upsertUser = vi.fn();
    const options = createAuthOptions(authEnvironment, { upsertUser });
    const signIn = options.callbacks!.signIn!;
    expect(await signIn(callbackArguments(signIn, { user:classroomUser, account:{provider:'classroom',type:'credentials',providerAccountId:classroomUser.id} }))).toBe(true);
    expect(upsertUser).not.toHaveBeenCalled();
    const callback = options.callbacks!.session!;
    const result = await callback(callbackArguments(callback, {session:sessionFor('42'), token:{...classroomUser},user:{id:'unused',email:'',emailVerified:null},newSession:undefined,trigger:'update'}));
    expect(result.user).toMatchObject({authMethod:'classroom',userId:classroomUser.id,email:classroomUser.email});
    expect((result as Session).user.githubId).toBeUndefined();
  });
  it('never returns provider exception messages with private data', async () => {
    const registerClassroomStudent = vi.fn().mockRejectedValue(Object.assign(new Error('private@example.test qr-secret'), {code:'invalid_qr'}));
    const options = createAuthOptions(authEnvironment, {registerClassroomStudent});
    const provider = options.providers.find(item => item.id === 'classroom') as unknown as {options:{authorize:(credentials:unknown,request:unknown)=>Promise<unknown>}};
    await expect(provider.options.authorize({}, {headers:{}})).rejects.toThrow(/^invalid_qr$/);
    registerClassroomStudent.mockRejectedValue(new Error('private@example.test qr-secret'));
    await expect(provider.options.authorize({}, {headers:{}})).rejects.toThrow(/^registration_failed$/);
  });
});
