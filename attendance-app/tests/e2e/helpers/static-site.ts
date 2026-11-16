import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
export async function staticSite() {
  const root=path.resolve(process.cwd(),'..');
  const server=createServer(async(req,res)=>{
    try {
      let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url!,'http://localhost').pathname));
      if(file!==root && !file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
      if((await stat(file)).isDirectory())file=path.join(file,'index.html');
      const types:Record<string,string>={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
      res.setHeader('content-type',types[path.extname(file)]??'application/octet-stream');res.end(await readFile(file));
    }catch{res.writeHead(404).end();}
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address||typeof address==='string')throw new Error('No static test port');
  return { origin:`http://127.0.0.1:${address.port}`,close:()=>new Promise<void>(resolve=>server.close(()=>resolve())) };
}
