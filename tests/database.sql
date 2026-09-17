\set ON_ERROR_STOP on
-- Test-only auth fixture on an isolated PostgreSQL container, never production.
create role anon; create role authenticated;
create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
\i /work/supabase/migrations/20260917071851_attendance_portal.sql
\i /work/supabase/migrations/20260917074829_automatic_qr_attendance.sql
insert into auth.users values ('00000000-0000-0000-0000-000000000001','staff@example.com',now()),('00000000-0000-0000-0000-000000000002','one@example.com',now()),('00000000-0000-0000-0000-000000000003','two@example.com',now()),('00000000-0000-0000-0000-000000000004','unverified@example.com',null);
insert into attendance_private.staff values('00000000-0000-0000-0000-000000000001');
create function public.assert_ok(v boolean,label text) returns void language plpgsql as $$begin if v is distinct from true then raise exception 'FAIL: %',label;end if; raise notice 'PASS: %',label;end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
set role authenticated;
select public.attendance_api('semester','{"title":"Test course","weeks":15}')->>'id' as sem \gset
select public.attendance_api('roster',jsonb_build_object('semester_id',:'sem','students','[{"email":"one@example.com","student_number":"1","name":"One","group_name":"G1"},{"email":"two@example.com","student_number":"2","name":"Two","group_name":"G2"}]'::jsonb));
select public.attendance_api('session',jsonb_build_object('semester_id',:'sem','week',1,'kind','lecture','group_name','*','title','Week 1'))->>'id' as sid \gset
select public.attendance_api('challenge',jsonb_build_object('session_id',:'sid'))->>'token' as token \gset
reset role;
select set_config('test.sem',:'sem',false),set_config('test.sid',:'sid',false),set_config('test.token',:'token',false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
set role authenticated;
select public.assert_ok(public.attendance_api('scan',jsonb_build_object('token',:'token'))->>'status'='present','QR immediately records attendance');
select public.attendance_api('scan',jsonb_build_object('token',:'token'));
select public.assert_ok(jsonb_array_length(public.attendance_api('report',jsonb_build_object('semester_id',:'sem'))->'roster')=1,'Student only sees own identity');
select public.assert_ok(jsonb_array_length(public.attendance_api('report',jsonb_build_object('semester_id',:'sem'))->'records')=1,'Duplicate scan is idempotent');
do $$begin
 begin perform public.attendance_api('semester','{"title":"Intrusion","weeks":15}');raise exception 'FAIL student can administer';exception when insufficient_privilege then raise notice 'PASS student management denied';end;
 begin perform * from attendance_private.roster;raise exception 'FAIL direct table access';exception when insufficient_privilege then raise notice 'PASS direct table access denied';end;
 begin perform public.attendance_api('scan','{"token":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}');raise exception 'FAIL guessed token accepted';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;raise notice 'PASS invalid QR denied';end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
set role authenticated;
reset role;
select id as rid from attendance_private.roster where email='one@example.com' \gset
set role authenticated;
select public.attendance_api('verify',jsonb_build_object('session_id',:'sid','roster_id',:'rid','status','present','reason','Identity checked in room'));
select public.attendance_api('state',jsonb_build_object('session_id',:'sid','state','finalized'));
reset role;
select public.assert_ok((select status='present' from attendance_private.records where roster_id=:'rid'),'Staff confirms attendance');
select public.assert_ok((select count(*) from attendance_private.audit)>=5,'Administrative changes audited');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
set role authenticated;
do $$begin
 begin perform public.attendance_api('scan',jsonb_build_object('token',current_setting('test.token')));raise exception 'FAIL closed token accepted';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;raise notice 'PASS closed QR denied';end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
set role authenticated;
do $$begin begin perform public.attendance_api('bootstrap');raise exception 'FAIL unverified email allowed';exception when insufficient_privilege then raise notice 'PASS unverified email denied';end;end$$;
reset role;
set role anon;
do $$begin begin perform public.attendance_api('bootstrap');raise exception 'FAIL anonymous allowed';exception when insufficient_privilege then raise notice 'PASS anonymous RPC denied';end;end$$;
reset role;
