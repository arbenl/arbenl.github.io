import { readdir,readFile,writeFile,access } from 'node:fs/promises';
let count=0;
for(const directory of await readdir('materials',{withFileTypes:true})) {
  if(!directory.isDirectory() || !/^week-\d{2}$/.test(directory.name))continue;
  const week=directory.name.slice(-2);
  for(const name of await readdir(`materials/${directory.name}`)) {
    if(!name.endsWith('.html'))continue;
    const source=`materials/${directory.name}/${name}`;
    const canonical=`lendet/2026-2027/mobile/java-${week}/${name}`;
    const html=await readFile(source,'utf8');
    if(!/<head[\s>]/i.test(html))continue;
    const prepare=value=>/<base\s/i.test(value) ? value : value.replace(/<head(\s[^>]*)?>/i,match=>`${match}<base href="/${canonical}">`);
    await writeFile(source,prepare(html));
    try { await access(canonical);await writeFile(canonical,prepare(await readFile(canonical,'utf8'))); } catch(error) { if(error.code!=='ENOENT')throw error; }
    count++;
  }
}
console.log(`Prepared ${count} canonical teaching-source entry points.`);
