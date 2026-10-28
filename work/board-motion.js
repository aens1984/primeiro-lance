// A posição legal muda de imediato; esta camada cuida apenas do trajeto visual.
class BoardMotion{
 constructor(){this.fen=game.fen();this.history=game.history({verbose:true});this.active=null;this.frame=0;this.reduced=matchMedia('(prefers-reduced-motion: reduce)');this.reduced.addEventListener('change',()=>this.finish());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.finish()})}
 sync(){
  const fen=game.fen();if(fen===this.fen)return;
  const history=game.history({verbose:true}),latest=history.at(-1),old=this.history.at(-1),previous=this.fen;
  this.finish();this.fen=fen;this.history=history;
  if(document.hidden)return;
  let move,reverse=false;
  if(latest?.before===previous&&latest.after===fen)move=latest;
  else if(old?.after===previous&&old.before===fen){move=old;reverse=true}
  // Reinícios, importações e saltos de vários lances exibem diretamente a posição escolhida.
  if(!move)return;
  if(this.reduced.matches){pieceSound.play();return}
  const from=reverse?move.to:move.from,to=reverse?move.from:move.to;
  const items=[{from,to,piece:{type:reverse?(move.promotion||move.piece):move.piece,color:move.color}}];
  if(move.flags.includes('k')||move.flags.includes('q')){
   const rank=move.from[1],rookFrom=(move.flags.includes('k')?'h':'a')+rank,rookTo=(move.flags.includes('k')?'f':'d')+rank;
   items.push({from:reverse?rookTo:rookFrom,to:reverse?rookFrom:rookTo,piece:{type:'r',color:move.color}});
  }
  const captured=move.captured?{square:move.flags.includes('e')?move.to[0]+move.from[1]:move.to,piece:{type:move.captured,color:move.color==='w'?'b':'w'}}:null;
  const distance=Math.hypot(from.charCodeAt(0)-to.charCodeAt(0),Number(from[1])-Number(to[1]));
  let resolve;const done=new Promise(r=>resolve=r);
  this.active={items,captured,reverse,start:performance.now(),duration:Math.min(650,390+distance*45),progress:0,resolve,done};
  this.timer=setTimeout(()=>this.finish(true),this.active.duration+100);
  this.frame=requestAnimationFrame(t=>this.tick(t));
 }
 tick(now){
  this.frame=0;const a=this.active;if(!a)return;
  a.progress=Math.min(1,Math.max(0,(now-a.start)/a.duration));
  if(a.progress>=1){this.finish(true);return}
  this.draw2D();board3D?.draw();this.frame=requestAnimationFrame(t=>this.tick(t));
 }
 fraction(){const t=this.active?.progress||0;return t*t*(3-2*t)}
 position(item){const t=this.fraction(),x=s=>s.charCodeAt(0)-97-3.5,z=s=>3.5-(Number(s[1])-1);return {x:x(item.from)+(x(item.to)-x(item.from))*t,z:z(item.from)+(z(item.to)-z(item.from))*t}}
 pieces(){
  const a=this.active,hidden=new Set(a?.items.map(i=>i.to)||[]),pieces=[];
  if(a?.reverse&&a.captured&&a.progress<.86)hidden.add(a.captured.square);
  for(let i=0;i<64;i++){const square='abcdefgh'[i%8]+(Math.floor(i/8)+1),piece=game.get(square);if(piece&&!hidden.has(square))pieces.push({piece,x:i%8-3.5,z:3.5-Math.floor(i/8),square})}
  if(a){if(!a.reverse&&a.captured&&a.progress<.86){const square=a.captured.square;pieces.push({piece:a.captured.piece,x:square.charCodeAt(0)-97-3.5,z:3.5-(Number(square[1])-1),square})}for(const item of a.items)pieces.push({piece:item.piece,...this.position(item),square:item.to})}
  return pieces;
 }
 draw2D(){
  const board=$('board');let layer=board.querySelector('.motion-layer');for(const el of board.querySelectorAll('.motion-hidden'))el.classList.remove('motion-hidden');
  const a=this.active;if(!a||board.hidden){layer?.remove();return}
  const hide=square=>{board.children[(8-Number(square[1]))*8+square.charCodeAt(0)-97]?.querySelector('svg')?.classList.add('motion-hidden')};
  for(const item of a.items)hide(item.to);if(a.reverse&&a.captured&&a.progress<.86)hide(a.captured.square);
  const place=(el,x,z)=>el.style.transform=`translate3d(${(x+3.5)*100}%,${(z+3.5)*100}%,0)`;
  if(!layer){
   layer=document.createElement('div');layer.className='motion-layer';layer.setAttribute('aria-hidden','true');
   const add=(piece,moving)=>{const el=document.createElement('span');el.className='motion-piece'+(moving?' moving':' victim');el.innerHTML=pieceMarkup(piece);layer.append(el);return el};
   if(!a.reverse&&a.captured){const s=a.captured.square;place(add(a.captured.piece,false),s.charCodeAt(0)-97-3.5,3.5-(Number(s[1])-1))}
   for(const item of a.items)add(item.piece,true);board.append(layer);
  }
  const victim=layer.querySelector('.victim');if(victim)victim.hidden=a.progress>=.86;
  layer.querySelectorAll('.moving').forEach((el,i)=>{const pos=this.position(a.items[i]);place(el,pos.x,pos.z)});
 }
 wait(){return this.active?.done||Promise.resolve()}
 finish(audible=false){
  cancelAnimationFrame(this.frame);clearTimeout(this.timer);this.frame=0;
  const a=this.active;this.active=null;
  if(a){this.draw2D();board3D?.draw();if(audible)pieceSound.play();a.resolve()}
 }
}
const boardMotion=new BoardMotion();
