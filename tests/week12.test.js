import test from 'node:test';import assert from 'node:assert/strict';
import {initialState,attempt,transition} from '../materials/week-12/validation-model.mjs';
test('the valid owner accepts once; repeat never consumes a second seat',()=>{
 const start=initialState(1),a=attempt(start.server,'dritoni',{requestId:'K-42'}),b=attempt(a.server,'dritoni',{requestId:'K-42'});
 assert.equal(start.server.seats,2);assert.equal(a.response.status,200);assert.equal(a.server.seats,1);assert.equal(b.server.seats,1);assert.equal(b.response.repeated,true);
});
test('missing session and wrong owner cannot mutate server state',()=>{
 const s=initialState(2).server;
 for(const [actor,code] of [[null,401],['arta',403],['other-driver',403]]){const r=attempt(s,actor,{requestId:'K-42',role:'driver',seats:99});assert.equal(r.response.status,code);assert.deepEqual(r.server,s);}
});
test('invalid shapes and identifiers fail before any database mutation',()=>{
 const s=initialState(1).server;
 for(const body of [null,[],{}, {requestId:''},{requestId:42},{requestId:'K-42 OR 1=1'}]){const r=attempt(s,'dritoni',body);assert.equal(r.response.status,400);assert.deepEqual(r.server,s);}
 assert.equal(attempt(s,'dritoni',{requestId:'K-99'}).response.status,404);
});
test('client supplied capacity cannot replace the authoritative count',()=>{
 const r=attempt(initialState(1).server,'dritoni',{requestId:'K-42',seats:999,driverId:'forged'});assert.equal(r.server.seats,1);
});
test('zero capacity and simulated failed write preserve both count and request',()=>{
 let s=initialState(3).server;s.seats=0;const no=attempt(s,'dritoni',{requestId:'K-42'});assert.equal(no.response.status,409);assert.deepEqual(no.server,s);
 s=initialState(3).server;const failed=attempt(s,'dritoni',{requestId:'K-42'},{failWrite:true});assert.equal(failed.response.status,503);assert.deepEqual(failed.server,s);
});
test('both possible completion orders yield one accepted request for the last seat',()=>{
 for(const order of [['K-42','K-43'],['K-43','K-42']]){
  const s=transition(initialState(3),{type:'race',order});assert.equal(s.server.seats,0);
  assert.equal(Object.values(s.server.requests).filter(r=>r.status==='accepted').length,1);
  assert.equal(s.server.requests[order[0]].status,'accepted');assert.equal(s.log.filter(r=>r.status===200).length,1);assert.equal(s.log.filter(r=>r.status===409).length,1);
 }
});
test('passenger sees a new committed result only after a read',()=>{
 const saved=transition(initialState(1),{type:'submit'});assert.equal(saved.views.arta.seats,2);assert.equal(saved.server.seats,1);
 const read=transition(saved,{type:'sync'});assert.equal(read.views.arta.seats,1);assert.equal(read.views.arta.status,'accepted');
});
import {readFile} from 'node:fs/promises';
import {expectedState,renderPair} from '../materials/week-12/phone-ui.mjs';
test('week 12 teaches general concepts first and aligns the three student case contracts',async()=>{
 const content=JSON.parse(await readFile('materials/week-12/content.json','utf8')),cases=JSON.parse(await readFile('materials/week-12/cases.json','utf8'));
 assert.equal(content.topic,'Validimi dhe siguria mobile');assert.equal(content.date,'2026-12-03');assert.equal(content.graded,true);
 const boundary=content.lecture.findIndex(s=>s.id==='kalimi-rideshare');assert.ok(boundary>10);
 assert.doesNotMatch(JSON.stringify(content.lecture.slice(0,boundary)),/RideShare|Arta|Dritoni|Lira/);
 const base='lendet/2026-2027/mobile/java-12/';
 for(const file of ['prezantimi-ligjerates.html','prezantimi-ushtrimeve.html','ushtrimet.html','java-12-model.md','demo/index.html']){
  const text=await readFile(base+file,'utf8');for(const title of cases)assert.ok(text.includes(title),`${file}: missing ${title}`);
 }
 const lab=await readFile(base+'ushtrimet.html','utf8');assert.ok(lab.includes('week=Java%2012'));assert.ok(lab.includes('rikontrollo'));assert.ok(lab.includes('kontroll strukturor'));assert.ok(lab.includes('65–90'));
});
test('the lesson phone targets are the same component and state as the demo outcomes',()=>{
 for(const n of [1,2,3]){const state=expectedState(n),html=renderPair(state);assert.equal((html.match(/class="phone"/g)||[]).length,2);assert.ok(html.includes('RideShare'));
  if(n===1){assert.equal(state.server.seats,1);assert.equal(state.views.arta.status,'accepted');}
  if(n===2){assert.equal(state.response.status,403);assert.equal(state.server.seats,2);assert.equal(state.server.requests['K-42'].status,'pending');}
  if(n===3){assert.equal(state.server.seats,0);assert.equal(state.views.arta.status,'accepted');assert.equal(state.views.lira.status,'pending');}
 }
});
