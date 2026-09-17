\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  missing_tables text[];
BEGIN
  SELECT array_agg(required.name ORDER BY required.name)
  INTO missing_tables
  FROM (
    VALUES
      ('audit_log'),
      ('attendance_records'),
      ('bootstrap_state'),
      ('class_sessions'),
      ('qr_challenges'),
      ('request_limits'),
      ('roster'),
      ('semesters'),
      ('staff'),
      ('users')
  ) AS required(name)
  WHERE to_regclass('public.' || required.name) IS NULL;

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'missing attendance tables: %', missing_tables;
  END IF;
END
$$;

INSERT INTO users (id, github_id, github_username, name)
VALUES
  ('00000000-0000-4000-8000-000000000001', '1001', 'professor', 'Professor Test'),
  ('00000000-0000-4000-8000-000000000002', '1002', 'student-one', 'Student One'),
  ('00000000-0000-4000-8000-000000000003', '1003', 'student-two', 'Student Two'),
  ('00000000-0000-4000-8000-000000000004', '1004', 'temporary-staff', 'Temporary Staff');

DO $$
BEGIN
  BEGIN
    INSERT INTO users (github_id, github_username)
    VALUES ('1001', 'duplicate-professor');
    RAISE EXCEPTION 'duplicate GitHub user ID was accepted';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;
END
$$;

INSERT INTO staff (user_id, role, added_by)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'administrator', NULL),
  (
    '00000000-0000-4000-8000-000000000004',
    'professor',
    '00000000-0000-4000-8000-000000000001'
  );

INSERT INTO bootstrap_state (singleton, completed_by)
VALUES (TRUE, '00000000-0000-4000-8000-000000000001');

DELETE FROM staff
WHERE user_id = '00000000-0000-4000-8000-000000000001';

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM bootstrap_state WHERE singleton) THEN
    RAISE EXCEPTION 'bootstrap completion disappeared with the staff row';
  END IF;

  BEGIN
    INSERT INTO bootstrap_state (singleton, completed_by)
    VALUES (FALSE, '00000000-0000-4000-8000-000000000004');
    RAISE EXCEPTION 'bootstrap_state accepted a non-singleton row';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END
$$;

DELETE FROM users
WHERE id = '00000000-0000-4000-8000-000000000004';

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM staff
    WHERE user_id = '00000000-0000-4000-8000-000000000004'
  ) THEN
    RAISE EXCEPTION 'staff row did not cascade when its user was removed';
  END IF;

  BEGIN
    DELETE FROM users
    WHERE id = '00000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'bootstrap completing user was deletable';
  EXCEPTION
    WHEN foreign_key_violation THEN NULL;
  END;
END
$$;

INSERT INTO semesters (id, title, week_count, status)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Autumn 2026', 15, 'active'),
  ('10000000-0000-4000-8000-000000000002', 'Spring 2027', 15, 'draft'),
  ('10000000-0000-4000-8000-000000000003', 'Autumn 2027', 15, 'archived');

INSERT INTO roster (
  id,
  semester_id,
  student_id,
  full_name,
  group_name,
  user_id,
  activated_at
)
VALUES
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'ST-001',
    'Student One',
    'G1',
    '00000000-0000-4000-8000-000000000002',
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'ST-002',
    'Student Two',
    'G1',
    '00000000-0000-4000-8000-000000000003',
    now()
  );

DO $$
BEGIN
  BEGIN
    INSERT INTO roster (semester_id, student_id, full_name, group_name)
    VALUES (
      '10000000-0000-4000-8000-000000000001',
      'ST-001',
      'Duplicate Student ID',
      'G1'
    );
    RAISE EXCEPTION 'duplicate Student ID was accepted in a semester';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO roster (
      semester_id,
      student_id,
      full_name,
      group_name,
      user_id,
      activated_at
    )
    VALUES (
      '10000000-0000-4000-8000-000000000001',
      'ST-003',
      'Duplicate Binding',
      'G1',
      '00000000-0000-4000-8000-000000000002',
      now()
    );
    RAISE EXCEPTION 'duplicate user binding was accepted in a semester';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;

  INSERT INTO roster (
    semester_id,
    student_id,
    full_name,
    group_name,
    user_id,
    activated_at
  )
  VALUES (
    '10000000-0000-4000-8000-000000000002',
    'ST-001',
    'Student One',
    'G1',
    '00000000-0000-4000-8000-000000000002',
    now()
  );
END
$$;

