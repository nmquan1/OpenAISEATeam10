import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { recommend } from '../server/recommend.mjs';
try { process.loadEnvFile('.env'); } catch(e) { if(e.code!=='ENOENT')throw e; }
const root=resolve('.'), port=Number(process.env.PORT)||4173;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.md':'text/plain; charset=utf-8'};
let busy=false;
export const server=http.createServer(async(req,res)=>{
 const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(data));};
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/api/recommend'){
   if(req.method!=='POST')return json(405,{error:'POST required'});
   if(req.headers.origin && ![`http://localhost:${port}`,`http://127.0.0.1:${port}`].includes(req.headers.origin))return json(403,{error:'Origin denied'});
   if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{error:'JSON required'});
   if(busy)return json(429,{error:'Một request AI đang chạy. Chờ hoàn tất.'});
   busy=true;
   try{
    let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>32768)return json(413,{error:'Input too large'});}
    const result=await recommend(JSON.parse(body));return json(200,result);
   }catch(e){return json(400,{error:e.name==='TimeoutError'?'AI timeout; thử lại.':e.message});}finally{busy=false;}
  }
  // Explicit allowlist: credentials, repository metadata and backend never become static assets.
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
  const file=path==='/'?'index.html':path.slice(1);
  if(!/^(index\.html|src\/[a-zA-Z0-9_-]+\.(js|css)|docs\/[a-zA-Z0-9_-]+\.md)$/.test(file)){res.writeHead(404).end();return;}
  const body=await readFile(resolve(root,file));res.writeHead(200,{'Content-Type':types[extname(file)],'X-Content-Type-Options':'nosniff'}).end(req.method==='HEAD'?undefined:body);
 }catch{res.writeHead(404).end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Market Maker: http://localhost:${port}`));
