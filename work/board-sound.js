// Amostra local escolhida pelo usuário: opção 4, grave e seca. Nenhum download.
class PieceSound{
 constructor(){
  this.enabled=true;this.context=null;this.buffer=null;this.sources=new Set();
  try{this.enabled=localStorage.getItem('primeiro-lance-som')!=='false'}catch{}
  const unlock=()=>{if(this.enabled)this.prepare()};
  document.addEventListener('pointerdown',unlock,{capture:true,passive:true});
  document.addEventListener('keydown',unlock,{capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop()});
 }
 prepare(){
  if(!this.enabled)return;
  try{
   if(!this.context){
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
    this.context=new Audio();
    const bytes=Uint8Array.from(atob('/*PIECE_SOUND_WAV*/'),c=>c.charCodeAt(0)),data=new DataView(bytes.buffer);
    let offset=12,rate=48000,start=0,length=0;
    while(offset+8<=bytes.length){const tag=String.fromCharCode(...bytes.slice(offset,offset+4)),size=data.getUint32(offset+4,true);
     if(tag==='fmt '){if(data.getUint16(offset+8,true)!==1||data.getUint16(offset+10,true)!==1||data.getUint16(offset+22,true)!==16)throw Error('Formato de áudio inválido');rate=data.getUint32(offset+12,true)}
     if(tag==='data'){start=offset+8;length=size;break}offset+=8+size+(size%2);
    }
    if(!length||start+length>bytes.length)throw Error('Amostra inválida');
    this.buffer=this.context.createBuffer(1,length/2,rate);const samples=this.buffer.getChannelData(0);
    for(let i=0;i<samples.length;i++)samples[i]=data.getInt16(start+i*2,true)/32768;
   }
   if(this.context.state==='suspended')this.context.resume().catch(()=>{});
  }catch{this.buffer=null}
 }
 play(){
  if(!this.enabled||document.hidden||!this.buffer||this.context?.state!=='running')return;
  try{const source=this.context.createBufferSource();source.buffer=this.buffer;source.connect(this.context.destination);this.sources.add(source);source.onended=()=>{this.sources.delete(source);source.disconnect()};source.start()}catch{}
 }
 stop(){for(const source of this.sources){try{source.stop()}catch{}}this.sources.clear()}
 setup(){
  const checkbox=$('pieceSound');checkbox.checked=this.enabled;
  if(!window.AudioContext&&!window.webkitAudioContext){checkbox.disabled=true;checkbox.checked=false;checkbox.parentElement.title='Som indisponível neste navegador.'}
  checkbox.onchange=()=>{this.enabled=checkbox.checked;try{localStorage.setItem('primeiro-lance-som',String(this.enabled))}catch{}if(this.enabled)this.prepare();else this.stop()};
 }
}
const pieceSound=new PieceSound();
