import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
let server: Server;
let origin: string;
const root=path.resolve(process.cwd(),'..');
test.beforeAll(async()=>{
 server=createServer(async(req,res)=>{
  try{
   let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url!,'http://localhost').pathname));
   if(file!==root && !file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
   if((await stat(file)).isDirectory())file=path.join(file,'index.html');
   const types:Record<string,string>={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
   res.setHeader('content-type',types[path.extname(file)]||'application/octet-stream');
   res.end(await readFile(file));
  }catch{res.writeHead(404).end();}
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();if(!address||typeof address==='string')throw new Error('No test port');
 origin=`http://127.0.0.1:${address.port}`;
});
test.afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});
for(const width of [320,375,430,1280]){
 test(`course navigation and reading at ${width}px`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:812});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const base='/lendet/2026-2027/mobile/';
  for(const route of ['',base,base+'java-02/',base+'java-03/',base+'dorezimet.html',base+'nis-projektin.html']){
   const response=await page.goto(origin+(route||'/'));
   expect(response?.status()).toBe(200);
   expect(await page.locator('h1').count()).toBe(1);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.goto(origin+base);
  await page.getByRole('link',{name:'Hap javën 2 →',exact:true}).click();
  await page.getByRole('link',{name:'Fillo ushtrimet · hap pas hapi',exact:true}).click();
  await expect(page.locator('.step')).toHaveCount(12);
  expect(await page.locator('.step:visible').count()).toBe(width<768?12:1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:testInfo.outputPath(`exercise-${width}.png`)});
  if(width<768)await page.getByRole('button',{name:'Hap në projektor',exact:true}).click();
  await expect(page.locator('#counter')).toHaveText('1 / 12');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#counter')).toHaveText('2 / 12');
  await page.keyboard.press('Escape');
  await expect(page.locator('.step:visible')).toHaveCount(12);
  expect(errors).toEqual([]);
 });
}

