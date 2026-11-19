import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CASES,initialState,transition} from '../materials/week-10/sync-model.mjs';
const read=path=>readFile(path,'utf8');
test('week 10 follows the syllabus and teaches general concepts before applying them to RideShare',async()=>{
 const content=JSON.parse(await read('materials/week-10/content.json')),plan=JSON.parse(await read('grading/course-plan.json'));
 assert.equal(content.topic,plan.weeks.find(w=>w.week===10).title);
 const boundary=content.lecture.findIndex(s=>s.id==='kalimi-rideshare');assert.ok(boundary>=12);
 assert.doesNotMatch(JSON.stringify(content.lecture.slice(0,boundary)),/RideShare|Arta|Dritoni|Ferizaj/);
 for(const id of ['baza','polling','sse','websocket','infrastruktura-teori','rilidhja-teori'])assert.ok(content.lecture.slice(0,boundary).some(s=>s.id===id));
 for(const {number,title} of CASES){for(const list of [content.lecture,content.lab])assert.equal(list.find(s=>s.id===`rasti-${number}`)?.title,`Rasti ${number} · ${title}`);}
});
test('student handoff links the same report, week-10 form and honest structural feedback',async()=>{
 const guide=await read('lendet/2026-2027/mobile/java-10/ushtrimet.html');
 assert.match(guide,/week=Java%2010/);assert.match(guide,/java-10-model\.md/);assert.match(guide,/2\/2/);assert.match(guide,/nuk ekzekutojnë tri rastet/);assert.match(guide,/rikontrollo/);
 assert.doesNotMatch(JSON.parse(await read('materials/week-10/content.json')).lab.map(s=>s.body).join(''),/<pre|export async|CREATE TABLE/);
 assert.match(await read('lendet/2026-2027/mobile/java-10/index.html'),/prezantimi-ligjerates\.html/);
});
test('request reaches the other screen only after its next read; creating a request does not consume a seat',()=>{
 const start=initialState(1),requested=transition(start,{type:'request'});
 assert.equal(start.server.request,'none');assert.equal(requested.server.seats,2);
 assert.equal(requested.clients.passenger.request,'pending');assert.equal(requested.clients.driver.request,'none');
 const read=transition(requested,{type:'poll'});assert.equal(read.clients.driver.request,'pending');assert.equal(read.clients.driver.seats,2);
});
test('acceptance is committed once and reaches the passenger on the next read',()=>{
 const accepted=transition(initialState(2),{type:'accept'});
 assert.equal(accepted.server.seats,1);assert.equal(accepted.clients.driver.request,'accepted');assert.equal(accepted.clients.passenger.request,'pending');
 const duplicate=transition(accepted,{type:'accept'});assert.equal(duplicate.server.seats,1);assert.equal(duplicate.server.version,3);
 const result=transition(duplicate,{type:'poll'});assert.equal(result.clients.passenger.request,'accepted');assert.equal(result.clients.passenger.seats,1);
});
test('offline retains the old copy and reconnect reads the current server state without repeating a command',()=>{
 const offline=transition(initialState(3),{type:'disconnect',role:'passenger'}),accepted=transition(offline,{type:'accept'}),polled=transition(accepted,{type:'poll'});
 assert.equal(polled.server.seats,1);assert.equal(polled.clients.passenger.seats,2);assert.equal(polled.clients.passenger.request,'pending');assert.equal(polled.clients.passenger.stale,true);
 const online=transition(polled,{type:'connect',role:'passenger'});assert.equal(online.clients.passenger.seats,1);assert.equal(online.clients.passenger.request,'accepted');assert.equal(online.clients.passenger.stale,false);assert.equal(online.server.seats,1);
});
test('empty capacity and an offline actor cannot produce a new acceptance',()=>{
 let empty=initialState(2);empty.server.seats=0;assert.equal(transition(empty,{type:'accept'}).server.request,'pending');
 const offline=transition(initialState(2),{type:'disconnect',role:'driver'});assert.equal(transition(offline,{type:'accept'}).server.seats,2);
});

test('the demo counts screen reads, including reconnects, rather than polling rounds',()=>{
 const both=transition(initialState(1),{type:'poll'});
 assert.equal(both.reads,2);
 const oneOffline=transition(both,{type:'disconnect',role:'passenger'});
 const oneRead=transition(oneOffline,{type:'poll'});
 assert.equal(oneRead.reads,3);
 const allOffline=transition(oneRead,{type:'disconnect',role:'driver'});
 assert.equal(transition(allOffline,{type:'poll'}).reads,3);
 assert.equal(transition(allOffline,{type:'connect',role:'passenger'}).reads,4);
});
test('a stale driver retry cannot accept an already accepted request twice',()=>{
 const accepted=transition(initialState(2),{type:'accept'});
 accepted.clients.driver.request='pending';
 const retried=transition(accepted,{type:'accept'});
 assert.deepEqual(retried.server,accepted.server);
});

test('the week 10 classroom path keeps the full lecture and the lab comparison introduces the polling step', async () => {
  const path = 'lendet/2026-2027/mobile/java-10/';
  const lecture = await read(path+'prezantimi-ligjerates.html');
  const lab = await read(path+'prezantimi-ushtrimeve.html');
  const guide = await read(path+'ushtrimet.html');
  const classroom = [...lecture.matchAll(/<section class="step" id="([^"]+)" data-classroom-slide>/g)].map(match => match[1]);
  assert.equal(classroom.length,20);
  assert.equal([...lecture.matchAll(/<section class="step" id=/g)].length,32);
  assert.equal(classroom[0],'tema');
  assert.equal(classroom.at(-1),'mbyllja');
  assert.ok(classroom.indexOf('zgjedhja') < classroom.indexOf('kalimi-rideshare'));
  const table = /<table class="sync-comparison"[\s\S]*?<\/table>/;
  assert.ok(table.test(lecture));
  assert.equal(lab.match(table)?.[0],lecture.match(table)[0]);
  assert.match(lab,/id="krahasimi-polling"[^]*?<\/section>\s*<section class="step" id="polling-hapi"/);
  assert.doesNotMatch(guide,/id="krahasimi-polling"/);
  assert.match(await read(path+'index.html'),/prezantimi-ligjerates\.html\?pamja=plote/);
});
