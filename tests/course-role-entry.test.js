import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
test('course landing page stays visible for professor and students, with or without a material anchor', async () => {
 const script=await readFile(new URL('../assets/mobile-course-entry.js',import.meta.url),'utf8');
 for(const hash of ['', '#javet']) {
  const destinations=[];
  vm.runInNewContext(script,{window:{location:{hash,replace:target=>destinations.push(target),assign:target=>destinations.push(target)}}});
  assert.deepEqual(destinations,[],'the course must not silently send every visitor into a student card');
 }
 const html=await readFile(new URL('../lendet/2026-2027/mobile/index.html',import.meta.url),'utf8');
 assert.match(html,/Jam student/);
 assert.match(html,/Jam profesor/);
 assert.match(html,/href="https:\/\/aab-mobile-attendance.vercel.app\/staff"/);
});