for(const width of [375,1280]){
 test(`week 3 student can follow the lab and find GitHub feedback at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:812});
  const base='/lendet/2026-2027/mobile/java-03/';
  await page.goto(origin+base);
  await page.getByRole('link',{name:'Fillo ushtrimet · 90 minuta'}).click();
  await expect(page.getByRole('heading',{name:'1. Hap projektin · 0–10 min'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'5. Merr përgjigjen e GitHub-it · 70–90 min'})).toBeVisible();
  await page.getByRole('link',{name:'udhetimet.ts'}).click();
  await expect(page).toHaveURL(/#hapi-a$/);
  await expect(page.getByRole('heading',{name:'Hapi A · të dhënat e njëjta për të gjitha faqet'})).toBeVisible();
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await page.getByRole('button',{name:'Kopjo kodin · src/lib/udhetimet.ts',exact:true}).click();
  await expect(page.locator('#hapi-a [role="status"]')).toContainText('U kopjua');
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toEqual(await page.locator('#hapi-a pre code').textContent());
  for(const [from,to] of [['a','b'],['b','c'],['c','f'],['f','d'],['d','e'],['e','g']]){
   await page.locator('#hapi-'+from).getByRole('link',{name:'Vazhdo te hapi '+to.toUpperCase()+' →'}).click();
   await expect(page).toHaveURL(new RegExp('#hapi-'+to+'$'));
  }
  await expect(page.getByRole('heading',{name:'Hapi G · ndihmoje përdoruesin kur ID mungon'})).toBeVisible();
  await page.locator('#hapi-g').getByRole('link',{name:'Kalo te provat dhe raporti →'}).click();
  await expect(page).toHaveURL(/#ora-4$/);
  await expect(page.getByRole('link',{name:'Dorëzo punën · Java 3'})).toHaveAttribute('href',/issues\/new\?template=mobile-submission\.yml/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 });
 test(`week 3 lecture and lab presentation stay navigable at ${width}px`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:812});
  const base='/lendet/2026-2027/mobile/java-03/';
  await page.goto(origin+base);
  await page.getByRole('link',{name:'Hap prezantimin',exact:true}).click();
  await expect(page.locator('.step')).toHaveCount(18);
  if(width<768)await page.getByRole('button',{name:'Hap në projektor',exact:true}).click();
  await expect(page.locator('#counter')).toHaveText('1 / 18');
  await page.screenshot({path:testInfo.outputPath(`lecture-cover-${width}.png`)});
  await expect(page.locator('.route-flow li')).toHaveCount(3);
  await expect(page.locator('.mini-trip')).toHaveCount(3);
  await expect(page.locator('.decision-branches > div')).toHaveCount(2);
  for(let slide=2;slide<=18;slide++){
   await page.keyboard.press('ArrowRight');
   await expect(page.locator('#counter')).toHaveText(`${slide} / 18`);
   const reveal=page.locator('.step:visible .reveal');
   if(await reveal.count()){
    const answer=page.locator('#'+await reveal.getAttribute('aria-controls'));
    await expect(answer).toBeHidden();
    await reveal.click();
    await expect(answer).toBeVisible();
    await expect(reveal).toHaveAttribute('aria-expanded','true');
    await expect(page.locator('#counter')).toHaveText(`${slide} / 18`);
    await reveal.click();
    await expect(answer).toBeHidden();
    await expect(reveal).toHaveAttribute('aria-expanded','false');
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
   if(width===1280 && [3,5,6,10,17,18].includes(slide))await page.screenshot({path:testInfo.outputPath(`lecture-flow-${slide}.png`)});
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.emulateMedia({media:'print'});
  for(const id of ['answer-choice','answer-404','answer-route'])await expect(page.locator('#'+id)).toBeVisible();
  await page.emulateMedia({media:'screen'});
  await page.goto(origin+base);
  await page.getByRole('link',{name:'Prezantimi për projektor',exact:true}).click();
  await expect(page.locator('.step')).toHaveCount(12);
  if(width<768)await page.getByRole('button',{name:'Hap në projektor',exact:true}).click();
  await expect(page.locator('#counter')).toHaveText('1 / 12');
  for(let slide=2;slide<=12;slide++){
   await page.keyboard.press('ArrowRight');
   await expect(page.locator('#counter')).toHaveText(`${slide} / 12`);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
   if(width===1280 && [6,8,11].includes(slide))await page.screenshot({path:testInfo.outputPath(`lab-step-${slide}.png`)});
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 });
 test(`RideShare demonstration explains both roles and outcomes at ${width}px`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:812});
  await page.goto(origin+'/lendet/2026-2027/mobile/demo/rideshare/');
  await page.getByRole('button',{name:'Shiko udhëtimin →',exact:true}).click();
  await page.getByRole('button',{name:'Kërko 1 vend',exact:true}).click();
  await expect(page.getByText('Në pritje',{exact:true})).toBeVisible();
  await expect(page.getByText('Vende të lira: 2',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Trego anën e shoferit →',exact:true}).click();
  await expect(page.locator('#role')).toHaveText('Tani po sheh: Dreni · Shofer');
  await page.getByRole('button',{name:'Prano kërkesën',exact:true}).click();
  await expect(page.getByText('Vendi u konfirmua',{exact:true})).toBeVisible();
  await expect(page.getByText('Vende të lira: 1',{exact:true})).toBeVisible();
  await expect(page.locator('#role')).toHaveText('Tani po sheh: Arta · Udhëtare');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:testInfo.outputPath(`demo-${width}.png`),fullPage:true});
  await page.getByRole('button',{name:'Nise nga fillimi',exact:true}).click();
  await page.getByRole('button',{name:'Shiko udhëtimin →',exact:true}).click();
  await page.getByRole('button',{name:'Kërko 1 vend',exact:true}).click();
  await page.getByRole('button',{name:'Trego anën e shoferit →',exact:true}).click();
  await page.getByRole('button',{name:'Refuzo kërkesën',exact:true}).click();
  await expect(page.getByText('Kërkesa u refuzua',{exact:true})).toBeVisible();
  await expect(page.getByText('Vende të lira: 2',{exact:true})).toBeVisible();
  await page.getByText('Provo edhe rastin kur nuk ka vende',{exact:true}).click();
  await page.getByRole('button',{name:'Shfaq udhëtimin me 0 vende',exact:true}).click();
  await expect(page.getByRole('button',{name:'Nuk ka vende të lira',exact:true})).toBeDisabled();
 });
}

for(const width of [320,375,1280]){
 test(`week 3 RideShare demo teaches cards, routes, pending and 404 at ${width}px`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:812});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/lendet/2026-2027/mobile/java-03/');
  await page.getByRole('link',{name:'Hap demonstrimin e Javës 3 · tri karta dhe 404'}).click();
  await expect(page.locator('.trip-card')).toHaveCount(3);
  await expect(page.locator('.arrow-note')).toHaveCount(2);
  await page.screenshot({path:testInfo.outputPath(`week03-list-${width}.png`),fullPage:true});
  await page.locator('[data-trip-id="2"]').getByRole('link',{name:'Shiko detajet →'}).click();
  await expect(page.locator('#route-label')).toHaveText('/udhetimi/2');
  await expect(page.getByText('Te stacioni kryesor')).toBeVisible();
  await page.getByRole('link',{name:'Kërko vend →'}).click();
  await expect(page.getByRole('heading',{name:'Simulim: Në pritje'})).toBeVisible();
  await expect(page.getByText('Kjo kërkesë nuk është dërguar te shoferi. Nuk ka rezervim real.')).toBeVisible();
  await page.getByRole('link',{name:'Zgjidh një udhëtim tjetër'}).click();
  await page.locator('[data-trip-id="3"]').getByRole('link',{name:'Shiko detajet →'}).click();
  await expect(page.getByRole('button',{name:'Nuk ka vende të lira'})).toBeDisabled();
  await page.getByLabel('Adresa e udhëtimit').fill('/udhetimi/99');
  await page.getByRole('button',{name:'Hap adresën'}).click();
  await expect(page.getByRole('heading',{name:'Udhëtimi nuk u gjet'})).toBeVisible();
  await expect(page.locator('#route-label')).toHaveText('/udhetimi/99');
  await page.reload();
  await expect(page.getByRole('heading',{name:'Udhëtimi nuk u gjet'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  expect(errors).toEqual([]);
  await page.screenshot({path:testInfo.outputPath(`week03-demo-${width}.png`),fullPage:true});
 });
}

for(const width of [375,1280]){
 test(`week 4 Neon guide and both presentations at ${width}px`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:width===1280?720:812});
  const base='/lendet/2026-2027/mobile/java-04/';
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+base);
  await expect(page.getByRole('link',{name:'Hap prezantimin',exact:true})).toHaveAttribute('href','prezantimi-ligjerates.html');
  await page.getByRole('link',{name:'Fillo ushtrimet · 90 minuta'}).click();
  await expect(page.locator('[data-example-file]')).toHaveCount(6);
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await page.getByRole('button',{name:'Kopjo kodin · schema.sql',exact:true}).click();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toEqual(await page.locator('#hapi-sql pre code').textContent());
  await expect(page.locator('#ora-6')).toContainText('5/5 kontrolle teknike');
  await expect(page.getByRole('link',{name:'Dorëzo punën · Java 4'})).toHaveAttribute('href',/week=Java%204/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  for(const [deck,count] of [['prezantimi-ligjerates.html',19],['prezantimi-ushtrimeve.html',13]] as const){
   await page.goto(origin+base+deck);
   await expect(page.locator('.step')).toHaveCount(count);
   await expect(page.locator('.ecosystem img')).toHaveCount(1);
   if(width<768)await page.getByRole('button',{name:'Hap në projektor',exact:true}).click();
   for(let slide=1;slide<=count;slide++){
    if(slide>1)await page.keyboard.press('ArrowRight');
    await expect(page.locator('#counter')).toHaveText(`${slide} / ${count}`);
    const visible=page.locator('.step:visible');
    await expect(visible).toHaveCount(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const choose=visible.locator('.choose-trip');if(await choose.count()){await choose.click();await expect(choose).toHaveAttribute('aria-pressed','true');}
    const quiz=visible.locator('.quiz');
    if(await quiz.count()){
     const answer=quiz.locator('.quiz-answer'),revealQuiz=quiz.getByRole('button',{name:'Zbulo përgjigjen pas diskutimit',exact:true});
     await expect(revealQuiz).toBeDisabled();
     await quiz.locator('[data-correct="false"]').first().click();
     await expect(quiz.locator('.vote-status')).toContainText('Zgjodhët');await expect(answer).toBeHidden();
     await revealQuiz.click();await expect(answer).toContainText('Krahasoni arsyetimin tuaj');
     await quiz.locator('[data-correct="true"]').click();await expect(answer).toBeHidden();
     await revealQuiz.click();await expect(answer).toContainText('Saktë');
     await quiz.getByRole('button',{name:'Voto përsëri',exact:true}).click();
     await expect(answer).toBeHidden();await expect(revealQuiz).toBeDisabled();
    }
    const reveal=visible.getByRole('button',{name:'Zbulo përgjigjen',exact:true});
    if(await reveal.count()){await reveal.click();await expect(visible.locator('.answer')).toBeVisible();if(width===1280&&await visible.locator('.ecosystem').count()){const answer=await visible.locator('.answer').boundingBox();const controls=await page.locator('#controls').boundingBox();expect(answer!.y+answer!.height).toBeLessThan(controls!.y);}await reveal.click();}
    if(width===1280 && [1,5,10,14].includes(slide))await page.screenshot({path:testInfo.outputPath(`week04-${deck}-${slide}.png`)});
   }
   await page.keyboard.press('Escape');await expect(page.locator('.step:visible')).toHaveCount(count);
  }
  expect(errors).toEqual([]);
 });
}
