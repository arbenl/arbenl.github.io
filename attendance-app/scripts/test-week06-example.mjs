// Execute the supplied Week 6 code with disposable public trip data; no cloud credentials.
import {mkdtemp,readFile,writeFile,mkdir,symlink,rm,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(app);
const files=JSON.parse(await readFile(path.join(root,'materials/week-06/example-files.json'),'utf8'));
const fixture=await mkdtemp(path.join(tmpdir(),'aab-week06-'));
let server,browser;
const trips=[{id:'1',nisja:'Prishtinë',destinacioni:'AAB',ora:'08:00',vendtakimi:'Stacioni',vende:2},{id:'2',nisja:'Fushë Kosovë',destinacioni:'AAB',ora:'08:15',vendtakimi:'Qendra',vende:1},{id:'3',nisja:'Lipjan',destinacioni:'AAB',ora:'08:30',vendtakimi:'Sheshi',vende:0}];
const state=path.join(fixture,'state.json');
async function stateWith(fail=false,hour='08:15'){await writeFile(state,JSON.stringify({fail,trips:trips.map(t=>({...t,ora:t.id==='2'?hour:t.ora}))}));}
async function waitFor(page, predicate){for(let i=0;i<300;i++){if(await page.evaluate(predicate))return;await new Promise(r=>setTimeout(r,100));}throw Error('Browser condition timed out: '+predicate.toString());}
try{
 for(const [file,code]of Object.entries(files)){assert.ok(!path.isAbsolute(file)&&!file.split('/').includes('..'));await mkdir(path.dirname(path.join(fixture,file)),{recursive:true});await writeFile(path.join(fixture,file),code);}
 await mkdir(path.join(fixture,"public/icons"),{recursive:true});
 for(const size of [192,512])await copyFile(path.join(root,`materials/week-06/icon-${size}.png`),path.join(fixture,`public/icons/icon-${size}.png`));
 await mkdir(path.join(fixture,'src/lib'),{recursive:true});
 await writeFile(path.join(fixture,'src/lib/udhetimet.ts'),`import {readFile} from 'node:fs/promises';export async function lexoUdhetimet():Promise<Array<{id:string;nisja:string;destinacioni:string;ora:string;vendtakimi:string;vende:number}>>{const state=JSON.parse(await readFile(${JSON.stringify(state)},'utf8'));if(state.fail)throw Error('Private database error must not leak');return state.trips;}`);
 await writeFile(path.join(fixture,'src/app/page.tsx'),`import {lexoUdhetimet} from '@/lib/udhetimet';export const dynamic='force-dynamic';export default async function Page(){try{const rows=await lexoUdhetimet();return <main><h1>RideShare</h1><p>{rows.length} udhëtime publike</p></main>;}catch{return <main><h1>Databaza nuk përgjigjet</h1></main>;}}`);
 for(const [file,code]of Object.entries({'src/app/panel/page.tsx':'export default function Panel(){return <h1>PRIVATE PROFILE</h1>;}','src/app/api/auth/session/route.ts':'export async function GET(){return Response.json({private:true});}','src/app/api/kerkesa/route.ts':'export async function POST(){return Response.json({simulation:true},{status:409});}'})){await mkdir(path.dirname(path.join(fixture,file)),{recursive:true});await writeFile(path.join(fixture,file),code);}
 await writeFile(path.join(fixture,"src/app/globals.css"),"body{font-family:system-ui;background:#0b101b;color:white}a{color:pink}");
 await stateWith();
 const pkg=JSON.parse(await readFile(path.join(app,'package.json'),'utf8'));
 await writeFile(path.join(fixture,'package.json'),JSON.stringify({private:true,scripts:{dev:'next dev',build:'next build'},dependencies:Object.fromEntries(['next','react','react-dom'].map(k=>[k,pkg.dependencies[k]])),devDependencies:Object.fromEntries(['typescript','@types/node','@types/react','@types/react-dom'].map(k=>[k,pkg.devDependencies[k]]))}));
 await writeFile(path.join(fixture,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2017',lib:['dom','dom.iterable','esnext'],strict:true,noEmit:true,skipLibCheck:true,esModuleInterop:true,module:'esnext',moduleResolution:'bundler',resolveJsonModule:true,isolatedModules:true,jsx:'preserve',plugins:[{name:'next'}],paths:{'@/*':['./src/*']}},include:['next-env.d.ts','**/*.ts','**/*.tsx','.next/types/**/*.ts'],exclude:['node_modules']}));
 await writeFile(path.join(fixture,'next.config.mjs'),`export default {outputFileTracingRoot:${JSON.stringify(fixture)}};`);
 await symlink(path.join(app,'node_modules'),path.join(fixture,'node_modules'),'dir');
 const next=path.join(app,'node_modules/next/dist/bin/next');
 const build=spawn(process.execPath,[next,'build','--webpack'],{cwd:fixture,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});let log='';build.stdout.on('data',b=>log+=b);build.stderr.on('data',b=>log+=b);const timer=setTimeout(()=>build.kill('SIGTERM'),120000);const [code]=await once(build,'exit');clearTimeout(timer);assert.equal(code,0,log);
 server=spawn(process.execPath,[next,'start','--hostname','127.0.0.1','--port','0'],{cwd:fixture,stdio:['ignore','pipe','pipe']});let output='';server.stdout.on('data',b=>output+=b);server.stderr.on('data',b=>output+=b);
 let origin;for(let i=0;i<100;i++){origin=output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];if(origin){try{if((await fetch(origin)).ok)break;}catch{}}if(i===99)throw Error(output);await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true});
 for(const width of [375,1280]){
  await stateWith();const context=await browser.newContext({viewport:{width,height:850}}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
  await waitFor(page,async()=>Boolean(navigator.serviceWorker.controller)&&Boolean(await caches.match('/api/udhetimet')));
  const manifest=await(await fetch(origin+'/manifest.webmanifest')).json();assert.equal(manifest.display,'standalone');assert.deepEqual(manifest.icons.map(i=>i.sizes),['192x192','512x512']);
  // A normal SSR visit must warm the JSON snapshot without visiting the offline reader first.
  const saved=await page.evaluate(async()=>{const r=await caches.match('/api/udhetimet');return {saved:r?.headers.get('x-rideshare-saved-at'),keys:await Promise.all((await caches.keys()).map(async key=>({key,paths:(await(await caches.open(key)).keys()).map(r=>r.url)})))};});assert.ok(saved.saved,JSON.stringify(saved));
  await page.goto(origin+'/panel');await page.evaluate(()=>fetch('/api/auth/session'));
  const cachePaths=await page.evaluate(async()=>{const c=await caches.open('rideshare-public-v1');return(await c.keys()).map(r=>new URL(r.url).pathname);});assert.deepEqual(cachePaths.sort(),['/api/udhetimet','/icons/icon-192.png','/icons/icon-512.png','/offline.html'].sort());
  await context.setOffline(true);await page.goto(origin+'/');await page.waitForSelector('.trip-card');assert.equal(await page.locator('.trip-card').count(),3);assert.match(await page.locator('#source').innerText(),/ruajtur/);assert.match(await page.locator('#trips').innerText(),/08:15/);assert.equal(await page.locator('#book').isDisabled(),true);await page.reload();await page.waitForSelector('.trip-card');assert.equal(await page.locator('.trip-card').count(),3);
  assert.equal(await page.evaluate(async()=>{try{await fetch('/api/kerkesa',{method:'POST'});return false;}catch{return true;}}),true);
  await context.setOffline(false);await stateWith(false,'08:45');await page.getByRole('button',{name:'Rifresko listën'}).click();await waitFor(page,()=>document.querySelector('#trips').textContent.includes('08:45'));assert.match(await page.locator('#source').innerText(),/serveri/);
  await stateWith(true);await page.getByRole('button',{name:'Rifresko listën'}).click();await waitFor(page,()=>document.querySelector('#source').textContent.includes('ruajtur'));assert.match(await page.locator('#trips').innerText(),/08:45/);assert.ok(!(await page.content()).includes('Private database error'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width);assert.deepEqual(errors,[]);await mkdir(path.join(app,'test-results'),{recursive:true});await page.screenshot({path:path.join(app,`test-results/week06-offline-${width}.png`)});await context.close();
  const fresh=await browser.newContext(),empty=await fresh.newPage();await empty.goto(origin);await waitFor(empty,()=>Boolean(navigator.serviceWorker.controller));await fresh.setOffline(true);await empty.goto(origin+'/');await waitFor(empty,()=>document.querySelector('#source')?.textContent.includes('Ende nuk ka listë'));assert.equal(await empty.locator('.trip-card').count(),0);assert.equal(await empty.locator('#book').isDisabled(),true);await fresh.close();
  console.log(`Week 6 ${width}px: SSR warms snapshot, real offline reload, three public cards, no-cache first visit, outage fallback, fresh reconnection, manifest/icons, no private/mutation caching passed.`);
 }
 // Reproduce quota failure in the worker's storage boundary, not in the reader.
 await stateWith();
 await writeFile(path.join(fixture,'public/sw.js'),files['public/sw.js']+`
const originalPut=Cache.prototype.put;Cache.prototype.put=function(request,response){if(new URL(typeof request==='string'?request:request.url,self.location.origin).pathname==='/api/udhetimet')return Promise.reject(new DOMException('Test quota','QuotaExceededError'));return originalPut.call(this,request,response);};`);
 const quota=await browser.newContext(),q=await quota.newPage();await q.goto(origin);await waitFor(q,()=>Boolean(navigator.serviceWorker.controller));await q.goto(origin+'/offline.html');await q.waitForSelector('.trip-card');
 assert.match(await q.locator('#saved').innerText(),/kopja ende nuk u ruajt/);
 assert.equal(await q.evaluate(async()=>(await fetch('/api/udhetimet')).headers.get('x-rideshare-saved-at')),null);
 await quota.setOffline(true);await q.reload();await waitFor(q,()=>document.querySelector('#source')?.textContent.includes('Ende nuk ka listë'));await quota.close();
 console.log('Week 6 storage quota: network data remains readable and never falsely claims an offline snapshot was saved.');

}finally{if(browser)await browser.close();if(server){const stopped=once(server,'exit');server.kill('SIGTERM');await stopped;}await rm(fixture,{recursive:true,force:true});}
