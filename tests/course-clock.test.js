import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getCourseMoment } from '../shared/course-lifecycle.mjs';
const plan=JSON.parse(await readFile('grading/course-plan.json','utf8'));
const schedule={timeZone:plan.timezone,weeks:plan.weeks};
for(const [instant,week,status] of [
 ['2026-09-01T08:00:00Z',1,'upcoming'],
 ['2026-10-29T08:00:00Z',7,'today'],
 ['2026-11-16T08:00:00Z',10,'upcoming'],
 ['2026-11-18T23:30:00Z',10,'today'],
 ['2026-11-19T23:30:00Z',11,'upcoming'],
 ['2026-12-24T20:00:00Z',15,'today'],
 ['2026-12-25T08:00:00Z',null,'completed'],
])test(`scheduled course focus at ${instant}`,()=>{
 const result=getCourseMoment(schedule,new Date(instant));
 assert.equal(result.nextWeek?.week??null,week);assert.equal(result.status,status);
});
test('public and deployed app calendars have exactly the canonical course dates',async()=>{
 const publicSchedule=JSON.parse(await readFile('assets/course-schedule.json','utf8'));
 const appSchedule=JSON.parse(await readFile('attendance-app/lib/attendance/course-schedule.json','utf8'));
 assert.deepEqual(appSchedule,publicSchedule);
 assert.deepEqual(publicSchedule.weeks.map(({week,date})=>({week,date})),plan.weeks.map(({week,date})=>({week,date})));
 assert.equal(await readFile('assets/course-lifecycle.mjs','utf8'),await readFile('attendance-app/lib/attendance/course-lifecycle.mjs','utf8'));
});
