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
