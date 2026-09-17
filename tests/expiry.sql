\set ON_ERROR_STOP on
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select id as sem from attendance_private.semesters limit 1 \gset
set role authenticated;
select public.attendance_api('session',jsonb_build_object('semester_id',:'sem','week',2,'kind','lab','group_name','G1','title','Lab test'))->>'id' as sid \gset
select public.attendance_api('challenge',jsonb_build_object('session_id',:'sid'))->>'token' as token \gset
reset role;
select set_config('test.token',:'token',false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
set role authenticated;
do $$begin begin perform public.attendance_api('scan',jsonb_build_object('token',current_setting('test.token')));raise exception 'FAIL wrong group allowed';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;raise notice 'PASS wrong group rejected';end;end$$;
reset role;
update attendance_private.challenges set expires_at=now()-interval '1 second' where session_id=:'sid';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
set role authenticated;
do $$begin begin perform public.attendance_api('scan',jsonb_build_object('token',current_setting('test.token')));raise exception 'FAIL expired token accepted';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;raise notice 'PASS server rejects expired QR';end;end$$;
reset role;
-- A valid QR cannot outlive the overall window, including a browser left open.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
set role authenticated;
select public.attendance_api('challenge',jsonb_build_object('session_id',:'sid'))->>'token' as token2 \gset
reset role;
select checkin_ends_at::text as original_end from attendance_private.sessions where id=:'sid' \gset
set role authenticated;
select public.attendance_api('challenge',jsonb_build_object('session_id',:'sid'));
reset role;
select public.assert_ok((select checkin_ends_at=:'original_end'::timestamptz from attendance_private.sessions where id=:'sid'),'Refreshing projector cannot extend attendance window');
update attendance_private.sessions set checkin_ends_at=clock_timestamp()-interval '1 second' where id=:'sid';
select set_config('test.token',:'token2',false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
set role authenticated;
do $$begin begin perform public.attendance_api('scan',jsonb_build_object('token',current_setting('test.token')));raise exception 'FAIL expired session accepted live QR';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;raise notice 'PASS window cutoff overrides unexpired QR';end;end$$;
select public.attendance_api('report',jsonb_build_object('semester_id',:'sem'));
reset role;
select public.assert_ok((select state='finalized' from attendance_private.sessions where id=:'sid'),'Expired window automatically appears as finalized in semester report');
select public.assert_ok(not exists(select 1 from attendance_private.records where session_id=:'sid'),'Late scan did not write attendance');
