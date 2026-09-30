// Execute only the instructor's published example, never student submissions.
import {mkdtemp, readFile, writeFile, mkdir, symlink, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.dirname(app);
const source=await readFile(path.join(root,'materials/week-03/ushtrimet.html'),'utf8');
const fixture=await mkdtemp(path.join(tmpdir(),'aab-week03-example-'));
const decode=s=>s.replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&amp;','&');
let server,browser;
try {
 const matches=[...source.matchAll(/<section\b[^>]*data-example-file="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)];
 assert.equal(matches.length,7);
 for(const [,file,section] of matches){
  assert.ok(file.startsWith('src/')&&!file.includes('..'));
  const code=section.match(/<pre><code>([\s\S]*?)<\/code><\/pre>/)?.[1];
  assert.ok(code,'Missing example code for '+file);
  const target=path.join(fixture,file);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,decode(code));
 }
 const existing=JSON.parse(await readFile(path.join(app,'package.json'),'utf8'));
 await writeFile(path.join(fixture,'package.json'),JSON.stringify({name:'instructor-example-test',private:true,scripts:{dev:'next dev',build:'next build'},dependencies:Object.fromEntries(['next','react','react-dom'].map(k=>[k,existing.dependencies[k]])),devDependencies:Object.fromEntries(['typescript','@types/node','@types/react','@types/react-dom'].map(k=>[k,existing.devDependencies[k]]))}));
 await writeFile(path.join(fixture,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2017',lib:['dom','dom.iterable','esnext'],strict:true,noEmit:true,skipLibCheck:true,esModuleInterop:true,module:'esnext',moduleResolution:'bundler',resolveJsonModule:true,isolatedModules:true,jsx:'preserve',plugins:[{name:'next'}],paths:{'@/*':['./src/*']}},include:['next-env.d.ts','**/*.ts','**/*.tsx','.next/types/**/*.ts'],exclude:['node_modules']}));
 await writeFile(path.join(fixture,'next.config.mjs'),`export default {outputFileTracingRoot: ${JSON.stringify(fixture)}};`);
 await writeFile(path.join(fixture,'src/app/layout.tsx'),'import "./globals.css"; import type {ReactNode} from "react"; export default function Layout({children}:{children:ReactNode}) { return <html lang="sq"><body>{children}</body></html>; }');
 await symlink(path.join(app,'node_modules'),path.join(fixture,'node_modules'),'dir');
 const next=path.join(app,'node_modules/next/dist/bin/next');
 const build=spawn(process.execPath,[next,'build','--webpack'],{cwd:fixture,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
 let log='';build.stdout.on('data',b=>log+=b);build.stderr.on('data',b=>log+=b);
 const timer=setTimeout(()=>build.kill('SIGTERM'),120000);const [exit]=await once(build,'exit');clearTimeout(timer);
 assert.equal(exit,0,log);console.log('Published example compiles with Next.js '+existing.dependencies.next+'.');
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 server=spawn(process.execPath,[next,'start','--hostname','127.0.0.1','--port',String(port)],{cwd:fixture,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:'ignore'});
 const origin='http://127.0.0.1:'+port;
 for(let i=0;i<60;i++){try{if((await fetch(origin)).ok)break;}catch{}if(i===59)throw new Error('Example server not ready');await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch();
 for(const width of [375,1280]){
  const page=await browser.newPage({viewport:{width,height:812}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);assert.equal(await page.locator('.trip-card').count(),3);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width);
  await page.locator('.trip-card').nth(1).getByRole('link',{name:'Shiko detajet'}).click();
  await page.waitForURL('**/udhetimi/2');
  assert.equal(new URL(page.url()).pathname,'/udhetimi/2');assert.ok(await page.getByText('Vendtakimi: Te stacioni kryesor').isVisible());
  await page.getByRole('link',{name:'Kërko vend'}).click();
  await page.waitForURL('**/udhetimi/2/kerkesa');
  assert.equal(new URL(page.url()).pathname,'/udhetimi/2/kerkesa');assert.ok(await page.getByRole('heading',{name:'Simulim: Në pritje'}).isVisible());
  await page.getByRole('link',{name:'Kthehu te detajet'}).click();await page.waitForURL('**/udhetimi/2');await page.getByRole('link',{name:'Kthehu te lista'}).click();await page.waitForURL(origin+'/');
  await page.locator('.trip-card').nth(2).getByRole('link',{name:'Shiko detajet'}).click();await page.waitForURL('**/udhetimi/3');assert.ok(await page.getByRole('button',{name:'Nuk ka vende të lira'}).isDisabled());
  await page.goto(origin+'/udhetimi/3/kerkesa');assert.ok(await page.getByRole('heading',{name:'Nuk ka vende të lira.'}).isVisible());assert.equal(await page.getByRole('heading',{name:'Simulim: Në pritje'}).count(),0);
  const missing=await page.goto(origin+'/udhetimi/99');assert.equal(missing.status(),404);assert.ok(await page.getByRole('heading',{name:'Udhëtimi nuk u gjet'}).isVisible());
  await page.getByRole('link',{name:'Kthehu te lista'}).click();await page.waitForURL(origin+'/');assert.equal(await page.locator('.trip-card').count(),3);assert.deepEqual(errors,[]);
  await page.close();console.log('Real Next.js example passed: 3 cards, selection, pending simulation, zero seats, 404 and return at '+width+'px.');
 }
} finally {
 if(browser)await browser.close();
 if(server){const stopped=once(server,'exit');server.kill('SIGTERM');await stopped;}
 await rm(fixture,{recursive:true,force:true});
}
