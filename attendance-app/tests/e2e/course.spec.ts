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
