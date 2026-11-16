import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
const sql=postgres(process.env.DATABASE_URL!,{max:1,onnotice:()=>{}});
async function api(page:Page,path:string,method='GET',data?:unknown){return page.evaluate(async({path,method,data})=>{const r=await fetch(path,{method,headers:data===undefined?undefined:{'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,body:await r.json()};},{path,method,data});}
async function login(page:Page,persona:'professor'|'studentOne'|'studentTwo'){
 await page.goto('/');expect((await api(page,'/api/test/session','POST',{persona})).status).toBe(200);
}
async function setup(page:Page){
 await login(page,'professor');expect((await api(page,'/api/admin/bootstrap','POST')).status).toBe(201);
 expect((await api(page,'/api/admin/course-setup','POST')).status).toBe(200);
 const [semester]=await sql`select id from semesters where status='active'`;
 for(const [id,login,name,index] of [['900000002','e2e-arta','Arta Kola','ROLE-001'],['900000003','e2e-besa','Besa Duka','ROLE-002']]){
  const [user]=await sql`insert into users(github_id,github_username,name) values (${id},${login},${name}) returning id`;
  await sql`insert into roster(semester_id,student_id,full_name,email,group_name,user_id,activated_at) values (${semester.id},${index},${name},${index.toLowerCase()+'@example.test'},'G1',${user.id},now())`;
 }
}
test.beforeEach(async()=>{await sql`truncate users, semesters, request_limits restart identity cascade`;});
test.afterAll(async()=>{await sql.end();});
test('anonymous professor OAuth entrance preserves week, type and group instead of showing a student card',async({page})=>{
 const target='/staff/qr?week=10&kind=lab&group=G2';
 await page.goto(target);await page.getByRole('link',{name:'Hyr me GitHub',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Hyrja e profesorit'})).toBeVisible();
 expect(new URL(page.url()).searchParams.get('callbackUrl')).toContain(target);
 await expect(page.getByRole('button',{name:'Hyr me GitHub'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Karta e studentit',exact:true})).toHaveCount(0);
 await page.goto('/progress?callbackUrl='+encodeURIComponent(target));
 await expect(page.getByRole('heading',{name:'Hyrja e profesorit'})).toBeVisible();
});
for(const width of [375,1280]){
 test(`professor/student routes and account switching remain separate at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await setup(page);
  for(const route of ['/','/student','/student/activate','/check-in','/colloquium']){
   await page.goto(route);await expect(page).toHaveURL(route==='/colloquium'?/\/staff\/colloquium$/:/\/staff$/);
   await expect(page.getByText('Profili i studentit',{exact:true})).toHaveCount(0);
  }
  await page.goto('/progress');await expect(page.getByRole('heading',{name:'Regjistri i studentëve · Profesori Arben'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Arta Kola',exact:true})).toHaveCount(0);
  for(const [persona,name,other] of [['studentOne','Arta Kola','Besa Duka'],['studentTwo','Besa Duka','Arta Kola']] as const){
   await login(page,persona);await page.goto('/progress');
   await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
   await expect(page.getByRole('heading',{name:other,exact:true})).toHaveCount(0);
   await expect(page.getByText('Karta jote',{exact:true})).toBeVisible();
   await page.reload();await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
   await page.goto('/student');await expect(page.getByText('Profili i studentit',{exact:true})).toBeVisible();
   await page.goto('/staff');await expect(page.getByRole('heading',{name:'Staff access required'})).toBeVisible();
   expect((await api(page,'/api/course/launch','POST',{week:10,kind:'lab',group:'G1'})).status).toBe(403);
   await page.getByRole('link',{name:'Hyr me GitHub',exact:true}).click();
   await expect(page.getByText(/Kjo llogari nuk ka qasje si profesor/)).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
   await page.getByRole('button',{name:'Dil / Ndërro llogarinë'}).click();
   await expect(page.getByRole('heading',{name:'Hyrja e profesorit'})).toBeVisible();
   await expect(page.getByText(/Aktualisht je i kyçur/)).toHaveCount(0);
  }
  await login(page,'professor');await page.goto('/signin?callbackUrl=%2Fstaff%2Freport%3Fweek%3D7');await expect(page).toHaveURL(/\/staff\/report\?week=7$/);
 });
}
