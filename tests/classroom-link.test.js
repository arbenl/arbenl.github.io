import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import { studentLaunch } from '../assets/mobile-classroom.js';
test('course opens the student launch only from a released server response with the canonical target',()=>{
 const base={week:15,released:false,launchUrl:null};assert.equal(studentLaunch(base),null);
 assert.equal(studentLaunch({...base,released:true,launchUrl:'https://evil.example'}),null);
 assert.equal(studentLaunch({...base,week:14,released:true,launchUrl:'https://aab-rideshare-classroom.vercel.app/course'}),null);
 assert.equal(studentLaunch({...base,released:true,launchUrl:'https://aab-rideshare-classroom.vercel.app/course'}),'https://aab-rideshare-classroom.vercel.app/course');
});
test('course has one scheduled Demo Day entry, no active student launch in static HTML',async()=>{
 const html=await readFile('lendet/2026-2027/mobile/index.html','utf8');
 assert.equal((html.match(/data-classroom-access/g)||[]).length,1);
 assert.ok(html.includes('/assets/mobile-classroom.js'));
 assert.ok(html.includes('24 dhjetor 2026, ora 16:30'));
 assert.ok(!html.includes('href="https://aab-rideshare-classroom.vercel.app/course"'));
 assert.ok(html.includes('/profesor.html#mobile-2026-2027'));
});
test('professor landing keeps attendance and adds authenticated RideShare without automatic redirect',async()=>{
 const html=await readFile('profesor.html','utf8');
 assert.ok(html.includes('id="mobile-2026-2027"'));
 assert.ok(html.includes('https://aab-rideshare-classroom.vercel.app/staff'));
 assert.ok(html.includes('https://aab-mobile-attendance.vercel.app/staff'));
 assert.ok(!html.includes('http-equiv="refresh"'));
});