INSERT INTO class_sessions (
  id,
  semester_id,
  week_number,
  kind,
  group_name,
  title,
  state,
  created_by
)
VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    1,
    'lecture',
    'G1',
    'Lecture 1',
    'open',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    1,
    'lab',
    'G1',
    'Lab 1',
    'draft',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    2,
    'lecture',
    'G1',
    'Lecture 2',
    'closed',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    2,
    'lab',
    'G1',
    'Lab 2',
    'cancelled',
    '00000000-0000-4000-8000-000000000001'
  );

INSERT INTO qr_challenges (session_id, token_hash, expires_at)
VALUES (
  '30000000-0000-4000-8000-000000000002',
  decode(repeat('ab', 32), 'hex'),
  now() + interval '40 seconds'
);

DELETE FROM class_sessions
WHERE id = '30000000-0000-4000-8000-000000000002';

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM qr_challenges
    WHERE session_id = '30000000-0000-4000-8000-000000000002'
  ) THEN
    RAISE EXCEPTION 'QR challenges did not cascade with their session';
  END IF;
END
$$;

INSERT INTO attendance_records (
  id,
  session_id,
  roster_id,
  status,
  scanned_at
)
VALUES (
  '40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'present',
  now()
);

INSERT INTO attendance_records (
  session_id,
  roster_id,
  status,
  scanned_at,
  verified_at,
  verified_by,
  correction_reason
)
VALUES
  (
    '30000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    'rejected',
    now(),
    now(),
    '00000000-0000-4000-8000-000000000001',
    'Synthetic rejection test'
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000002',
    'excused',
    NULL,
    now(),
    '00000000-0000-4000-8000-000000000001',
    'Synthetic excuse test'
  );

DO $$
BEGIN
  BEGIN
    INSERT INTO attendance_records (session_id, roster_id, status, scanned_at)
    VALUES (
      '30000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'present',
      now()
    );
    RAISE EXCEPTION 'duplicate attendance record was accepted';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;

  BEGIN
    DELETE FROM roster
    WHERE id = '20000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'roster row with attendance was deletable';
  EXCEPTION
    WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    DELETE FROM class_sessions
    WHERE id = '30000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'session with attendance was deletable';
  EXCEPTION
    WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    DELETE FROM semesters
    WHERE id = '10000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'semester with dependent records was deletable';
  EXCEPTION
    WHEN foreign_key_violation THEN NULL;
  END;
END
$$;

DO $$
DECLARE
  invalid_semester_status text;
  invalid_session_kind text;
  invalid_session_state text;
  invalid_attendance_status text;
BEGIN
  FOREACH invalid_semester_status IN ARRAY ARRAY['closed', 'deleted'] LOOP
    BEGIN
      INSERT INTO semesters (title, week_count, status)
      VALUES ('Invalid semester status', 15, invalid_semester_status);
      RAISE EXCEPTION 'invalid semester status was accepted: %', invalid_semester_status;
    EXCEPTION
      WHEN check_violation THEN NULL;
    END;
  END LOOP;

  FOREACH invalid_session_kind IN ARRAY ARRAY['seminar', 'exercise'] LOOP
    BEGIN
      INSERT INTO class_sessions (
        semester_id,
        week_number,
        kind,
        group_name,
        title,
        state,
        created_by
      )
      VALUES (
        '10000000-0000-4000-8000-000000000001',
        2,
        invalid_session_kind,
        'G1',
        'Invalid kind',
        'draft',
        '00000000-0000-4000-8000-000000000001'
      );
      RAISE EXCEPTION 'invalid session kind was accepted: %', invalid_session_kind;
    EXCEPTION
      WHEN check_violation THEN NULL;
    END;
  END LOOP;

  FOREACH invalid_session_state IN ARRAY ARRAY['running', 'deleted'] LOOP
    BEGIN
      INSERT INTO class_sessions (
        semester_id,
        week_number,
        kind,
        group_name,
        title,
        state,
        created_by
      )
      VALUES (
        '10000000-0000-4000-8000-000000000001',
        2,
        'lecture',
        'G1',
        'Invalid state',
        invalid_session_state,
        '00000000-0000-4000-8000-000000000001'
      );
      RAISE EXCEPTION 'invalid session state was accepted: %', invalid_session_state;
    EXCEPTION
      WHEN check_violation THEN NULL;
    END;
  END LOOP;

  FOREACH invalid_attendance_status IN ARRAY ARRAY['absent', 'deleted'] LOOP
    BEGIN
      INSERT INTO attendance_records (session_id, roster_id, status, scanned_at)
      VALUES (
        '30000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000002',
        invalid_attendance_status,
        now()
      );
      RAISE EXCEPTION 'invalid attendance status was accepted: %', invalid_attendance_status;
    EXCEPTION
      WHEN check_violation THEN NULL;
    END;
  END LOOP;
