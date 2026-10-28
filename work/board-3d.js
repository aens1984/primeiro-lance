// Renderização local em WebGL, sem downloads ou serviços externos.
let board3D=null;
function setupBoard3D(){
 const wrap=document.querySelector('.board-wrap'),board=$('board');
 const controls=document.createElement('div');controls.className='view-switch';controls.innerHTML='<div role="group" aria-label="Visualização do tabuleiro"><button class="action" id="view2d" aria-pressed="true">2D · de cima</button><button class="action" id="view3d" aria-pressed="false">3D · madeira</button></div><span id="viewMessage" role="status"></span>';
 wrap.before(controls);
 const stage=document.createElement('div');stage.id='stage3d';stage.hidden=true;stage.innerHTML='<canvas id="chess3d" tabindex="0" role="group" aria-label="Tabuleiro 3D. Use as setas para escolher uma casa e Enter para selecionar a peça ou o destino." aria-describedby="help3d"></canvas><div id="labels3d" aria-hidden="true"></div>';
 board.after(stage);
 const tools=document.createElement('div');tools.id='tools3d';tools.hidden=true;tools.innerHTML='<div class="camera-buttons"><button class="action" id="reset3d">Restaurar visão</button></div><label for="rotation3d">Giro <input id="rotation3d" type="range" min="-180" max="180" step="1" value="0"></label><label for="tilt3d">Inclinação <input id="tilt3d" type="range" min="35" max="80" value="52"></label><p id="help3d" class="appearance-note">Clique ou toque na peça e depois no destino. Ajuste o giro e a inclinação pelas barras. No teclado, use as setas e Enter. Peças 3D em estilo clássico; os desenhos do menu valem para o modo 2D.</p>';
 wrap.after(tools);
 let view='2d';
 const save=()=>{try{localStorage.setItem('primeiro-lance-visao',view)}catch{}};
 function choose(next){
  if(next==='3d'&&!board3D){try{board3D=new ChessBoard3D($('chess3d'),$('labels3d'))}catch(e){$('viewMessage').textContent='O 3D não está disponível neste navegador. Você pode jogar em 2D.';return}}
  view=next;board.hidden=view==='3d';stage.hidden=view!=='3d';tools.hidden=view!=='3d';wrap.classList.toggle('in-3d',view==='3d');$('view2d').setAttribute('aria-pressed',String(view==='2d'));$('view3d').setAttribute('aria-pressed',String(view==='3d'));$('viewMessage').textContent='';save();boardMotion.draw2D();board3D?.draw();
 }
 $('view2d').onclick=()=>choose('2d');$('view3d').onclick=()=>choose('3d');
 $('rotation3d').oninput=()=>{board3D.angle=Number($('rotation3d').value)*Math.PI/180;board3D.draw()};
 $('tilt3d').oninput=()=>{board3D.tilt=Number($('tilt3d').value)*Math.PI/180;board3D.draw()};$('reset3d').onclick=()=>{board3D.angle=0;board3D.tilt=52*Math.PI/180;$('rotation3d').value=0;$('tilt3d').value=52;board3D.draw()};
 try{view=localStorage.getItem('primeiro-lance-visao')||'2d'}catch{}choose(view==='3d'?'3d':'2d');
}
class ChessBoard3D{
 constructor(canvas,labels){
  this.canvas=canvas;this.labels=labels;this.angle=0;this.tilt=52*Math.PI/180;this.cursor=null;this.lost=false;
  const gl=this.gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:true});if(!gl)throw Error('WebGL indisponível');
  const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
  const vs=shader(gl.VERTEX_SHADER,`precision highp float;attribute vec3 position,normal;uniform vec3 offset,eye,right,up,forward,viewFit;uniform float scale,turn,aspect;varying vec3 N,P;void main(){float c=cos(turn),s=sin(turn);mat3 rot=mat3(c,0.,-s,0.,1.,0.,s,0.,c);P=rot*(position*scale)+offset;N=rot*normal;vec3 v=P-eye;float d=dot(v,forward);gl_Position=vec4(dot(v,right)/(0.35*aspect),dot(v,up)/0.35,1.004*d-0.2004,d);gl_Position.xy=(gl_Position.xy-viewFit.yz*gl_Position.w)*viewFit.x;}`);
  const fs=shader(gl.FRAGMENT_SHADER,`precision highp float;
   uniform vec3 color,eye,offset;uniform float scale,polish,picking,unlit;varying vec3 N,P;
   void main(){
    if(picking>0.5){gl_FragColor=vec4(color,1.);return;}
    if(unlit>1.5){float radius=length(P.xz-offset.xz)/(scale*0.29);float alpha=0.42*pow(1.-smoothstep(0.05,1.,radius),1.5);gl_FragColor=vec4(color,alpha);return;}
    vec3 n=normalize(N),v=normalize(eye-P);
    vec3 key=normalize(vec3(-3.5,7.,4.)),fill=normalize(vec3(5.,4.,-3.));
    float ndv=max(dot(n,v),0.);
    float diffuse=0.29+0.18*(n.y*0.5+0.5)+0.46*max(dot(n,key),0.)+0.15*max(dot(n,fill),0.);
    float keySpec=max(dot(n,normalize(key+v)),0.);
    float fillSpec=max(dot(n,normalize(fill+v)),0.);
    // Reflexos largos de duas luzes de estúdio, sobre uma cor inteiramente lisa.
    float spec=pow(keySpec,90.)*0.65+pow(keySpec,20.)*0.12+pow(fillSpec,65.)*0.26;
    vec3 reflected=reflect(-v,n);
    float windowGlow=exp(-pow((reflected.x+0.38)/0.23,4.)-pow((reflected.y-0.65)/0.42,4.));
    float fresnel=0.045+0.28*pow(1.-ndv,5.);
    vec3 result=color*diffuse+vec3(1.,0.96,0.88)*(spec*polish+windowGlow*fresnel*polish);
    gl_FragColor=vec4(mix(result,color,unlit),1.);
   }`);
  const prog=this.prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));gl.useProgram(prog);
  this.u={};for(const k of ['viewFit','offset','eye','right','up','forward','scale','turn','aspect','color','polish','picking','unlit'])this.u[k]=gl.getUniformLocation(prog,k);
  this.a={position:gl.getAttribLocation(prog,'position'),normal:gl.getAttribLocation(prog,'normal')};
  this.meshes={};this.makeMeshes();
  for(let i=0;i<32;i++){const label=document.createElement('span');label.textContent=i<16?'abcdefgh'[i%8]:String(i%8+1);labels.append(label)}
  canvas.addEventListener('click',e=>{if(this.lost)return;const box=canvas.getBoundingClientRect();this.draw(true);const pixel=new Uint8Array(4);gl.readPixels(Math.floor((e.clientX-box.left)/box.width*canvas.width),Math.floor((box.bottom-e.clientY)/box.height*canvas.height),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);this.draw();const id=pixel[0];if(id>=1&&id<=64){const square=this.square(id-1);this.cursor=null;clickSquare(square)}});
  canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(e.key))return;e.preventDefault();let i=this.cursor??12,f=i%8,r=Math.floor(i/8);if(e.key==='ArrowLeft')f=Math.max(0,f-1);if(e.key==='ArrowRight')f=Math.min(7,f+1);if(e.key==='ArrowUp')r=Math.min(7,r+1);if(e.key==='ArrowDown')r=Math.max(0,r-1);this.cursor=r*8+f;const sq=this.square(this.cursor),p=game.get(sq);$('viewMessage').textContent=sq+(p?' · '+names[p.type]+(p.color==='w'?' · brancas':' · pretas'):' · vazia');if(e.key==='Enter'||e.key===' ')clickSquare(sq);this.draw()});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;$('viewMessage').textContent='A visualização 3D foi interrompida. Volte ao 2D para continuar ou recarregue a página.'});
  canvas.addEventListener('webglcontextrestored',()=>{$('viewMessage').textContent='Volte ao 2D e recarregue a página para reabrir o 3D.'});
  this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(canvas);
 }
 square(i){return 'abcdefgh'[i%8]+(Math.floor(i/8)+1)}
 mesh(name,vertices){const gl=this.gl,b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);this.meshes[name]={buffer:b,count:vertices.length/6}}
 makeMeshes(){
  const triangle=(out,a,b,c,normal)=>{if(!normal){const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const len=Math.hypot(...normal)||1;normal=normal.map(v=>v/len)}for(const p of [a,b,c])out.push(...p,...normal)};
  const box=(out,x,y,z,w,h,d)=>{const v=[[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y+h,z-d/2],[x-w/2,y+h,z-d/2],[x-w/2,y,z+d/2],[x+w/2,y,z+d/2],[x+w/2,y+h,z+d/2],[x-w/2,y+h,z+d/2]];for(const [a,b,c,d] of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]){triangle(out,v[a],v[b],v[c]);triangle(out,v[a],v[c],v[d])}};
  const lathe=(out,profile,cx=0,cz=0)=>{
   const segments=96;
   const edge=profile.slice(1).map(([r,y],i)=>{const [r0,y0]=profile[i],len=Math.hypot(y-y0,r0-r)||1;return [(y-y0)/len,(r0-r)/len]});
   const normal=(j,k,t)=>{
    let nr=edge[j][0],ny=edge[j][1];const other=edge[k];
    // Reflexos contínuos nas curvas; as quinas acentuadas continuam definidas.
    if(other&&nr*other[0]+ny*other[1]>0.32){nr+=other[0];ny+=other[1];const l=Math.hypot(nr,ny);nr/=l;ny/=l}
    return [nr*Math.cos(t),ny,nr*Math.sin(t)];
   };
   for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){
    const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments;
    for(const [k,t] of [[j,a],[j+1,a],[j+1,b],[j,a],[j+1,b],[j,b]]){const [r,y]=profile[k];out.push(cx+r*Math.cos(t),y,cz+r*Math.sin(t),...normal(j,k===j?j-1:j+1,t))}
   }
  };
  const sphere=(out,r,y,cx=0,cz=0)=>lathe(out,Array.from({length:33},(_,i)=>{const a=-Math.PI/2+i*Math.PI/32;return [r*Math.cos(a),y+r*Math.sin(a)]}),cx,cz);
  // Perfis arredondados sem ultrapassar os raios do modelo.
  const curve=profile=>{
   const result=[];
   for(let i=0;i<profile.length-1;i++){
    const a=profile[i],b=profile[i+1],prev=profile[Math.max(0,i-1)],next=profile[Math.min(profile.length-1,i+2)];
    for(let j=0;j<5;j++){const t=j/5,t2=t*t,t3=t2*t;result.push(a.map((value,k)=>{
     const slope=b[k]-a[k],before=a[k]-prev[k],after=next[k]-b[k];
     const m0=before*slope>0?Math.sign(slope)*Math.min(Math.abs(before),Math.abs(slope)):0;
     const m1=after*slope>0?Math.sign(slope)*Math.min(Math.abs(after),Math.abs(slope)):0;
     return (2*t3-3*t2+1)*value+(t3-2*t2+t)*m0+(-2*t3+3*t2)*b[k]+(t3-t2)*m1;
    }))}
   }result.push(profile.at(-1));return result;
  };
  let v=[];box(v,0,0,0,1,1,1);this.mesh('box',v);
  // Moldura com chanfros arredondados: as transições captam a luz do verniz.
  v=[];const half=[4.66,.18,4.66],bevel=.065;
  const rounded=(p)=>{const core=p.map((x,k)=>Math.max(-half[k]+bevel,Math.min(half[k]-bevel,x))),delta=p.map((x,k)=>x-core[k]),len=Math.hypot(...delta)||1,normal=delta.map(x=>x/len);return [...core.map((x,k)=>x+normal[k]*bevel),...normal]};
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
   const u=(axis+1)%3,w=(axis+2)%3,coords=k=>[-half[k],-half[k]+bevel,0,half[k]-bevel,half[k]],us=coords(u),ws=coords(w);
   const point=(i,j)=>{const p=[0,0,0];p[axis]=half[axis]*sign;p[u]=us[i];p[w]=ws[j];return rounded(p)};
   for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(const [a,b] of [[i,j],[i+1,j],[i+1,j+1],[i,j],[i+1,j+1],[i,j+1]])v.push(...point(a,b));
  }this.mesh('frame',v);
  v=[];sphere(v,1,0);this.mesh('eye',v);
  v=[];lathe(v,[[0,0],[0.29,0],[0.29,0.002],[0,0.002]]);this.mesh('disc',v);
  const base=[[0,0],[.30,0],[.34,.018],[.355,.045],[.355,.077],[.34,.105],[.30,.14],[.285,.17],[.298,.19],[.294,.215],[.266,.24],[.235,.26]];
  for(const type of ['p','r','n','b','q','k']){
   v=[];const factor=type==='p'?.82:1;lathe(v,curve(base.map(([r,y])=>[r*factor,y])));
   const h={p:.70,r:.92,n:1.12,b:1.19,q:1.35,k:1.50}[type];
   lathe(v,curve([[.235*factor,.26],[.20*factor,.30],[.15*factor,.39],[.115*factor,h*.61],[.12*factor,h*.67],[.185*factor,h*.72],[.205*factor,h*.76],[.185*factor,h*.80],[.13*factor,h*.83]]));
   if(type==='p')sphere(v,.17,.70);
   if(type==='b'){lathe(v,curve([[.10,.94],[.17,1.00],[.195,1.07],[.185,1.15],[.14,1.23],[.075,1.32],[0,1.38]]));sphere(v,.045,1.39)}
   if(type==='r'){lathe(v,[[.14,.73],[.26,.78],[.28,.86],[.28,.98],[.20,.98],[.20,.89],[0,.89]]);for(let i=0;i<6;i++){const a=i*Math.PI/3;box(v,Math.cos(a)*.235,.97,Math.sin(a)*.235,.12,.15,.12)}}
   if(type==='q'){lathe(v,curve([[.14,1.04],[.23,1.11],[.25,1.16],[.17,1.20],[.14,1.25],[.22,1.39],[0,1.39]]));for(let i=0;i<8;i++){const a=i*Math.PI/4;sphere(v,.047,1.41,Math.cos(a)*.22,Math.sin(a)*.22)}sphere(v,.065,1.44)}
   if(type==='k'){lathe(v,curve([[.12,1.18],[.23,1.24],[.24,1.30],[.17,1.37],[.12,1.41],[0,1.41]]));box(v,0,1.37,0,.09,.36,.09);box(v,0,1.56,0,.29,.085,.09)}
   if(type==='n'){
    // Cavalo: perfil esculpido, extrudado, com focinho, orelhas e crina.
    const outline=[[-.23,.58],[.23,.58],[.25,.83],[.18,1.05],[.10,1.22],[.08,1.43],[-.02,1.36],[-.10,1.43],[-.14,1.27],[-.32,1.13],[-.39,.97],[-.29,.92],[-.11,1.00],[-.07,.87]];
    const profile=[];for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];profile.push(a.map((x,k)=>x*.85+b[k]*.15),a.map((x,k)=>x*.15+b[k]*.85))}
    const point=(p,s,z)=>[(p[0]+.03)*s-.03,(p[1]-1)*s+1,z];
    // Triangulação por corte de orelhas para o perfil côncavo.
    let ids=profile.map((_,i)=>i);const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    while(ids.length>2){let found=false;for(let k=0;k<ids.length;k++){const a=ids[(k+ids.length-1)%ids.length],b=ids[k],c=ids[(k+1)%ids.length];if(cross(profile[a],profile[b],profile[c])<=0)continue;if(ids.some(i=>i!==a&&i!==b&&i!==c&&cross(profile[a],profile[b],profile[i])>=0&&cross(profile[b],profile[c],profile[i])>=0&&cross(profile[c],profile[a],profile[i])>=0))continue;for(const z of [-.15,.15])triangle(v,point(profile[a],.80,z),point(profile[b],.80,z),point(profile[c],.80,z),[0,0,z<0?-1:1]);ids.splice(k,1);found=true;break}if(!found)break}
    // Bochechas e pescoço com seção arredondada, em vez de uma placa plana.
    const rings=[[-.15,.80,0,-1],[-.14,.90,.5,-.866],[-.11,.98,.866,-.5],[0,1,1,0],[.11,.98,.866,.5],[.14,.90,.5,.866],[.15,.80,0,1]];
    const contourNormal=i=>{const prev=profile[(i+profile.length-1)%profile.length],next=profile[(i+1)%profile.length],nx=next[1]-prev[1],ny=prev[0]-next[0],l=Math.hypot(nx,ny);return [nx/l,ny/l]};
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<profile.length;i++){
     const next=(i+1)%profile.length;for(const [k,r] of [[i,j],[next,j],[next,j+1],[i,j],[next,j+1],[i,j+1]]){const [z,s,nxy,nz]=rings[r],n=contourNormal(k);v.push(...point(profile[k],s,z),n[0]*nxy,n[1]*nxy,nz)}
    }
   }
   this.mesh(type,v);
  }
 }
 camera(){const a=this.angle,t=this.tilt,d=16.7,eye=[Math.sin(a)*Math.cos(t)*d,Math.sin(t)*d,Math.cos(a)*Math.cos(t)*d],norm=v=>{const l=Math.hypot(...v);return v.map(x=>x/l)},forward=norm([ -eye[0],.2-eye[1],-eye[2]]),right=norm([-forward[2],0,forward[0]]),up=[right[1]*forward[2]-right[2]*forward[1],right[2]*forward[0]-right[0]*forward[2],right[0]*forward[1]-right[1]*forward[0]];this.cam={eye,right,up,forward};this.viewFit=[1,0,0];if(this.landscapeFit){const aspect=this.canvas.clientWidth/this.canvas.clientHeight,points=[];for(const [edge,low,high] of [[4.66,-.385,-.025],[3.96,.04,1.96]])for(const x of [-edge,edge])for(const z of [-edge,edge])for(const y of [low,high]){const v=[x-eye[0],y-eye[1],z-eye[2]],dot=a=>a.reduce((sum,n,i)=>sum+n*v[i],0),depth=dot(forward);points.push([dot(right)/(depth*.35*aspect),dot(up)/(depth*.35)])}const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);this.viewFit=[Math.min(1.96/(maxX-minX),1.96/(maxY-minY)),(minX+maxX)/2,(minY+maxY)/2]}return this.cam}
 project(x,y,z){const c=this.cam,v=[x-c.eye[0],y-c.eye[1],z-c.eye[2]],dot=a=>a.reduce((s,n,i)=>s+n*v[i],0),d=dot(c.forward);const [zoom,cx,cy]=this.viewFit||[1,0,0];return [((dot(c.right)/(d*.35*(this.canvas.clientWidth/this.canvas.clientHeight))-cx)*zoom+1)*this.canvas.clientWidth/2,(1-(dot(c.up)/(d*.35)-cy)*zoom)*this.canvas.clientHeight/2]}
 draw(picking=false){
  if(this.lost||this.canvas.parentElement.hidden)return;
  const gl=this.gl,c=this.canvas,dpr=Math.min(window.devicePixelRatio||1,2),w=Math.round(c.clientWidth*dpr),h=Math.round(c.clientHeight*dpr);if(!w||!h)return;if(c.width!==w||c.height!==h){c.width=w;c.height=h}gl.viewport(0,0,w,h);gl.clearColor(...(picking?[0,0,0,1]:[178/255,200/255,186/255,1]));gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.disable(gl.DITHER);gl.useProgram(this.prog);const cam=this.camera();for(const k of ['eye','right','up','forward'])gl.uniform3fv(this.u[k],cam[k]);gl.uniform3fv(this.u.viewFit,this.viewFit);gl.uniform1f(this.u.aspect,w/h);gl.uniform1f(this.u.picking,picking?1:0);
  const rgb=hex=>hex.match(/\w\w/g).map(s=>parseInt(s,16)/255);
  const paint=(mesh,x,y,z,s,color,polish=0,turn=0,id=0,unlit=0)=>{const m=this.meshes[mesh];gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);for(const [key,offset] of [['position',0],['normal',12]]){gl.enableVertexAttribArray(this.a[key]);gl.vertexAttribPointer(this.a[key],3,gl.FLOAT,false,24,offset)}gl.uniform3f(this.u.offset,x,y,z);gl.uniform1f(this.u.scale,s);gl.uniform1f(this.u.turn,turn);gl.uniform3fv(this.u.color,picking?[id/255,0,0]:color);gl.uniform1f(this.u.polish,polish);gl.uniform1f(this.u.unlit,unlit);if(unlit>1.5){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false)}gl.drawArrays(gl.TRIANGLES,0,m.count);if(unlit>1.5){gl.disable(gl.BLEND);gl.depthMask(true)}};
  const block=(x,y,z,w,h,d,color,polish=0,id=0)=>{const m=this.meshes.box; // Box dimensions are baked once per shape and cached.
   const key='box'+[w,h,d].join(',');if(!this.meshes[key]){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);/* Build scaled geometry from the unit cube's CPU equivalent. */const vertices=[],p=[[-.5,0,-.5],[.5,0,-.5],[.5,1,-.5],[-.5,1,-.5],[-.5,0,.5],[.5,0,.5],[.5,1,.5],[-.5,1,.5]];for(const [a,b,c,e,n] of [[0,3,2,1,[0,0,-1]],[4,5,6,7,[0,0,1]],[0,4,7,3,[-1,0,0]],[1,2,6,5,[1,0,0]],[3,7,6,2,[0,1,0]],[0,1,5,4,[0,-1,0]]])for(const i of [a,b,c,a,c,e])vertices.push(p[i][0]*w,p[i][1]*h,p[i][2]*d,...n);this.mesh(key,vertices)}paint(key,x,y,z,1,color,polish,0,id)};
  if(!picking){block(0,-.54,0,200,.08,200,rgb('b2c8ba'));paint('frame',0,-.205,0,1,rgb('be9566'),.9);block(0,-.011,0,8.12,.02,8.12,rgb('4b3528'),.5);}
  const legal=selected?game.moves({square:selected,verbose:true}).map(m=>m.to):[],size={small:.82,medium:1,large:1.10}[pieceSettings.size];
  for(let i=0;i<64;i++){const f=i%8,r=Math.floor(i/8),sq=this.square(i),x=f-3.5,z=3.5-r,id=i+1,isLast=last&&(last.from===sq||last.to===sq);block(x,0,z,1,.025,1,rgb(isLast?((f+r)%2?'dfcf9c':'817147'):(f+r)%2?'eee4cd':'45443c'),0,id);
   if(!picking){if(selected===sq||hintSquares.includes(sq)||this.cursor===i){const col=rgb(this.cursor===i?'b6daff':'f39438');for(const [dx,dz,w,d] of [[0,-.45,.95,.065],[0,.45,.95,.065],[-.45,0,.065,.95],[.45,0,.065,.95]])block(x+dx,.029,z+dz,w,.012,d,col)}if(legal.includes(sq))paint('disc',x,.035,z,game.get(sq)?1.5:.5,rgb('be892d'),0,0,0,1);}
  }
  for(const {piece:p,x,z,square:sq} of boardMotion.pieces()){const id=(Number(sq[1])-1)*8+sq.charCodeAt(0)-97+1;
   if(!picking){paint('disc',x+.07,.03,z+.07,1.7*size,rgb('211b16'),0,0,0,2);paint('disc',x,.034,z,1.15*size,rgb('211b16'),0,0,0,2)}
   paint(p.type,x,.04,z,size,rgb(p.color==='w'?'f1dfbb':'503326'),1,p.color==='w'?0:Math.PI,id);
   if(p.type==='n'){// Olhos em ambos os lados do perfil.
    for(const side of [-1,1])paint('eye',x+(p.color==='w'?-.17:.17)*size,.04+1.19*size,z+side*.15*size,.024*size,rgb('281e18'),1,0,id);
   }
  }
  if(!picking){let j=0;for(const z of [4.32,-4.32])for(let i=0;i<8;i++){const pos=this.project(i-3.5,.045,z),el=this.labels.children[j++];el.style.left=pos[0]+'px';el.style.top=pos[1]+'px'}for(const x of [-4.32,4.32])for(let i=0;i<8;i++){const pos=this.project(x,.045,3.5-i),el=this.labels.children[j++];el.style.left=pos[0]+'px';el.style.top=pos[1]+'px'}}
 }
}
