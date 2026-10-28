import { createHash } from 'node:crypto';
import postgres from 'postgres';
import { sql as query } from 'drizzle-orm';
import { beforeEach, expect, it } from 'vitest';
import { registerClassroomStudent, classroomRegistrationReady, ensureClassroomRegistrationSchema } from '../../lib/attendance/classroom-registration';
import { GET } from '../../app/api/classroom/status/route';
import { db } from '../../lib/db/client';
const sql=postgres(process.env.DATABASE_URL!,{max:10});
const token='a'.repeat(64);
const input=()=>({token,email:'arta@example.com',firstName:'Arta',lastName:'Kola',studentId:'A-1',groupName:'G1'});
let semesterId:string,sessionId:string;
beforeEach(async()=>{
 await sql`truncate users,semesters restart identity cascade`; await sql`truncate request_limits`;
 const [u]=await sql`insert into users(github_id,github_username) values ('100','professor') returning id`;
 const [s]=await sql`insert into semesters(title,week_count,status) values ('Class',15,'active') returning id`; semesterId=s.id;
 const [c]=await sql`insert into class_sessions(semester_id,week_number,kind,group_name,title,state,created_by,checkin_ends_at) values (${semesterId},1,'lecture','G1','Class','open',${u.id},statement_timestamp()+interval '5 minutes') returning id`; sessionId=c.id;
 await sql`insert into qr_challenges(session_id,token_hash,expires_at) values (${sessionId},${createHash('sha256').update(token).digest()},statement_timestamp()+interval '5 minutes')`;
});
it.each(['arta@gmail.com','arta@universitetiaab.com'])('enrolls %s without GitHub or attendance',async email=>{
 const r=await registerClassroomStudent({...input(),email},'192.0.2.1');
 expect(r).toMatchObject({email,authMethod:'classroom',semesterId,name:'Arta Kola'});
 expect(await sql`select github_id,github_username from users where id=${r.id}`).toEqual([{github_id:null,github_username:null}]);
 expect(await sql`select id from attendance_records`).toHaveLength(0); expect(await sql`select id from classroom_registrations`).toHaveLength(1);
});
it('preserves imported names, GitHub identity, roster and attendance',async()=>{
 const [u]=await sql`insert into users(github_id,github_username) values ('200','old') returning id`;
 const [r]=await sql`insert into roster(semester_id,student_id,full_name,email,group_name,user_id,activated_at) values (${semesterId},'A-1','Ëndrra Çela','arta@example.com','G2',${u.id},statement_timestamp()) returning id`;
 await sql`insert into attendance_records(session_id,roster_id,scanned_at) values (${sessionId},${r.id},statement_timestamp())`;
 expect(await registerClassroomStudent({...input(),firstName:'Endrra',lastName:'Cela'},'192.0.2.1')).toMatchObject({id:u.id,rosterId:r.id,name:'Ëndrra Çela'});
 expect((await sql`select github_id from users where id=${u.id}`)[0].github_id).toBe('200'); expect(await sql`select id from attendance_records`).toHaveLength(1);
});
it.each([{email:'other@example.com'},{firstName:'Other'},{studentId:'OTHER'}])('rejects conflict %j',async patch=>{
 await registerClassroomStudent(input(),'192.0.2.1'); await expect(registerClassroomStudent({...input(),...patch},'192.0.2.2')).rejects.toMatchObject({code:'profile_conflict'}); expect(await sql`select id from roster`).toHaveLength(1);
});
it.each(['closed','cancelled','draft'])('rejects %s sessions',async state=>{
 await sql`update class_sessions set state=${state}`; await expect(registerClassroomStudent(input(),'192.0.2.1')).rejects.toMatchObject({code:'invalid_qr'});
});
it('rejects expired challenges, deadlines, archived semesters and absent tokens',async()=>{
 await sql`update qr_challenges set expires_at=statement_timestamp()-interval '1 second'`; await expect(registerClassroomStudent(input(),'1')).rejects.toMatchObject({code:'invalid_qr'});
 await sql`update qr_challenges set expires_at=statement_timestamp()+interval '5 minutes'`; await sql`update class_sessions set checkin_ends_at=statement_timestamp()`; await expect(registerClassroomStudent(input(),'1')).rejects.toMatchObject({code:'invalid_qr'});
 await sql`update class_sessions set checkin_ends_at=statement_timestamp()+interval '5 minutes'`; await sql`update semesters set status='archived'`; await expect(registerClassroomStudent(input(),'1')).rejects.toMatchObject({code:'invalid_qr'});
 await expect(registerClassroomStudent({...input(),token:'b'.repeat(64)},'1')).rejects.toMatchObject({code:'invalid_qr'});
});
it('denies configured professor and staff identities',async()=>{
 const [u]=await sql`select id from users where github_id='100'`;
 await sql`insert into roster(semester_id,student_id,full_name,email,group_name,user_id,activated_at) values (${semesterId},'A-1','Arta Kola','arta@example.com','G1',${u.id},statement_timestamp())`;
 await expect(registerClassroomStudent(input(),'1')).rejects.toMatchObject({code:'staff_forbidden'});
 await sql`update users set github_id='101'`; await sql`insert into staff(user_id) values (${u.id})`;
 await expect(registerClassroomStudent(input(),'1')).rejects.toMatchObject({code:'staff_forbidden'});
});
it('serializes concurrent duplicate registrations',async()=>{
 const r=await Promise.all(Array.from({length:6},()=>registerClassroomStudent(input(),'1'))); expect(new Set(r.map(x=>x.id)).size).toBe(1); expect(await sql`select id from roster`).toHaveLength(1); expect(await sql`select id from users where github_id is null`).toHaveLength(1);
});
it('counts failed matches before matching and blocks attempt eleven across IPs',async()=>{
 await registerClassroomStudent(input(),'1'); for(let n=0;n<9;n++) await expect(registerClassroomStudent({...input(),firstName:'Wrong'},String(n))).rejects.toMatchObject({code:'profile_conflict'});
 await expect(registerClassroomStudent(input(),'99')).rejects.toMatchObject({code:'rate_limited'});
});
it('supports campus NAT students',async()=>{
 for(let n=0;n<40;n++) await registerClassroomStudent({...input(),studentId:`S${n}`,email:`s${n}@example.com`},'1'); expect(await sql`select id from roster`).toHaveLength(40);
},30000);
it.each([{email:'bad'},{firstName:''},{lastName:''},{studentId:''},{groupName:'G3'},{token:''}])('rejects malformed %j',async patch=>{ await expect(registerClassroomStudent({...input(),...patch},'1')).rejects.toMatchObject({code:'invalid_registration'}); });
it('reports unavailable until idempotent staff migration; public status never caches',async()=>{
 await sql`drop table classroom_registrations`; await sql`alter table users alter column github_id set not null`; await sql`alter table users alter column github_username set not null`; expect(await classroomRegistrationReady()).toBe(false); const r=await GET(); expect(await r.json()).toEqual({enabled:false}); expect(r.headers.get('Cache-Control')).toContain('no-store');
 await ensureClassroomRegistrationSchema(db); await ensureClassroomRegistrationSchema(db); expect(await classroomRegistrationReady()).toBe(true); expect(await sql`select id from users`).toHaveLength(1);
 await expect(sql`insert into users(github_id,github_username) values ('invalid','bad')`).rejects.toMatchObject({code:'23514'});
 await expect(sql`insert into users(github_id,github_username) values ('100','duplicate')`).rejects.toMatchObject({code:'23505'});
 await expect(registerClassroomStudent(input(),'1')).resolves.toMatchObject({authMethod:'classroom'});
});

