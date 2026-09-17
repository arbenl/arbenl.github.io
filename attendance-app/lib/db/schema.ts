import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Uint8Array }>({
  dataType() {
    return "bytea";
  },
});

const databaseTimestamp = (name: string) =>
  timestamp(name, { mode: "date", withTimezone: true });

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    githubId: text("github_id").notNull(),
    githubUsername: text("github_username").notNull(),
    name: text("name"),
    createdAt: databaseTimestamp("created_at").defaultNow().notNull(),
    updatedAt: databaseTimestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("users_github_id_unique").on(table.githubId),
    check(
      "users_github_id_digits_check",
      sql`${table.githubId} ~ '^[0-9]+$'`,
    ),
  ],
);

export const staff = pgTable(
  "staff",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").default("professor").notNull(),
    addedBy: uuid("added_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    addedAt: databaseTimestamp("added_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "staff_role_check",
      sql`${table.role} in ('professor', 'administrator')`,
    ),
    index("staff_added_by_idx").on(table.addedBy),
  ],
);

export const bootstrapState = pgTable(
  "bootstrap_state",
  {
    singleton: boolean("singleton").default(true).primaryKey(),
    completedBy: uuid("completed_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    completedAt: databaseTimestamp("completed_at").defaultNow().notNull(),
  },
  (table) => [
    check("bootstrap_state_singleton_check", sql`${table.singleton}`),
    index("bootstrap_state_completed_by_idx").on(table.completedBy),
  ],
);

export const semesters = pgTable(
  "semesters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    weekCount: integer("week_count").notNull(),
    status: text("status").default("draft").notNull(),
    createdAt: databaseTimestamp("created_at").defaultNow().notNull(),
    updatedAt: databaseTimestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check("semesters_week_count_check", sql`${table.weekCount} > 0`),
    check(
      "semesters_status_check",
      sql`${table.status} in ('draft', 'active', 'archived')`,
    ),
  ],
);

export const roster = pgTable(
  "roster",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    semesterId: uuid("semester_id")
      .notNull()
      .references(() => semesters.id, { onDelete: "restrict" }),
    studentId: text("student_id").notNull(),
    fullName: text("full_name").notNull(),
    groupName: text("group_name").notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    activatedAt: databaseTimestamp("activated_at"),
    createdAt: databaseTimestamp("created_at").defaultNow().notNull(),
    updatedAt: databaseTimestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("roster_semester_student_id_unique").on(
      table.semesterId,
      table.studentId,
    ),
    uniqueIndex("roster_semester_user_id_unique")
      .on(table.semesterId, table.userId)
      .where(sql`${table.userId} is not null`),
    index("roster_user_id_idx").on(table.userId),
    check(
      "roster_activation_check",
      sql`(${table.userId} is null and ${table.activatedAt} is null)
        or (${table.userId} is not null and ${table.activatedAt} is not null)`,
    ),
  ],
);

export const classSessions = pgTable(
  "class_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    semesterId: uuid("semester_id")
      .notNull()
      .references(() => semesters.id, { onDelete: "restrict" }),
    weekNumber: integer("week_number").notNull(),
    kind: text("kind").notNull(),
    groupName: text("group_name").notNull(),
    title: text("title").notNull(),
    state: text("state").default("draft").notNull(),
    checkinEndsAt: databaseTimestamp("checkin_ends_at"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: databaseTimestamp("created_at").defaultNow().notNull(),
    updatedAt: databaseTimestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check("class_sessions_week_number_check", sql`${table.weekNumber} > 0`),
    check(
      "class_sessions_kind_check",
      sql`${table.kind} in ('lecture', 'lab')`,
    ),
    check(
      "class_sessions_state_check",
      sql`${table.state} in ('draft', 'open', 'closed', 'cancelled')`,
    ),
    index("class_sessions_semester_id_idx").on(table.semesterId),
    index("class_sessions_created_by_idx").on(table.createdBy),
    index("class_sessions_live_reads_idx")
      .on(table.state, table.checkinEndsAt)
      .where(sql`${table.state} = 'open'`),
  ],
);

