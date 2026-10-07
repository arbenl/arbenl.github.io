// Instructor example only. Real Neon driver/SQL, bridged to disposable local PostgreSQL.
// No student code runs and no cloud credentials are accessed by this harness.
import {mkdtemp,readFile,writeFile,mkdir,symlink,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn,execFile} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {promisify} from 'node:util';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import {chromium} from '@playwright/test';
const exec=promisify(execFile),app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(app);
const fixture=await mkdtemp(path.join(tmpdir(),'aab-week04-')),container='aab-week04-'+process.pid;
const labPassword=randomUUID();
const driverUrl=new URL('postgresql://fake.neon.tech/lab?sslmode=require');driverUrl.username='lab';driverUrl.password=labPassword;
let db,proxy,browser,server,containerStarted=false;
const decode=s=>s.replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&amp;','&');
async function stop(){if(server){const stopped=once(server,'exit');server.kill('SIGTERM');await stopped;server=undefined;}}
try {
 const files=new Map();
 for(const week of ['03','04']){
  const html=await readFile(path.join(root,`materials/week-${week}/ushtrimet.html`),'utf8');
  for(const [,file,section] of html.matchAll(/<section\b[^>]*data-example-file="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)){
   assert.ok(!file.includes('..'));files.set(file,decode(section.match(/<pre><code>([\s\S]*?)<\/code><\/pre>/)[1]));
  }
 }
 for(const [file,code]of files){const target=path.join(fixture,file);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,code);}
 await exec('docker',['run','--detach','--rm','--name',container,'--publish','127.0.0.1::5432','--env','POSTGRES_PASSWORD='+labPassword,'--env','POSTGRES_DB=lab','postgres:16-alpine']);containerStarted=true;
 const {stdout}=await exec('docker',['port',container,'5432/tcp']);const dbPort=stdout.trim().split(':').at(-1);assert.match(dbPort,/^\d+$/);
 const databaseUrl=new URL('postgresql://127.0.0.1/lab');databaseUrl.port=dbPort;databaseUrl.username='postgres';databaseUrl.password=labPassword;
 db=postgres(databaseUrl.href,{onnotice:()=>{}});
 for(let i=0;i<50;i++){try{await db`SELECT 1`;break;}catch{if(i===49)throw Error('Database not ready');await new Promise(r=>setTimeout(r,200));}}
 await db.unsafe(files.get('schema.sql'));await db.unsafe(files.get('schema.sql'));assert.equal((await db`SELECT * FROM udhetimet`).length,3);
 await assert.rejects(db`UPDATE udhetimet SET vende = -1 WHERE id = '2'`);
 await assert.rejects(db`INSERT INTO udhetimet SELECT * FROM udhetimet WHERE id = '2'`);
 let empty=false,unavailable=false;const queries=[];
 proxy=createServer(async(req,res)=>{
  try{
   if(unavailable){res.writeHead(503).end('Test outage');return;}
   let text='';for await(const chunk of req)text+=chunk;
   const {query,params}=JSON.parse(text);queries.push({query,params});
   const result=await db.unsafe(query,params),cols=result.columns;
   res.setHeader('content-type','application/json');res.end(JSON.stringify({fields:cols.map(c=>({name:c.name,dataTypeID:c.type})),rows:empty&&/ORDER BY id/.test(query)?[]:result.map(r=>cols.map(c=>r[c.name]===null?null:String(r[c.name]))),rowCount:result.count,command:result.command}));
  }catch(e){res.writeHead(400,{'content-type':'application/json'}).end(JSON.stringify({message:e.message}));}
 });
 await new Promise(r=>proxy.listen(0,'127.0.0.1',r));const endpoint=`http://127.0.0.1:${proxy.address().port}/sql`;
 const pkg=JSON.parse(await readFile(path.join(app,'package.json'),'utf8'));
 await writeFile(path.join(fixture,'package.json'),JSON.stringify({private:true,scripts:{dev:'next dev',build:'next build'},dependencies:Object.fromEntries(['next','react','react-dom'].map(k=>[k,pkg.dependencies[k]])),devDependencies:Object.fromEntries(['typescript','@types/node','@types/react','@types/react-dom'].map(k=>[k,pkg.devDependencies[k]]))}));
 await writeFile(path.join(fixture,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2017',lib:['dom','dom.iterable','esnext'],strict:true,noEmit:true,skipLibCheck:true,esModuleInterop:true,module:'esnext',moduleResolution:'bundler',resolveJsonModule:true,isolatedModules:true,jsx:'preserve',plugins:[{name:'next'}],paths:{'@/*':['./src/*']}},include:['next-env.d.ts','**/*.ts','**/*.tsx','.next/types/**/*.ts'],exclude:['node_modules']}));
 // Externalize only in this test so the actual driver uses the local HTTP bridge.
 await writeFile(path.join(fixture,'next.config.mjs'),`export default {outputFileTracingRoot:${JSON.stringify(fixture)},serverExternalPackages:['@neondatabase/serverless']};`);
 await writeFile(path.join(fixture,'src/app/layout.tsx'),'import "./globals.css"; import type {ReactNode} from "react"; export default function Layout({children}:{children:ReactNode}) { return <html lang="sq"><body>{children}</body></html>; }');
 await symlink(path.join(app,'node_modules'),path.join(fixture,'node_modules'),'dir');
 const preloader=path.join(fixture,'driver-test-config.mjs');await writeFile(preloader,`import {neonConfig} from ${JSON.stringify(path.join(app,'node_modules/@neondatabase/serverless/index.mjs'))};neonConfig.fetchEndpoint=${JSON.stringify(endpoint)};`);
 const next=path.join(app,'node_modules/next/dist/bin/next');
 const build=spawn(process.execPath,[next,'build','--webpack'],{cwd:fixture,env:{...process.env,DATABASE_URL:'',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});let log='';build.stdout.on('data',b=>log+=b);build.stderr.on('data',b=>log+=b);const timer=setTimeout(()=>build.kill('SIGTERM'),120000);const [exit]=await once(build,'exit');clearTimeout(timer);assert.equal(exit,0,log);
 console.log('Week 4 published code compiles without a build-time database connection.');
 const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const origin=`http://127.0.0.1:${port}`;
 async function start(configured=true){server=spawn(process.execPath,['--import',preloader,next,'start','--hostname','127.0.0.1','--port',String(port)],{cwd:fixture,env:{...process.env,DATABASE_URL:configured?driverUrl.href:'',NEXT_TELEMETRY_DISABLED:'1'},stdio:'ignore'});for(let i=0;i<60;i++){try{if((await fetch(origin)).ok)break;}catch{}if(i===59)throw Error('Server not ready');await new Promise(r=>setTimeout(r,250));}}
 await start();browser=await chromium.launch();await mkdir(path.join(app,'test-results'),{recursive:true});
 for(const width of [375,1280]){
  const page=await browser.newPage({viewport:{width,height:812}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);assert.equal(await page.locator('.trip-card').count(),3);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width);
  await db`UPDATE udhetimet SET ora = '08:25' WHERE id = '2'`;await page.reload();assert.match(await page.locator('.trip-card').nth(1).innerText(),/08:25/);
  await page.locator('.trip-card').nth(1).getByRole('link',{name:'Shiko detajet'}).click();await page.waitForURL('**/udhetimi/2');assert.ok(await page.getByText('Ora: 08:25',{exact:true}).isVisible());
  await page.getByRole('link',{name:'Kërko vend'}).click();await page.waitForURL('**/udhetimi/2/kerkesa');assert.ok(await page.getByRole('heading',{name:'Simulim: Në pritje'}).isVisible());
  await page.goto(origin+'/udhetimi/3');assert.ok(await page.getByRole('button',{name:'Nuk ka vende të lira'}).isDisabled());
  await page.goto(origin+'/udhetimi/3/kerkesa');assert.ok(await page.getByRole('heading',{name:'Nuk ka vende të lira.'}).isVisible());
  await page.goto(origin+'/udhetimi/99');assert.ok(await page.getByRole('heading',{name:'Udhëtimi nuk u gjet'}).isVisible());
  await page.goto(origin+'/udhetimi/'+encodeURIComponent("2' OR '1'='1"));assert.ok(await page.getByRole('heading',{name:'Udhëtimi nuk u gjet'}).isVisible());assert.ok(queries.some(q=>q.params.some(v=>decodeURIComponent(v)==="2' OR '1'='1")&&!q.query.includes("OR '1'")));
  empty=true;await page.goto(origin);assert.ok(await page.getByText('Nuk ka udhëtime për momentin.',{exact:true}).isVisible());assert.equal(await page.locator('.trip-card').count(),0);empty=false;
  unavailable=true;await page.reload();assert.ok(await page.locator('p[role="alert"]').isVisible());assert.ok(!(await page.content()).includes(labPassword));unavailable=false;
  await page.getByRole('link',{name:'Provo përsëri'}).click();await page.waitForLoadState('networkidle');assert.equal(await page.locator('.trip-card').count(),3);
  await db`UPDATE udhetimet SET ora = '08:15' WHERE id = '2'`;await page.goto(origin+'/udhetimi/2');assert.ok(await page.getByText('Ora: 08:15',{exact:true}).isVisible());assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(app,'test-results/week04-app-'+width+'.png')});await page.close();console.log('Week 4 at '+width+'px: SQL updates, consistent details, simulation, zero seats, unknown ID, parameterization, empty state, outage and recovery passed.');
 }
 await stop();await start(false);const page=await browser.newPage();await page.goto(origin);assert.ok(await page.locator('p[role="alert"]').isVisible());console.log('Missing DATABASE_URL handled without exposing credentials.');
}finally{
 if(browser)await browser.close();await stop();if(proxy)await new Promise(r=>proxy.close(r));if(db)await db.end();if(containerStarted)await exec('docker',['rm','--force',container]);await rm(fixture,{recursive:true,force:true});
}
