import { readFile, writeFile, access } from 'node:fs/promises';
const base = 'lendet/2026-2027/mobile';
const plan = JSON.parse(await readFile('grading/course-plan.json','utf8'));
const manifest = JSON.parse(await readFile('materials/manifest.json','utf8'));
const exists = async file => { try { await access(file); return true; } catch { return false; } };
if (plan.weeks.length !== 15 || new Set(plan.weeks.map(w => w.date)).size !== 15 || plan.weeks.some((w,i) => w.week !== i+1 || !/^\d{4}-\d{2}-\d{2}$/.test(w.date) || i > 0 && w.date <= plan.weeks[i-1].date)) throw new Error('Invalid course calendar');
const weeks=[];
for (const week of plan.weeks) {
  const directory=`${base}/java-${String(week.week).padStart(2,'0')}`;
  const lectureFile=`${directory}/prezantimi-ligjerates.html`;
  const packageFile=manifest[`lecture${week.week}`]?.file;
  const publicationFile=`materials/week-${String(week.week).padStart(2,'0')}/publication.json`;
  const publication=await exists(publicationFile) ? JSON.parse(await readFile(publicationFile,'utf8')) : {};
  const published=publication.published !== false;
  const lectureUrl=!published ? null :await exists(lectureFile) ? `/${lectureFile}` : packageFile && await exists(packageFile) ? `/${packageFile}` : null;
  const labFile=`${directory}/prezantimi-ushtrimeve.html`;
  const labPublished=published && publication.labsPublished !== false;
  const labUrl=week.labHours && labPublished && await exists(labFile) ? `/${directory}/ushtrimet.html` : null;
  weeks.push({week:week.week,...(!published ? {published:false} : {}),date:week.date,title:week.title,weekUrl:`/${directory}/`,lectureUrl,labUrl});
}
const schedule={timeZone:plan.timezone,weeks};
const json=JSON.stringify(schedule,null,2)+'\n';
await writeFile('assets/course-schedule.json',json);
await writeFile('attendance-app/lib/attendance/course-schedule.json',json);
const clock=await readFile('shared/course-lifecycle.mjs','utf8');
await writeFile('assets/course-lifecycle.mjs',clock);
await writeFile('attendance-app/lib/attendance/course-lifecycle.mjs',clock);
let hub=await readFile(`${base}/index.html`,'utf8');
hub=hub.replace('Prezantime: javët 1–5 · Plane pune: javët 6–15','Prezantimet dhe ushtrimet e publikuara shënohen te secila javë.');
for (const week of weeks) {
  const status=week.published === false ? 'Materialet ende nuk janë publikuar.' : week.lectureUrl ? week.labUrl ? 'Prezantimi dhe ushtrimet janë publikuar.' : 'Prezantimi i ligjëratës është publikuar.' : 'Plani dhe detyra janë publikuar; prezantimi ende jo.';
  hub=hub.replace(new RegExp(`(<article[^>]*id="week-${week.week}"[\\s\\S]*?<h3>[\\s\\S]*?<\\/h3>)<p>[\\s\\S]*?<\\/p>`),`$1<p data-publication-status>${status}</p>`);
}
const focus='<section class="notice course-focus" id="course-focus" aria-labelledby="course-focus-title"><h2 id="course-focus-title">Ora e radhës</h2><p data-course-focus-status>Datat dhe materialet e secilës javë i gjen në kalendarin më poshtë.</p><div class="actions" data-course-focus-actions></div></section>';
const roleNotice=hub.match(/<section class="notice"><h2>Hap lëndën me profilin tënd<\/h2>[\s\S]*?<\/section>/)?.[0] ?? '';
hub=hub.replace(roleNotice,'').replace('</h1>','</h1>'+focus+roleNotice);
hub=hub.replace('</head>','<script type="module" src="/assets/course-focus.mjs"></script></head>');
await writeFile(`${base}/index.html`,hub);
console.log('Built shared course calendar and checked actual material availability.');