it('fills an imported unbound roster email without changing roster ID or group',async()=>{
 const [row]=await sql`insert into roster(semester_id,student_id,full_name,group_name) values (${semesterId},'A-1','Arta Kola','G2') returning id`;
 const result=await registerClassroomStudent(input(),'1');
 expect(result.rosterId).toBe(row.id);
 expect(await sql`select email,group_name from roster where id=${row.id}`).toEqual([{email:'arta@example.com',group_name:'G2'}]);
});

it('rolls back a racing email conflict without leaving an orphan user',async()=>{
 const results=await Promise.allSettled([registerClassroomStudent(input(),'1'),registerClassroomStudent({...input(),studentId:'A-2'},'2')]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:{code:'profile_conflict'}});
 expect(await sql`select id from users where github_id is null`).toHaveLength(1);
});

it('applies the independent campus IP limit before enrollment',async()=>{
 await registerClassroomStudent(input(),'1');
 await sql`update request_limits set count=300 where action='classroom_ip'`;
 await expect(registerClassroomStudent({...input(),studentId:'NEW',email:'new@example.com'},'1')).rejects.toMatchObject({code:'rate_limited'});
 expect(await sql`select id from roster`).toHaveLength(1);
});

async function waitForAdvisoryWait() {
 for(let attempt=0;attempt<100;attempt++) {
  const rows=await sql`select pid from pg_stat_activity where datname=current_database() and wait_event='advisory'`;
  if(rows.length) return;
  await new Promise(resolve=>setTimeout(resolve,10));
 }
 throw new Error('Registration did not wait for the advisory lock');
}

it.each(['session','student'])('rejects expired QR after waiting for the %s lock and rolls back creation',async lock=>{
 let enrollment:ReturnType<typeof registerClassroomStudent>;
 await sql.begin(async tx=>{
  const key=lock==='session'?sessionId:JSON.stringify(['classroom-enroll',semesterId,'A-1']);
  await tx`select pg_advisory_xact_lock(hashtextextended(${key},0))`;
  enrollment=registerClassroomStudent(input(),'1');
  // Attach a handler while the transaction is blocked to prevent unhandled rejection.
  void enrollment.catch(()=>{});
  await waitForAdvisoryWait();
  await tx`update qr_challenges set expires_at=clock_timestamp()-interval '1 second'`;
 });
 await expect(enrollment!).rejects.toMatchObject({code:'invalid_qr'});
 expect(await sql`select id from roster`).toHaveLength(0);
 expect(await sql`select id from users where github_id is null`).toHaveLength(0);
});


it('does not take table-exclusive locks when the classroom migration is already applied', async () => {
 await db.transaction(async transaction => {
  await ensureClassroomRegistrationSchema(transaction);
  const locks = await transaction.execute(query`
   select relation::regclass::text as relation, mode from pg_locks
   where pid=pg_backend_pid() and mode='AccessExclusiveLock'
    and relation in ('users'::regclass, 'classroom_registrations'::regclass)
  `);
  expect(locks).toHaveLength(0);
 });
 expect(await sql`select id from users`).toHaveLength(1);
});
