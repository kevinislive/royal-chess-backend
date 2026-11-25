// Pure chess rules, shared between the browser and authoritative LAN server.
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FILES = 'abcdefgh';
export const opposite = c => c === 'w' ? 'b' : 'w';
export const colorOf = p => !p ? null : p === p.toUpperCase() ? 'w' : 'b';
export const squareName = i => FILES[i % 8] + (8 - Math.floor(i / 8));
export const squareIndex = s => typeof s === 'string' && /^[a-h][1-8]$/.test(s) ? (8-Number(s[1]))*8+FILES.indexOf(s[0]) : -1;
const inside = (r,c) => r>=0&&r<8&&c>=0&&c<8;
const knight = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const bishop = [[-1,-1],[-1,1],[1,-1],[1,1]];
const rook = [[-1,0],[1,0],[0,-1],[0,1]];
const king = [...bishop,...rook];
export function fromFen(fen=START_FEN) {
  const [placement,turn,castling,ep,half='0',full='1'] = fen.split(' ');
  const board = placement.split('/').flatMap(rank => [...rank].flatMap(ch => /[1-8]/.test(ch) ? Array(Number(ch)).fill(null) : [ch]));
  if (board.length!==64 || !['w','b'].includes(turn) || !board.includes('K') || !board.includes('k')) throw Error('Invalid FEN');
  return {board,turn,variant:/[A-Ha-h]/.test(castling)?'960':'classic',castling:castling==='-'?'':castling,ep:squareIndex(ep),half:Number(half),full:Number(full)};
}
export function attacked(s, target, by) {
  const tr=Math.floor(target/8),tc=target%8;
  for(let i=0;i<64;i++) {
    const p=s.board[i]; if(colorOf(p)!==by)continue;
    const r=Math.floor(i/8),c=i%8,type=p.toLowerCase();
    if(type==='p'){if(tr===r+(by==='w'?-1:1)&&Math.abs(tc-c)===1)return true;continue;}
    const dirs=type==='n'?knight:type==='b'?bishop:type==='r'?rook:king;
    for(const [dr,dc] of dirs) for(let rr=r+dr,cc=c+dc;inside(rr,cc);rr+=dr,cc+=dc){
      if(rr===tr&&cc===tc)return true;
      if(s.board[rr*8+cc]||type==='n'||type==='k')break;
    }
  }
  return false;
}
export const inCheck = (s,c=s.turn) => attacked(s,s.board.indexOf(c==='w'?'K':'k'),opposite(c));
function pseudo(s){
  const moves=[], us=s.turn, them=opposite(us), b=s.board;
  for(let from=0;from<64;from++){
    const p=b[from];if(colorOf(p)!==us)continue;
    const r=Math.floor(from/8),c=from%8,type=p.toLowerCase();
    const add=(to,flag='')=>{if(b[to]?.toLowerCase()==='k')return; if(type==='p'&&(to<8||to>=56))for(const promotion of ['q','r','b','n'])moves.push({from,to,promotion,flag});else moves.push({from,to,promotion:'',flag});};
    if(type==='p'){
      const d=us==='w'?-1:1, rr=r+d;
      if(inside(rr,c)&&!b[rr*8+c]){add(rr*8+c);if(r===(us==='w'?6:1)&&!b[(r+2*d)*8+c])add((r+2*d)*8+c);}
      for(const cc of [c-1,c+1])if(inside(rr,cc)){const to=rr*8+cc;if(colorOf(b[to])===them)add(to);else if(to===s.ep&&!b[to]&&b[r*8+cc]===(us==='w'?'p':'P'))add(to,'ep');}
    }else{
      const dirs=type==='n'?knight:type==='b'?bishop:type==='r'?rook:king;
      for(const [dr,dc] of dirs)for(let rr=r+dr,cc=c+dc;inside(rr,cc);rr+=dr,cc+=dc){const to=rr*8+cc;if(colorOf(b[to])===us)break;add(to);if(b[to]||type==='n'||type==='k')break;}
      if(type==='k'&&!inCheck(s)){
        const base=us==='w'?56:0, R=us==='w'?'R':'r';
        if(from>=base&&from<base+8)for(const right of s.castling){
          if((right===right.toUpperCase())!==(us==='w'))continue;
          const file=right.toLowerCase(), rf=base+(file==='k'?7:file==='q'?0:FILES.indexOf(file));
          if(rf===from||b[rf]!==R||rf<base||rf>=base+8)continue;
          if(s.variant!=='960'&&from!==base+4)continue;
          const short=rf>from, kt=base+(short?6:2), rt=base+(short?5:3);
          const range=(a,z)=>Array.from({length:Math.abs(z-a)+1},(_,i)=>Math.min(a,z)+i);
          if([...range(from,kt),...range(rf,rt)].some(i=>i!==from&&i!==rf&&b[i]))continue;
          const transit=b.slice();transit[from]=null;
          if(range(from,kt).filter(i=>i!==kt).some(i=>attacked({...s,board:transit},i,them)))continue;
          const final=b.slice();final[from]=null;final[rf]=null;final[kt]=p;final[rt]=R;
          if(attacked({...s,board:final},kt,them))continue;
          moves.push({from,to:s.variant==='960'?rf:kt,promotion:'',flag:'castle',rookFrom:rf,rookTo:rt,kingTo:kt});
        }
      }
    }
  }return moves;
}
export function apply(s,m){
  const {from,to,promotion,flag}=m,b=s.board.slice(),p=b[from],captured=flag==='castle'?null:b[to];let rights=s.castling;
  if(flag==='castle'){const rf=m.rookFrom,rt=m.rookTo,kt=m.kingTo;const R=b[rf];b[from]=null;b[rf]=null;b[kt]=p;b[rt]=R;}
  else{b[from]=null;b[to]=promotion?(s.turn==='w'?promotion.toUpperCase():promotion):p;if(flag==='ep')b[to+(s.turn==='w'?8:-8)]=null;}
  if(p==='K')rights=rights.replace(/[A-Z]/g,'');if(p==='k')rights=rights.replace(/[a-z]/g,'');
  const removeRook=(i,c)=>{const base=c==='w'?56:0;if(i<base||i>base+7)return;const f=i-base,letter=FILES[f];rights=rights.replace(c==='w'?letter.toUpperCase():letter,'');if(f===0)rights=rights.replace(c==='w'?'Q':'q','');if(f===7)rights=rights.replace(c==='w'?'K':'k','');};
  if(p.toLowerCase()==='r')removeRook(from,s.turn);if(captured?.toLowerCase()==='r')removeRook(to,opposite(s.turn));
  return {board:b,variant:s.variant,turn:opposite(s.turn),castling:rights,ep:p.toLowerCase()==='p'&&Math.abs(from-to)===16?(from+to)/2:-1,half:p.toLowerCase()==='p'||captured||flag==='ep'?0:s.half+1,full:s.full+(s.turn==='b'?1:0)};
}
export const legalMoves = s => pseudo(s).filter(m=>!inCheck(apply(s,m),s.turn));
export function notation(s,m){
  const p=s.board[m.from].toUpperCase(),capture=!!s.board[m.to]||m.flag==='ep';let label='';
  if(m.flag==='castle')label=m.rookFrom>m.from?'O-O':'O-O-O';
  else{if(p!=='P'){label=p;const other=legalMoves(s).filter(x=>x.from!==m.from&&x.to===m.to&&s.board[x.from]===s.board[m.from]);if(other.length){const sameFile=other.some(x=>x.from%8===m.from%8),sameRank=other.some(x=>Math.floor(x.from/8)===Math.floor(m.from/8));label+=!sameFile?squareName(m.from)[0]:!sameRank?squareName(m.from)[1]:squareName(m.from);}}else if(capture)label=squareName(m.from)[0];label+=(capture?'x':'')+squareName(m.to)+(m.promotion?'='+m.promotion.toUpperCase():'');}
  const next=apply(s,m);return label+(inCheck(next)?legalMoves(next).length?'+':'#':'');
}
export function positionKey(s){return s.board.map(p=>p||'.').join('')+' '+s.turn+' '+s.castling+' '+(s.ep>=0&&legalMoves(s).some(m=>m.flag==='ep')?s.ep:-1);}
function insufficient(s){const pieces=s.board.flatMap((p,i)=>p&&p.toLowerCase()!=='k'?[[p.toLowerCase(),(Math.floor(i/8)+i%8)%2]]:[]);return !pieces.length||(pieces.length===1&&['b','n'].includes(pieces[0][0]))||(pieces.every(p=>p[0]==='b')&&new Set(pieces.map(p=>p[1])).size===1);}
export function newGame(fen=START_FEN){const position=fromFen(fen);return {position,initialFen:fen,moves:[],keys:[positionKey(position)],result:null};}
export function gameStatus(game){
  const s=game.position, check=inCheck(s), moves=legalMoves(s),key=game.keys.at(-1),reps=game.keys.filter(k=>k===key).length;
  if(game.result)return {over:true,text:game.result,claim:null,check};
  if(!moves.length)return {over:true,text:check?(s.turn==='w'?'Black':'White')+' wins by checkmate':'Draw by stalemate',claim:null,check};
  if(insufficient(s)||s.half>=150||reps>=5)return {over:true,text:'Draw — '+(insufficient(s)?'insufficient material':s.half>=150?'75-move rule':'fivefold repetition'),claim:null,check};
  return {over:false,text:(s.turn==='w'?'White':'Black')+' to move'+(check?' · Check':''),claim:reps>=3?'threefold repetition':s.half>=100?'50-move rule':null,check};
}
export function playMove(game,input){
  if(gameStatus(game).over)throw Error('Game has ended.');
  const move=legalMoves(game.position).find(m=>m.from===input.from&&m.to===input.to&&m.promotion===(input.promotion||''));
  if(!move)throw Error('Illegal move.');
  const position=apply(game.position,move);return {...game,position,moves:[...game.moves,{...move,san:notation(game.position,move),color:game.position.turn}],keys:[...game.keys,positionKey(position)],result:null};
}
export function claimDraw(game){const status=gameStatus(game);if(status.over||!status.claim)throw Error('No draw claim is available.');return {...game,result:'Draw claimed — '+status.claim};}
export function resign(game,color){if(gameStatus(game).over)throw Error('Game has ended.');return {...game,result:(color==='w'?'Black':'White')+' wins by resignation'};}
