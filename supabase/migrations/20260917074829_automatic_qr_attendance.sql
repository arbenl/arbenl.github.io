-- A scan immediately records presence. Existing pending records remain unchanged.
-- The two-minute window starts with the first QR, not when the lesson is created.
alter table attendance_private.sessions add column checkin_ends_at timestamptz;
create index sessions_expiry on attendance_private.sessions(checkin_ends_at) where state='open';

create or replace function public.attendance_api(action text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid(); mail text; is_staff boolean; sid uuid; sem uuid;
 sess attendance_private.sessions%rowtype; person attendance_private.roster%rowtype;
 token text; result jsonb; item jsonb; expiry timestamptz; next_state text; expired_session uuid;
begin
 select lower(email) into mail from auth.users where id=uid and email_confirmed_at is not null;
 if uid is null or mail is null then raise exception 'Identifikohuni me email të verifikuar.' using errcode='42501'; end if;
 -- Deadline is authoritative even if the teacher closes the browser or loses connection.
 -- Finalization is reconciled on access; scans also check the timestamp explicitly.
 for expired_session in update attendance_private.sessions set state='finalized'
   where state='open' and checkin_ends_at<=clock_timestamp()
   returning id loop
   insert into attendance_private.audit(actor,action,subject,details)
     values(uid,'window_expired',expired_session,'{"automatic":true}');
 end loop;
 is_staff := exists(select 1 from attendance_private.staff where user_id=uid);
 if action='bootstrap' then
   return jsonb_build_object('staff',is_staff,'email',mail,'semesters',coalesce((
     select jsonb_agg(to_jsonb(s) order by s.created_at desc) from attendance_private.semesters s
     where is_staff or exists(select 1 from attendance_private.roster r where r.semester_id=s.id and r.email=mail)), '[]'::jsonb));
 end if;
 if action='scan' then
   token := payload->>'token';
   if token is null or length(token)<>64 then raise exception 'QR i pavlefshëm.'; end if;
   select s.* into sess from attendance_private.challenges c join attendance_private.sessions s on s.id=c.session_id
   where c.hash=extensions.digest(token,'sha256') and c.expires_at>clock_timestamp() for update of s;
   if sess.id is null or sess.state<>'open' or sess.checkin_ends_at is null or sess.checkin_ends_at<=clock_timestamp() or not exists(select 1 from attendance_private.challenges c where c.hash=extensions.digest(token,'sha256') and c.expires_at>clock_timestamp()) then raise exception 'QR ka skaduar ose sesioni është mbyllur. Skanoni QR aktual në sallë.'; end if;
   select * into person from attendance_private.roster r where r.semester_id=sess.semester_id and r.email=mail
     and (sess.group_name='*' or r.group_name=sess.group_name) and r.joined_at<=sess.created_at;
   if person.id is null then raise exception 'Nuk jeni në listën e këtij sesioni. Kontaktoni pedagogun.'; end if;
   insert into attendance_private.records(session_id,roster_id,status,scanned_at) values(sess.id,person.id,'present',clock_timestamp())
   on conflict(session_id,roster_id) do nothing;
   return (select jsonb_build_object('status',r.status,'title',sess.title,'semester_id',sess.semester_id,'scanned_at',r.scanned_at) from attendance_private.records r where r.session_id=sess.id and r.roster_id=person.id);
 end if;
 if action='report' then
   sem := (payload->>'semester_id')::uuid;
   if not is_staff and not exists(select 1 from attendance_private.roster where semester_id=sem and email=mail) then raise exception 'Nuk keni qasje.' using errcode='42501'; end if;
   return jsonb_build_object(
    'sessions',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at) from attendance_private.sessions s where s.semester_id=sem and
       (is_staff or exists(select 1 from attendance_private.roster r where r.semester_id=sem and r.email=mail and (s.group_name='*' or s.group_name=r.group_name) and r.joined_at<=s.created_at))),'[]'::jsonb),
    'roster',coalesce((select jsonb_agg(to_jsonb(r) order by r.name) from attendance_private.roster r where r.semester_id=sem and (is_staff or r.email=mail)),'[]'::jsonb),
    'records',coalesce((select jsonb_agg(to_jsonb(a)) from attendance_private.records a join attendance_private.roster r on a.roster_id=r.id where r.semester_id=sem and (is_staff or r.email=mail)),'[]'::jsonb));
 end if;
 if not is_staff then raise exception 'Vetëm pedagogu ka qasje.' using errcode='42501'; end if;
 if action='semester' then
   insert into attendance_private.semesters(title,weeks) values(trim(payload->>'title'),(payload->>'weeks')::int) returning id into sem;
   result := jsonb_build_object('id',sem);
 elsif action='roster' then
   sem := (payload->>'semester_id')::uuid;
   if jsonb_array_length(payload->'students') not between 1 and 500 then raise exception 'Lista duhet të përmbajë 1–500 studentë.'; end if;
   for item in select * from jsonb_array_elements(payload->'students') loop
     insert into attendance_private.roster(semester_id,email,student_number,name,group_name)
      values(sem,lower(trim(item->>'email')),trim(item->>'student_number'),trim(item->>'name'),trim(item->>'group_name'));
   end loop;
   result := jsonb_build_object('inserted',jsonb_array_length(payload->'students'));
 elsif action='session' then
   sem := (payload->>'semester_id')::uuid;
   if not exists(select 1 from attendance_private.semesters where id=sem and (payload->>'week')::int between 1 and weeks) then raise exception 'Java jashtë semestrit.'; end if;
   if not exists(select 1 from attendance_private.roster where semester_id=sem and (payload->>'group_name'='*' or group_name=payload->>'group_name')) then raise exception 'Shtoni fillimisht listën e studentëve për këtë grup.'; end if;
   insert into attendance_private.sessions(semester_id,week,kind,group_name,title,created_by)
    values(sem,(payload->>'week')::int,payload->>'kind',payload->>'group_name',trim(payload->>'title'),uid) returning id into sid;
   result := jsonb_build_object('id',sid);
 else
   sid := (payload->>'session_id')::uuid;
   select * into sess from attendance_private.sessions where id=sid for update;
   if sess.id is null then raise exception 'Sesioni nuk ekziston.'; end if;
   if action='challenge' then
     if sess.state<>'open' then raise exception 'Sesioni nuk është i hapur.'; end if;
     if sess.checkin_ends_at is null then
       update attendance_private.sessions set checkin_ends_at=clock_timestamp()+interval '2 minutes'
         where id=sid returning * into sess;
       insert into attendance_private.audit(actor,action,subject,details)
         values(uid,'window_opened',sid,jsonb_build_object('ends_at',sess.checkin_ends_at));
     end if;
     if sess.checkin_ends_at<=clock_timestamp() then raise exception 'Dritarja e regjistrimit ka përfunduar.'; end if;
     delete from attendance_private.challenges where expires_at<now()-interval '1 hour';
     token := replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
     expiry := least(clock_timestamp()+interval '40 seconds',sess.checkin_ends_at);
     insert into attendance_private.challenges(hash,session_id,expires_at) values(extensions.digest(token,'sha256'),sid,expiry);
     return jsonb_build_object('token',token,'expires_at',expiry,'server_time',clock_timestamp(),'checkin_ends_at',sess.checkin_ends_at,'title',sess.title,'week',sess.week,'kind',sess.kind);
   elsif action='state' then
     next_state := payload->>'state';
     if next_state not in ('closed','finalized','cancelled') or next_state is null then raise exception 'Gjendje e pavlefshme.'; end if;
     if sess.state=next_state then return jsonb_build_object('state',next_state); end if;
     if sess.state in ('finalized','cancelled') then raise exception 'Sesioni është përfunduar.'; end if;
     if next_state='finalized' and exists(select 1 from attendance_private.records where session_id=sid and status='pending') then raise exception 'Shqyrtoni të gjitha skanimet në pritje para përfundimit.'; end if;
     update attendance_private.sessions set state=next_state where id=sid;
     delete from attendance_private.challenges where session_id=sid;
     result := jsonb_build_object('state',next_state);
   elsif action='verify' then
     if sess.state='cancelled' then raise exception 'Sesioni është anuluar.'; end if;
     if payload->>'status' not in ('present','rejected','excused') or payload->>'status' is null then raise exception 'Status i pavlefshëm.'; end if;
     if length(trim(coalesce(payload->>'reason','')))<3 then raise exception 'Shënoni arsyen ose verifikimin e identitetit në sallë.'; end if;
     select * into person from attendance_private.roster where id=(payload->>'roster_id')::uuid and semester_id=sess.semester_id and (sess.group_name='*' or group_name=sess.group_name) and joined_at<=sess.created_at;
     if person.id is null then raise exception 'Studenti nuk i përket sesionit.'; end if;
     insert into attendance_private.records(session_id,roster_id,status,verified_at,verified_by) values(sid,person.id,payload->>'status',clock_timestamp(),uid)
     on conflict(session_id,roster_id) do update set status=excluded.status,verified_at=excluded.verified_at,verified_by=excluded.verified_by;
     result := jsonb_build_object('status',payload->>'status');
   else raise exception 'Veprim i panjohur.';
   end if;
 end if;
 insert into attendance_private.audit(actor,action,subject,details) values(uid,action,coalesce(sid,sem),
   case when action='roster' then jsonb_build_object('count',jsonb_array_length(payload->'students')) else payload end);
 return result;
end $$;
revoke all on function public.attendance_api(text,jsonb) from public, anon;
grant execute on function public.attendance_api(text,jsonb) to authenticated;
comment on function public.attendance_api(text,jsonb) is 'AAB attendance: verified email, staff-only management, short-lived QR, automatic scan attendance within a staff-opened two-minute window.';
