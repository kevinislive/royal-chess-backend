import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { newGame, playMove, claimDraw, resign, gameStatus } from './chess.mjs';
import { createGame } from './arena.mjs';
import {allowedOrigin} from './http-origin.mjs';
import { normalizeChat, moderate } from './platform.mjs';
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const fail=(status,message)=>Object.assign(new Error(message),{status});
const token=()=>randomBytes(24).toString('hex');
export function createLanHandler(platform=null){
  const rooms=new Map(), limits=new Map();
  const ready=r=>Object.values(r.seats).every(Boolean);
  const activeSeat=r=>r.game.position.turn+(r.team&&Math.floor(r.game.moves.length/2)%2?'2':'');
  const sideOf=c=>c[0];
  const variant=d=>d.variant==='shuffle'?'shuffle':'classic';
  const teamMode=d=>d.team===true;
  const timeControl=d=>[0,3,5,10].includes(Number(d.minutes))?Number(d.minutes):0;
  const cleanName=x=>String(x||'Guest').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,24)||'Guest';
  const clockView=r=>{if(!r.clock)return null;const c={...r.clock};if(c.started&&!r.game.result)c[r.game.position.turn]=Math.max(0,c[r.game.position.turn]-(Date.now()-c.started));return {w:c.w,b:c.b};};
  const stopClock=r=>{if(r.clock?.started){const c=clockView(r);Object.assign(r.clock,c,{started:0});}};
  const timeout=r=>{if(!r.clock?.started||r.game.result)return false;const c=clockView(r),turn=r.game.position.turn;if(c[turn]>0)return false;Object.assign(r.clock,c,{started:0});r.game={...r.game,result:(turn==='w'?'Black':'White')+' wins on time (casual clock rule)'};publish(r);return true;};
  const beginClock=r=>{if(r.minutes)r.clock={w:r.minutes*60000,b:r.minutes*60000,started:ready(r)?Date.now():0};};
  const view=r=>({code:r.code,game:r.game,revision:r.revision,ready:ready(r),rematch:r.rematch,public:r.public,minutes:r.minutes,round:r.round,names:r.names,chat:r.chat,clock:clockView(r),team:r.team,variant:r.variant,activeSeat:activeSeat(r),players:Object.keys(r.seats).map(c=>({seat:c,name:r.names[c]})),rated:r.rated});
  const write=(res,r)=>res.write('data: '+JSON.stringify(view(r))+'\n\n');
  const publish=r=>{if(platform&&r.rated&&ready(r)&&gameStatus(r.game).over){const text=gameStatus(r.game).text;platform.recordMatch({id:r.id+':'+r.round,w:r.users.w,b:r.users.b,result:text.startsWith('White')?1:text.startsWith('Black')?0:.5,moves:r.game.moves});}r.revision++;r.touched=Date.now();for(const res of r.streams)write(res,r);};
  const getRoom=code=>{const r=rooms.get(String(code||'').toUpperCase());if(!r)throw fail(404,'Room not found. Check the code or create a new room.');return r;};
  const seat=(r,t)=>{const c=Object.keys(r.seats).find(c=>r.seats[c]&&r.seats[c]===t);if(!c)throw fail(403,'Invalid player session.');return c;};
  const session=(r,c)=>({code:r.code,color:sideOf(c),seat:c,token:r.seats[c],state:view(r)});
  function prune(){const now=Date.now();for(const [code,r] of rooms){timeout(r);if(!r.streams.size&&now-r.touched>(ready(r)?6*60*60*1000:120000))rooms.delete(code);}for(const [ip,l] of limits)if(now-l.start>60000)limits.delete(ip);}
  function create(d,isPublic,u){if(rooms.size>=200)throw fail(503,'Too many rooms. Try again later.');let code;do{code=Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');}while(rooms.has(code));const team=teamMode(d),rated=!!(isPublic&&!team&&variant(d)==='classic'&&u&&d.rated),seats=team?{w:token(),b:null,w2:null,b2:null}:{w:token(),b:null};const r={id:randomUUID(),code,game:createGame(variant(d)),revision:0,seats,users:{w:u?.id||null},team,variant:variant(d),rated,rematch:[],streams:new Set(),touched:Date.now(),public:isPublic,minutes:timeControl(d),names:{w:u?.name||cleanName(d.name)},chat:[],signals:[],clock:null,round:0};rooms.set(code,r);beginClock(r);return r;}
  function join(r,d,u){const c=Object.keys(r.seats).find(c=>!r.seats[c]);if(!c)throw fail(409,'Room is full.');if(r.rated&&!u)throw fail(401,'Sign in for rated matches.');if(u&&Object.values(r.users).includes(u.id))throw fail(409,'Account already in this room.');r.seats[c]=token();r.users[c]=u?.id||null;r.names[c]=u?.name||cleanName(d.name);beginClock(r);publish(r);return session(r,c);}
  const interval=setInterval(prune,1000);interval.unref();
  function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
  async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)throw fail(413,'Request too large.');}let data;try{data=JSON.parse(raw||'{}');}catch{throw fail(400,'Invalid JSON.');}if(!data||typeof data!=='object'||Array.isArray(data))throw fail(400,'Invalid request.');return data;}
  return async function lan(req,res,url){
    try{
      prune();const route=url.pathname;
      // Authenticated polling has a separate per-seat budget so players behind a
      // shared cloud proxy do not exhaust its ordinary IP request quota.
      if(req.method==='POST'&&route==='/lan/state'){
        if(!allowedOrigin(req))throw fail(403,'Cross-origin requests are not allowed.');
        const d=await body(req),r=getRoom(d.code),watch=d.watch===true;
        if(watch){if(!r.public)throw fail(403,'Private rooms cannot be spectated.');}
        else{const c=seat(r,d.token);if(r.users[c]&&platform?.isBanned(r.users[c]))throw fail(403,'Account suspended.');}
        const key='state:'+r.code+':'+(watch?(req.socket.remoteAddress||'unknown'):d.token),now=Date.now();let rate=limits.get(key);if(!rate||now-rate.start>=60000){rate={start:now,count:0};limits.set(key,rate);}if(++rate.count>(watch?240:90))throw fail(429,'Too many updates.');
        if(!watch)r.touched=now;return json(res,200,view(r));
      }
      const peer=req.socket.remoteAddress||'unknown',ip=process.env.TRUST_LOCAL_PROXY==='1'&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer)?String(req.headers['x-forwarded-for']||peer).split(',').at(-1).trim():peer,now=Date.now();let rate=limits.get(ip);if(!rate||now-rate.start>=60000){rate={start:now,count:0};limits.set(ip,rate);}if(++rate.count>240)throw fail(429,'Too many requests. Try again in a minute.');
      if(req.method==='GET'&&route==='/lan/lobby')return json(res,200,[...rooms.values()].filter(r=>r.public).map(r=>({code:r.code,ready:ready(r),minutes:r.minutes,names:r.names,over:gameStatus(r.game).over,team:r.team,variant:r.variant,rated:r.rated})));
      if(req.method==='GET'&&route==='/lan/events'){
        const r=getRoom(url.searchParams.get('code'));if(url.searchParams.get('watch')!=='1')seat(r,url.searchParams.get('token'));else if(!r.public)throw fail(403,'Private rooms cannot be spectated without a player session.');if(r.streams.size>=24)throw fail(429,'Room viewer limit reached.');
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();r.streams.add(res);r.touched=Date.now();write(res,r);
        const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),15000);heartbeat.unref();res.on('close',()=>{clearInterval(heartbeat);r.streams.delete(res);r.touched=Date.now();});return;
      }
      if(req.method!=='POST')throw fail(405,'Method not allowed.');
      if(!allowedOrigin(req))throw fail(403,'Cross-origin requests are not allowed.');
      const d=await body(req),u=platform?.user(req);if(u?.banned)throw fail(403,'Account suspended.');
      if(route==='/lan/create')return json(res,200,session(create(d,false,u),'w'));
      if(route==='/lan/match'){const rated=!!d.rated;if(rated&&(!u||teamMode(d)||variant(d)!=='classic'))throw fail(400,'Rated matchmaking needs a registered account and classic 1v1.');const r=[...rooms.values()].find(r=>r.public&&!ready(r)&&r.minutes===timeControl(d)&&r.team===teamMode(d)&&r.variant===variant(d)&&r.rated===rated&&(!u||!Object.values(r.users).includes(u.id))&&(r.streams.size>0||Date.now()-r.touched<120000));return json(res,200,r?join(r,d,u):session(create(d,true,u),'w'));}
      const r=getRoom(d.code);
      if(route==='/lan/watch'){if(!r.public)throw fail(403,'Private rooms cannot be spectated.');return json(res,200,{code:r.code,color:null,token:null,state:view(r)});}
      if(route==='/lan/join')return json(res,200,join(r,d,u));
      const c=seat(r,d.token);if(r.users[c]&&platform?.isBanned(r.users[c]))throw fail(403,'Account suspended.');timeout(r);
      if(route==='/lan/voice'){if(r.team)throw fail(400,'Voice is available for 1v1 rooms.');const to=c==='w'?'b':'w';if(!r.seats[to])throw fail(409,'Wait for opponent.');const signal=d.signal;if(!signal||!['offer','answer','candidate','hangup'].includes(signal.type)||JSON.stringify(signal).length>6500)throw fail(400,'Invalid voice signal.');r.signals.push({id:randomUUID(),from:c,to,signal,at:Date.now()});r.signals=r.signals.filter(x=>Date.now()-x.at<120000).slice(-100);return json(res,200,{ok:true});}
      if(route==='/lan/voice-poll')return json(res,200,r.signals.filter(x=>x.to===c&&Date.now()-x.at<120000));
      if(route==='/lan/fairplay-report'){if(!platform||!u||r.users[c]!==u.id||!r.rated)throw fail(403,'Fair-play reports require a rated match and signed-in player.');const opponent=c==='w'?'b':'w';platform.report(u.id,r.users[opponent],r.code,'Fair-play review requested: '+r.id+':'+r.round);return json(res,200,view(r));}
      if(route==='/lan/report'){if(!platform||!u||r.users[c]!==u.id)throw fail(401,'Sign in to report.');const msg=r.chat.find(m=>m.id===d.id);if(!msg)throw fail(404,'Message no longer available.');platform.report(u.id,r.users[msg.seat],r.code,msg.text);return json(res,200,view(r));}
      if(route==='/lan/leave'){if(!ready(r)){rooms.delete(r.code);for(const stream of r.streams)stream.end();}else if(!gameStatus(r.game).over){stopClock(r);r.game=resign(r.game,sideOf(c));publish(r);}return json(res,200,{ok:true});}
      if(route==='/lan/chat'){if(platform&&r.public&&(!u||r.users[c]!==u.id))throw fail(401,'Sign in before joining a public room to use chat.');const text=normalizeChat(d.text);if(!text)throw fail(400,'Empty message.');if(!moderate(text))throw fail(400,'Message blocked by chat filter.');if(r.chat.some(m=>m.seat===c&&Date.now()-m.at<1000))throw fail(429,'Please slow down.');r.chat=[...r.chat,{id:randomUUID(),color:sideOf(c),seat:c,text,at:Date.now()}].slice(-40);publish(r);return json(res,200,view(r));}
      if(route==='/lan/resume'){r.touched=Date.now();return json(res,200,session(r,c));}
      if(!ready(r))throw fail(409,'Wait for the other player to join.');
      if(d.revision!==r.revision)throw fail(409,'Position changed. Wait for the latest update and try again.');
      if(route==='/lan/move'){
        if(activeSeat(r)!==c)throw fail(403,'It is not your turn.');
        const next=playMove(r.game,d.move||{});stopClock(r);r.game=next;if(r.clock&&!gameStatus(next).over)r.clock.started=Date.now();r.rematch=[];
      }else if(route==='/lan/claim'){
        if(activeSeat(r)!==c)throw fail(403,'It is not your turn.');const next=claimDraw(r.game);stopClock(r);r.game=next;
      }else if(route==='/lan/resign'){const next=resign(r.game,sideOf(c));stopClock(r);r.game=next;}
      else if(route==='/lan/rematch'){
        if(!gameStatus(r.game).over)throw fail(409,'Finish or resign the current game first.');
        if(!r.rematch.includes(c))r.rematch.push(c);
        if(r.rematch.length===Object.keys(r.seats).length){r.game=createGame(r.variant);r.rematch=[];r.round++;beginClock(r);}
      }else throw fail(404,'Unknown multiplayer endpoint.');
      publish(r);return json(res,200,view(r));
    }catch(e){if(!res.headersSent)json(res,e.status||400,{error:e.message||'Request failed.'});else res.end();}
  };
}
