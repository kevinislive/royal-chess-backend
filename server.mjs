import {createServer} from 'node:http';
import {loadEnvFile} from 'node:process';
import {createPlatform} from './lib/platform.mjs';
import {createLanHandler} from './lib/lan.mjs';
try { loadEnvFile('.env'); } catch(e) { if(e.code!=='ENOENT') throw e; }
const port=Number(process.env.PORT||4000);
const platform=createPlatform(),lan=createLanHandler(platform);
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
const server=createServer(async(req,res)=>{
  try {
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-Frame-Options','DENY');
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/health'))return json(res,200,{ok:true,service:'royal-chess-backend',version:'3.3.0'});
    if(url.pathname.startsWith('/platform/'))return await platform.handle(req,res,url);
    if(url.pathname.startsWith('/lan/'))return await lan(req,res,url);
    return json(res,404,{error:'Unknown API endpoint. Open the frontend URL to play.'});
  }catch(e){console.error(e);if(!res.headersSent)json(res,500,{error:'Internal server error.'});else res.end();}
});
server.headersTimeout=15000;server.requestTimeout=30000;
server.on('error',e=>{console.error(e.message);process.exit(1);});
server.listen(port,'0.0.0.0',()=>console.log(`Royal Chess Backend 3.3 — listening on 0.0.0.0:${server.address().port}`));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{server.close(()=>{platform.db.close();process.exit(0);});server.closeAllConnections();setTimeout(()=>process.exit(1),5000).unref();});
