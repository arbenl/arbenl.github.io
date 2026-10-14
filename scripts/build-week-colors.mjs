import {readFile,writeFile,readdir} from 'node:fs/promises';
const base='lendet/2026-2027/mobile';
async function color(dir,week){for(const entry of await readdir(dir,{withFileTypes:true})){const file=dir+'/'+entry.name;if(entry.isDirectory())await color(file,week);else if(entry.name.endsWith('.html')){let html=await readFile(file,'utf8');if(!html.includes('/assets/week-colors.css'))html=html.replace('</head>','<link rel="stylesheet" href="/assets/week-colors.css"></head>');if(!/<body[^>]*data-week=/.test(html))html=html.replace('<body',`<body data-week="${week}"`);await writeFile(file,html);}}}
for(let week=1;week<=15;week++)await color(`${base}/java-${String(week).padStart(2,'0')}`,week);
const file=base+'/index.html';let html=await readFile(file,'utf8');if(!html.includes('/assets/week-colors.css'))html=html.replace('</head>','<link rel="stylesheet" href="/assets/week-colors.css"></head>');await writeFile(file,html);
console.log('Applied numbered weekly color accents without changing navigation.');