export const qrChallenges = pgTable(
  "qr_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => classSessions.id, { onDelete: "cascade" }),
    tokenHash: bytea("token_hash").notNull(),
    expiresAt: databaseTimestamp("expires_at").notNull(),
    createdAt: databaseTimestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("qr_challenges_token_hash_unique").on(table.tokenHash),
    check(
      "qr_challenges_token_hash_length_check",
      sql`octet_length(${table.tokenHash}) = 32`,
    ),
    index("qr_challenges_session_id_idx").on(table.sessionId),
    index("qr_challenges_expiry_idx").on(table.expiresAt),
  ],
);

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => classSessions.id, { onDelete: "restrict" }),
    rosterId: uuid("roster_id")
      .notNull()
      .references(() => roster.id, { onDelete: "restrict" }),
    status: text("status").default("present").notNull(),
    scannedAt: databaseTimestamp("scanned_at"),
    verifiedAt: databaseTimestamp("verified_at"),
    verifiedBy: uuid("verified_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    correctionReason: text("correction_reason"),
    createdAt: databaseTimestamp("created_at").defaultNow().notNull(),
    updatedAt: databaseTimestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "attendance_records_status_check",
      sql`${table.status} in ('present', 'rejected', 'excused')`,
    ),
    check(
      "attendance_records_recorded_at_check",
      sql`${table.scannedAt} is not null or ${table.verifiedAt} is not null`,
    ),
    check(
      "attendance_records_verification_check",
      sql`(${table.verifiedAt} is null
          and ${table.verifiedBy} is null
          and ${table.correctionReason} is null)
        or (${table.verifiedAt} is not null
          and ${table.verifiedBy} is not null
          and ${table.correctionReason} is not null)`,
    ),
    uniqueIndex("attendance_records_session_roster_unique").on(
      table.sessionId,
      table.rosterId,
    ),
    index("attendance_records_roster_id_idx").on(table.rosterId),
    index("attendance_records_verified_by_idx").on(table.verifiedBy),
    index("attendance_records_live_order_idx")
      .on(
        table.sessionId,
        sql`coalesce(${table.scannedAt}, ${table.verifiedAt})`,
        table.rosterId,
      )
      .where(sql`${table.status} = 'present'`),
  ],
);

export const requestLimits = pgTable(
  "request_limits",
  {
    action: text("action").notNull(),
    keyHash: bytea("key_hash").notNull(),
    windowStart: databaseTimestamp("window_start").notNull(),
    count: integer("count").default(1).notNull(),
    updatedAt: databaseTimestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      name: "request_limits_pkey",
      columns: [table.action, table.keyHash, table.windowStart],
    }),
    check(
      "request_limits_key_hash_length_check",
      sql`octet_length(${table.keyHash}) = 32`,
    ),
    check(
      "request_limits_count_check",
      sql`${table.count} > 0`,
    ),
    index("request_limits_window_start_idx").on(table.windowStart),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    reason: text("reason"),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: databaseTimestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_log_actor_user_id_idx").on(table.actorUserId),
    index("audit_log_subject_idx").on(
      table.subjectType,
      table.subjectId,
      table.createdAt,
    ),
  ],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  staffMembership: one(staff, {
    fields: [users.id],
    references: [staff.userId],
    relationName: "staffUser",
  }),
  staffAdditions: many(staff, { relationName: "staffAddedBy" }),
  completedBootstraps: many(bootstrapState),
  rosterBindings: many(roster),
  createdSessions: many(classSessions),
  verifiedAttendance: many(attendanceRecords),
  auditEntries: many(auditLog),
}));

export const staffRelations = relations(staff, ({ one }) => ({
  user: one(users, {
    fields: [staff.userId],
    references: [users.id],
    relationName: "staffUser",
  }),
  addedByUser: one(users, {
    fields: [staff.addedBy],
    references: [users.id],
    relationName: "staffAddedBy",
  }),
}));

export const bootstrapStateRelations = relations(bootstrapState, ({ one }) => ({
  completedByUser: one(users, {
    fields: [bootstrapState.completedBy],
    references: [users.id],
  }),
}));

export const semestersRelations = relations(semesters, ({ many }) => ({
  roster: many(roster),
  sessions: many(classSessions),
}));

export const rosterRelations = relations(roster, ({ one, many }) => ({
  semester: one(semesters, {
    fields: [roster.semesterId],
    references: [semesters.id],
  }),
  user: one(users, {
    fields: [roster.userId],
    references: [users.id],
  }),
  attendanceRecords: many(attendanceRecords),
}));

export const classSessionsRelations = relations(
  classSessions,
  ({ one, many }) => ({
    semester: one(semesters, {
      fields: [classSessions.semesterId],
      references: [semesters.id],
    }),
    creator: one(users, {
      fields: [classSessions.createdBy],
      references: [users.id],
    }),
    challenges: many(qrChallenges),
    attendanceRecords: many(attendanceRecords),
  }),
);

export const qrChallengesRelations = relations(qrChallenges, ({ one }) => ({
  session: one(classSessions, {
    fields: [qrChallenges.sessionId],
    references: [classSessions.id],
  }),
}));

export const attendanceRecordsRelations = relations(
  attendanceRecords,
  ({ one }) => ({
    session: one(classSessions, {
      fields: [attendanceRecords.sessionId],
      references: [classSessions.id],
    }),
    rosterEntry: one(roster, {
      fields: [attendanceRecords.rosterId],
      references: [roster.id],
    }),
    verifier: one(users, {
      fields: [attendanceRecords.verifiedBy],
      references: [users.id],
    }),
  }),
);

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(users, {
    fields: [auditLog.actorUserId],
    references: [users.id],
  }),
}));
