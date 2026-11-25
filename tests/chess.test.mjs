import test from 'node:test';import assert from 'node:assert/strict';
import {newGame,fromFen,legalMoves,apply,playMove,gameStatus,claimDraw,squareIndex as ix} from '../lib/chess.mjs';
const move=(g,uci)=>playMove(g,{from:ix(uci.slice(0,2)),to:ix(uci.slice(2,4)),promotion:uci[4]||''});
const line=(g,...moves)=>moves.reduce(move,g);
function perft(p,depth){if(!depth)return 1;return legalMoves(p).reduce((n,m)=>n+perft(apply(p,m),depth-1),0);}
test('standard position perft 20, 400, 8902, 197281',()=>{const p=fromFen();assert.deepEqual([1,2,3,4].map(d=>perft(p,d)),[20,400,8902,197281]);});
test('castling, pins and captures perft: Kiwipete',()=>{const p=fromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');assert.deepEqual([1,2,3].map(d=>perft(p,d)),[48,2039,97862]);});
test('Fool’s mate and illegal move rejection',()=>{assert.throws(()=>move(newGame(),'e2e5'),/Illegal/);const g=line(newGame(),'f2f3','e7e5','g2g4','d8h4');assert.equal(g.moves.at(-1).san,'Qh4#');assert.equal(gameStatus(g).text,'Black wins by checkmate');assert.throws(()=>move(g,'e2e4'),/ended/);});
test('en passant removes the correct pawn',()=>{const g=line(newGame(),'e2e4','a7a6','e4e5','d7d5','e5d6');assert.equal(g.position.board[ix('d5')],null);assert.equal(g.position.board[ix('d6')],'P');assert.equal(g.moves.at(-1).san,'exd6');});
test('castling relocates king and rook and clears rights',()=>{const g=move(newGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'),'e1g1');assert.equal(g.position.board[ix('g1')],'K');assert.equal(g.position.board[ix('f1')],'R');assert.equal(g.position.castling,'kq');assert.equal(g.moves[0].san,'O-O');});
test('castling through check is illegal',()=>{const g=newGame('4kr2/8/8/8/8/8/8/4K2R w K - 0 1');assert.throws(()=>move(g,'e1g1'),/Illegal/);});
test('four promotion options and underpromotion',()=>{const g=newGame('7k/P7/8/8/8/8/8/7K w - - 0 1');assert.equal(legalMoves(g.position).filter(m=>m.from===ix('a7')).length,4);const next=move(g,'a7a8n');assert.equal(next.position.board[ix('a8')],'N');assert.match(gameStatus(next).text,/insufficient/);});
test('threefold claim and automatic fivefold',()=>{const cycle=['g1f3','g8f6','f3g1','f6g8'];let g=line(newGame(),...cycle,...cycle);assert.equal(gameStatus(g).claim,'threefold repetition');assert.equal(gameStatus(claimDraw(g)).over,true);g=line(g,...cycle,...cycle);assert.match(gameStatus(g).text,/fivefold/);});
test('stalemate and fifty-move rule',()=>{assert.match(gameStatus(newGame('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).text,/stalemate/);assert.equal(gameStatus(newGame('7k/8/8/8/8/8/R7/7K w - - 100 60')).claim,'50-move rule');});