END
$$;

DO $$
DECLARE
  missing_indexes text[];
  unindexed_foreign_keys text[];
  live_index_definition text;
BEGIN
  SELECT array_agg(required.name ORDER BY required.name)
  INTO missing_indexes
  FROM (
    VALUES
      ('attendance_records_roster_id_idx'),
      ('attendance_records_session_roster_unique'),
      ('attendance_records_verified_by_idx'),
      ('audit_log_actor_user_id_idx'),
      ('bootstrap_state_completed_by_idx'),
      ('class_sessions_created_by_idx'),
      ('class_sessions_semester_id_idx'),
      ('qr_challenges_session_id_idx'),
      ('roster_semester_student_id_unique'),
      ('roster_user_id_idx'),
      ('staff_added_by_idx'),
      ('staff_pkey')
  ) AS required(name)
  WHERE to_regclass('public.' || required.name) IS NULL;

  IF missing_indexes IS NOT NULL THEN
    RAISE EXCEPTION 'missing foreign-key support indexes: %', missing_indexes;
  END IF;

  SELECT array_agg(constraint_name ORDER BY constraint_name)
  INTO unindexed_foreign_keys
  FROM (
    SELECT constraint_record.conname AS constraint_name
    FROM pg_constraint AS constraint_record
    WHERE constraint_record.contype = 'f'
      AND constraint_record.connamespace = 'public'::regnamespace
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index AS index_record
        WHERE index_record.indrelid = constraint_record.conrelid
          AND index_record.indisvalid
          AND index_record.indpred IS NULL
          AND index_record.indkey[0] = constraint_record.conkey[1]
      )
  ) AS missing;

  IF unindexed_foreign_keys IS NOT NULL THEN
    RAISE EXCEPTION 'foreign keys without a leading-column index: %', unindexed_foreign_keys;
  END IF;

  SELECT pg_get_indexdef(indexrelid)
  INTO live_index_definition
  FROM pg_index
  WHERE indexrelid = to_regclass('public.attendance_records_live_order_idx');

  IF live_index_definition IS NULL
    OR live_index_definition NOT ILIKE '%session_id%COALESCE(scanned_at, verified_at)%roster_id%'
    OR live_index_definition NOT ILIKE '%WHERE (status = ''present''%'
  THEN
    RAISE EXCEPTION 'missing or invalid live ordering index: %', live_index_definition;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'qr_challenges'
      AND column_name IN ('token', 'raw_token')
  ) THEN
    RAISE EXCEPTION 'qr_challenges stores a raw token column';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'request_limits'
      AND column_name IN ('ip', 'ip_address', 'raw_ip')
  ) THEN
    RAISE EXCEPTION 'request_limits stores a raw IP column';
  END IF;

  BEGIN
    INSERT INTO qr_challenges (session_id, token_hash, expires_at)
    VALUES (
      '30000000-0000-4000-8000-000000000001',
      decode('abcd', 'hex'),
      now() + interval '40 seconds'
    );
    RAISE EXCEPTION 'QR challenge accepted a non-SHA-256-length hash';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO request_limits (action, key_hash, window_start)
    VALUES ('check-in', decode('abcd', 'hex'), date_trunc('minute', now()));
    RAISE EXCEPTION 'request limit accepted a non-SHA-256-length key hash';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END
$$;

INSERT INTO request_limits (action, key_hash, window_start)
VALUES (
  'check-in',
  decode(repeat('cd', 32), 'hex'),
  date_trunc('minute', now())
)
ON CONFLICT (action, key_hash, window_start)
DO UPDATE SET count = request_limits.count + 1;

INSERT INTO request_limits (action, key_hash, window_start)
VALUES (
  'check-in',
  decode(repeat('cd', 32), 'hex'),
  date_trunc('minute', now())
)
ON CONFLICT (action, key_hash, window_start)
DO UPDATE SET count = request_limits.count + 1;

DO $$
BEGIN
  IF (
    SELECT count
    FROM request_limits
    WHERE action = 'check-in'
      AND key_hash = decode(repeat('cd', 32), 'hex')
  ) <> 2 THEN
    RAISE EXCEPTION 'request_limits count did not increment atomically';
  END IF;
END
$$;

ROLLBACK;

\echo 'Attendance database assertions passed.'
