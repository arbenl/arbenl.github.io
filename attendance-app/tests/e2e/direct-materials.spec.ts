import {expect,test} from '@playwright/test';
import {staticSite} from './helpers/static-site';
test('direct material-source URLs load canonical styles and scripts without missing resources',async({page},info)=>{
 const site=await staticSite();const failures:string[]=[];
 try {
  page.on('response',r=>{if(r.url().startsWith(site.origin)&&r.status()===404&&!r.url().endsWith('/favicon.ico'))failures.push(new URL(r.url()).pathname);});
  for(const path of ['/materials/week-03/ushtrimet.html','/materials/week-05/prezantimi-ligjerates.html','/materials/week-06/prezantimi-ligjerates.html','/materials/week-08/testimi-automatik.html']){
   expect((await page.goto(site.origin+path))?.status()).toBe(200);
   expect(await page.evaluate(()=>document.baseURI)).toContain('/lendet/2026-2027/mobile/java-');
  }
  expect(failures).toEqual([]);
  await page.screenshot({path:info.outputPath('06-direct-materials.png')});
 }finally{await site.close();}
});
