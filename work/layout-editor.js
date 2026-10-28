// Editor local. A prévia é uma cópia sem scripts, motor, rede ou armazenamento.
(()=>{
 'use strict';
 const key='primeiro-lance-layout-v1',zones={},blocks=new Map();
 const labels={board:'Tabuleiro e controles',support:'Abaixo do tabuleiro',menu:'Menus'};
 let saved={version:1},draft,target='mobile',opened=false,applying=false,dragged=null,frame=0;
 let currentProfile='',previewMode='current';
 
 const trainer=document.querySelector('main:not(#preferencesPage)'),layout=trainer.querySelector('.layout');
 zones.board=layout.querySelector('.board-session');zones.support=layout.querySelector(':scope>section');zones.menu=layout.querySelector(':scope>aside');
 const fixed={board:[],support:[zones.board],menu:[zones.menu.querySelector('.tabs')]};
 const names=new Map([
  [zones.board.querySelector('.board-toolbar'),'Configurações e som'],[zones.board.querySelector('.view-switch'),'Escolha 2D / 3D'],
  [zones.board.querySelector('.board-wrap'),'Tabuleiro'],[document.getElementById('tools3d'),'Câmera 3D'],
  [document.getElementById('boardPgnNav'),'Setas dos lances'],[document.getElementById('sessionHistory'),'Lances da sessão'],
  [document.getElementById('status'),'Situação da partida'],[document.getElementById('undo').parentElement,'Voltar jogada e salvar partida'],
  [document.getElementById('bookTab'),'Abrir leitor de livros'],[document.getElementById('bookPanel'),'Leitor de PDF ou imagem'],
  [document.getElementById('settings'),'Dificuldade e nova partida'],[document.getElementById('pgnPanel'),'Estudar partidas PGN'],
  [document.getElementById('trainingReview'),'Análise do treinador'],[document.getElementById('libraryPanel'),'Biblioteca'],
  [document.getElementById('puzzleInfo'),'Treino de tática']
 ]);
 function discover(){
  for(const [zone,container] of Object.entries(zones))for(const el of [...container.children]){
   if(fixed[zone].includes(el)||el.dataset.layoutBlock)continue;
   const id=el.id||'layout-'+zone+'-'+blocks.size;
   if(!el.id)el.id=id;
   const pinned=zone==='board'&&!['sessionHistory','boardPgnNav'].includes(id);
   const name=names.get(el)||el.querySelector('h2,.eyebrow,summary')?.textContent.trim()||'Quadro do menu';
   el.dataset.layoutBlock=id;blocks.set(id,{el,id,home:zone,name,pinned});
  }
 }
 for(const [selector,id] of [['.board-toolbar','layoutBoardToolbar'],['.view-switch','layoutViewSwitch'],['.board-wrap','layoutBoard'],['#undo','layoutGameActions'],['#coach','layoutCoach'],['aside>details','layoutHelp']]){const el=layout.querySelector(selector);if(el){const block=['#undo','#coach'].includes(selector)?el.parentElement:el;block.id||=id}}
 discover();
 function defaults(){const c={custom:false,boardSize:100,menuFirst:false,board:[],support:[],menu:[]};for(const b of blocks.values())c[b.home].push(b.id);return c}
 function normalize(value){
  const out=defaults();if(!value||typeof value!=='object')return out;
  out.custom=value.custom===true;out.boardSize=Math.max(70,Math.min(100,Number(value.boardSize)||100));out.menuFirst=value.menuFirst===true;
  const seen=new Set();for(const zone of Object.keys(zones)){out[zone]=[];for(const id of Array.isArray(value[zone])?value[zone]:[]){const b=blocks.get(id);if(!b||seen.has(id)||(b.pinned&&zone!==b.home))continue;out[zone].push(id);seen.add(id)}}
  for(const b of blocks.values())if(!seen.has(b.id))out[b.home].push(b.id);
  return out;
 }
 function load(value){if(!value||value.version!==1)throw Error('Este arquivo não é um layout do Primeiro Lance.');return {version:1,desktop:normalize(value.desktop),mobile:normalize(value.mobile)}}
 try{const raw=localStorage.getItem(key);if(raw){const value=JSON.parse(raw);if(value?.version===1)saved=value}}catch{}
 const device=()=>matchMedia('(max-width:780px)').matches?'mobile':'desktop';
 function place(root,config,clone=false){
  const containers=clone?{board:root.querySelector('.board-session'),support:root.querySelector('.layout>section'),menu:root.querySelector('.layout>aside')}:zones;
  for(const zone of Object.keys(zones))for(const id of config[zone]){
   const el=clone?root.querySelector('[data-layout-block="'+id+'"]'):blocks.get(id)?.el;
   if(el)containers[zone].append(el);
  }
  const section=containers.support;
  section.style.setProperty('--layout-board-size',config.boardSize+'%');
  section.style.setProperty('--layout-board-scale',String(config.boardSize/100));
  const grid=clone?root.querySelector('.layout'):layout;
  grid.classList.toggle('layout-menu-first',config.menuFirst);
 }
 function prioritizeDefault(){
  const active=zones.menu.querySelector('.tabs button.active')?.id;
  const ids={playTab:'settings',pgnTab:'pgnPanel',puzzleTab:'puzzleInfo',libraryTab:'libraryPanel',studyTab:['puzzleInfo','trainingReview','androidData']};
  if(ids[active])prioritizeMenuPanel(ids[active],active);
 }
 function apply(force=false){
  if(applying||window.bottomMenu?.active)return;applying=true;
  try{
   discover();const profile=document.documentElement.classList.contains('android-landscape')?'landscape':device();
   const c=normalize(saved[profile]);
   if(c.custom)place(document,c);
   else if(force||currentProfile&&currentProfile!==profile){place(document,defaults());prioritizeDefault()}
   currentProfile=profile;
   board3D?.draw();
  }finally{applying=false}
 }
 const style=document.createElement('style');style.textContent=`/*LAYOUT_EDITOR_CSS*/
 .board-session{width:var(--layout-board-size,100%)}
 @media(max-width:780px){.layout-menu-first>aside{grid-row:1}.layout-menu-first>section{grid-row:2}}
 `;document.head.append(style);
 const launch=document.createElement('button');launch.id='editLayout';launch.className='action';launch.textContent='Editar layout';launch.type='button';
 document.getElementById('configTab').after(launch);
 const editor=document.createElement('section');editor.id='layoutEditor';editor.hidden=true;editor.setAttribute('role','dialog');editor.setAttribute('aria-modal','true');editor.setAttribute('aria-labelledby','layoutEditorTitle');
 editor.innerHTML=`<div class="le-top"><div><h1 id="layoutEditorTitle" tabindex="-1">Organize seu espaço</h1><p>Arraste os blocos ou use as setas. A prévia muda na hora.</p></div><div class="le-buttons"><button class="action" id="layoutCancel">Cancelar</button><button class="action primary" id="layoutSave">Salvar e voltar</button></div></div>
 <div id="layoutNotice" role="status" aria-live="polite"></div><div class="le-workspace"><div class="le-controls">
 <div class="le-options"><label>Disposição para<select id="layoutTarget"><option value="mobile">Celular</option><option value="desktop">Notebook</option></select></label><label>Prévia do menu<select id="layoutMode"><option value="current">Tela atual</option><option value="play">Jogar</option><option value="pgn">Abrir PGN</option><option value="study">Estudar</option><option value="library">Biblioteca</option></select></label></div>
 <label for="layoutBoardSize">Largura do tabuleiro: <span id="layoutSizeValue"></span></label><input id="layoutBoardSize" type="range" min="70" max="100" step="5">
 <label class="book-check" id="layoutFirstLabel"><input type="checkbox" id="layoutMenuFirst"> Mostrar menus antes do tabuleiro no celular</label>
 <p class="le-hint">Os quadros da opção escolhida continuam aparecendo só quando são usados. A ordem salva passa a valer nas opções do menu.</p><div id="layoutBlocks"></div>
 <button class="action" id="layoutReset">Restaurar layout original desta tela</button>
 <div class="le-storage"><p class="le-hint">Salvo neste navegador ou aplicativo. Para levar a disposição para outro aparelho, baixe e importe o arquivo.</p><div class="le-buttons"><button class="action" id="layoutExport">Baixar layouts</button><button class="action" id="layoutImport">Importar layouts</button></div><input id="layoutFile" type="file" accept=".json,application/json" hidden></div>
 </div><div class="le-preview-area"><div class="le-options"><label>Largura do celular<select id="layoutPhoneWidth"><option value="360">360 px</option><option value="390" selected>390 px</option><option value="430">430 px</option></select></label></div><p>Prévia visual da partida atual. Role dentro da tela para ver os outros quadros.</p><div class="le-preview-scroll"><div id="layoutPreview"></div></div></div></div>`;
 document.body.append(editor);
 const $e=id=>editor.querySelector('#'+id),shadow=$e('layoutPreview').attachShadow({mode:'open'});
 function notice(text){$e('layoutNotice').textContent=text}
 function refreshLists(){
  const c=normalize(draft[target]);draft[target]=c;$e('layoutBlocks').replaceChildren();
  $e('layoutTarget').value=target;$e('layoutBoardSize').value=c.boardSize;$e('layoutSizeValue').textContent=c.boardSize+'%';$e('layoutMenuFirst').checked=c.menuFirst;
  $e('layoutFirstLabel').hidden=target!=='mobile';$e('layoutPhoneWidth').parentElement.hidden=target!=='mobile';
  for(const zone of Object.keys(zones)){
   const list=document.createElement('div');list.className='le-zone';list.dataset.zone=zone;const title=document.createElement('h2');title.textContent=labels[zone];list.append(title);
   c[zone].forEach((id,index)=>{
    const b=blocks.get(id),row=document.createElement('div');row.className='le-item';row.dataset.block=id;row.draggable=true;row.setAttribute('aria-grabbed','false');
    const name=document.createElement('strong');name.textContent='⠿ '+b.name;row.append(name);
    const buttons=document.createElement('div');buttons.className='le-buttons';
    for(const [text,delta] of [['↑',-1],['↓',1]]){const btn=document.createElement('button');btn.className='action';btn.textContent=text;btn.type='button';btn.setAttribute('aria-label',(delta<0?'Subir ':'Descer ')+b.name);btn.disabled=index+delta<0||index+delta>=c[zone].length;btn.onclick=()=>{move(id,zone,index+delta);$e('layoutBlocks').querySelector('[data-block="'+id+'"] button:not(:disabled)')?.focus({preventScroll:true})};buttons.append(btn)}
    if(!b.pinned){const select=document.createElement('select');select.setAttribute('aria-label','Local de '+b.name);for(const z of Object.keys(zones))select.add(new Option(labels[z],z));select.value=zone;select.onchange=()=>move(id,select.value,Infinity);buttons.append(select)}
    row.append(buttons);list.append(row);
   });$e('layoutBlocks').append(list);
  }
  schedulePreview();
 }
 function move(id,to,index){
  const c=normalize(draft[target]),b=blocks.get(id);if(!b||b.pinned&&to!==b.home)return;
  for(const zone of Object.keys(zones))c[zone]=c[zone].filter(x=>x!==id);
  c[to].splice(Math.min(index,c[to].length),0,id);c.custom=true;draft[target]=c;refreshLists();notice(b.name+' reposicionado. Clique em Salvar e voltar para aplicar.');
 }
 function bindDrag(root){
  root.addEventListener('dragstart',event=>{const item=event.target.closest('[data-block]');if(!item)return;dragged=item.dataset.block;event.dataTransfer.setData('text/plain',dragged);event.dataTransfer.effectAllowed='move';item.setAttribute('aria-grabbed','true')});
  root.addEventListener('dragover',event=>{if(!dragged)return;const dest=event.target.closest('[data-block],[data-zone]');if(dest){event.preventDefault();event.dataTransfer.dropEffect='move'}});
  root.addEventListener('drop',event=>{if(!dragged)return;const item=event.target.closest('[data-block]'),area=event.target.closest('[data-zone]');if(!item&&!area)return;event.preventDefault();const id=dragged;dragged=null;const c=draft[target],to=area?.dataset.zone||Object.keys(zones).find(z=>c[z].includes(item.dataset.block));if(item?.dataset.block===id)return;const i=item?c[to].indexOf(item.dataset.block):c[to].length;move(id,to,i)});
  root.addEventListener('dragend',()=>{dragged=null;root.querySelectorAll('[aria-grabbed]').forEach(x=>x.setAttribute('aria-grabbed','false'))});
 }
 bindDrag($e('layoutBlocks'));bindDrag(shadow);
 function schedulePreview(){cancelAnimationFrame(frame);frame=requestAnimationFrame(preview)}
 function preview(){
  if(!opened)return;
  const scroll=shadow.querySelector('.preview-viewport')?.scrollTop||0;
  // Copia somente a interface; nunca copia scripts, tokens, códigos ou dados de conexão.
  const host=document.createElement('div');host.className='preview-html';
  const body=document.createElement('div');body.className='preview-body';
  const header=document.querySelector('body>header').cloneNode(true),main=trainer.cloneNode(true);main.hidden=false;main.inert=false;body.append(header,main);host.append(body);
  main.querySelectorAll('script,[onload],[onclick],#androidData').forEach(el=>el.remove());
  main.querySelector('#editLayout')?.remove();
  if(board3D&&!document.getElementById('stage3d').hidden)board3D.draw();
  for(const canvas of main.querySelectorAll('canvas')){const source=document.getElementById(canvas.id);if(!source)continue;try{const img=document.createElement('img');img.src=source.toDataURL();img.style.cssText='display:block;width:100%;height:100%;object-fit:contain';img.alt='Tabuleiro 3D da partida atual';canvas.replaceWith(img)}catch{canvas.remove()}}
  for(const input of main.querySelectorAll('input,textarea,select')){const original=document.getElementById(input.id);if(original){if(input.type!=='file')input.value=original.value;if(input.type==='checkbox')input.checked=original.checked}input.tabIndex=-1}
  if(previewMode!=='current'){
   const visibility={settings:previewMode==='play',pgnPanel:previewMode==='pgn',libraryPanel:previewMode==='library',puzzleInfo:previewMode==='study',boardPgnNav:previewMode==='pgn'};
   for(const [id,visible] of Object.entries(visibility)){const el=main.querySelector('#'+id);if(el)el.hidden=!visible}
   main.querySelector('.layout>section').classList.toggle('studying',previewMode==='pgn');
  }
  const c=normalize(draft[target]);place(main,c,true);
  for(const b of blocks.values()){
   const el=main.querySelector('[data-layout-block="'+b.id+'"]');if(!el||el.hidden)continue;el.dataset.block=b.id;el.draggable=true;
   const handle=document.createElement('span');handle.className='preview-handle';handle.dataset.block=b.id;handle.draggable=true;handle.textContent='⠿ '+b.name;el.prepend(handle);
  }
  // Container queries dão à cópia as dimensões do aparelho, sem iframe ou scripts.
  let css=[...document.querySelectorAll('head style')].map(el=>el.textContent).join('\n');
  css=css.replace(/@media\s*\(\s*((?:min|max)-width\s*:[^)]+)\)/g,'@container layoutpreview ($1)')
   .replace(/\bhtml\b/g,'.preview-html').replace(/\bbody\b/g,'.preview-body').replace(/:root\b/g,'.preview-html')
   .replace(/([\d.]+)(?:d|s|l)?vw\b/g,'$1cqw').replace(/([\d.]+)(?:d|s|l)?vh\b/g,'$1cqh');
  const sheet=document.createElement('style');sheet.textContent=css+`\n:host{font:14px Segoe UI,Arial,sans-serif;color:#e8ede8}.preview-viewport{height:100%;overflow:auto;background:#101a17}.preview-html{background:#101a17;font-family:Segoe UI,Arial,sans-serif;color:#e8ede8}.preview-body{margin:0}[data-layout-block]{position:relative}.preview-handle{position:absolute;left:3px;top:3px;z-index:6;opacity:0;display:block;max-width:95%;font:11px Segoe UI,Arial,sans-serif;color:#c5df8d;background:#101a17;padding:5px 7px;border:1px dashed #718b75;border-radius:5px;cursor:grab;margin-bottom:7px}[data-layout-block]:hover>.preview-handle{opacity:.95}.preview-body #editLayout{display:none}`;
  const viewport=document.createElement('div');viewport.className='preview-viewport';viewport.append(host);
  shadow.replaceChildren(sheet,viewport);viewport.scrollTop=scroll;
  $e('layoutPreview').style.width=(target==='mobile'?$e('layoutPhoneWidth').value:1100)+'px';
  $e('layoutPreview').style.height=(target==='mobile'?740:800)+'px';
 }
 shadow.addEventListener('click',e=>e.preventDefault());
 function open(){
  if(busy){launch.textContent='Aguarde a jogada…';setTimeout(()=>launch.textContent='Editar layout',1800);return}
  discover();draft={version:1,desktop:normalize(saved.desktop),mobile:normalize(saved.mobile)};target=device();previewMode='current';$e('layoutMode').value='current';
  opened=true;editor.hidden=false;document.body.classList.add('layout-editing');trainer.inert=true;document.querySelector('body>header').inert=true;
  refreshLists();notice('As mudanças só são aplicadas quando você salva.');$e('layoutEditorTitle').focus();
 }
 function close(){opened=false;shadow.replaceChildren();editor.hidden=true;document.body.classList.remove('layout-editing');trainer.inert=false;document.querySelector('body>header').inert=false;launch.focus({preventScroll:true})}
 launch.onclick=open;$e('layoutCancel').onclick=close;
 $e('layoutSave').onclick=()=>{try{const next=load(draft);localStorage.setItem(key,JSON.stringify(next));saved=next;apply(true);close()}catch{notice('Não foi possível salvar neste aparelho. Você pode baixar os layouts para guardar as mudanças.')}};
 $e('layoutTarget').onchange=()=>{target=$e('layoutTarget').value;refreshLists();notice('Editando a disposição de '+(target==='mobile'?'celular':'notebook')+'.')};
 $e('layoutMode').onchange=()=>{previewMode=$e('layoutMode').value;schedulePreview()};$e('layoutPhoneWidth').onchange=schedulePreview;
 $e('layoutBoardSize').oninput=()=>{const c=draft[target];c.boardSize=Number($e('layoutBoardSize').value);c.custom=true;$e('layoutSizeValue').textContent=c.boardSize+'%';schedulePreview()};
 $e('layoutMenuFirst').onchange=()=>{draft[target].menuFirst=$e('layoutMenuFirst').checked;draft[target].custom=true;schedulePreview()};
 $e('layoutReset').onclick=()=>{draft[target]=defaults();refreshLists();notice('Layout original na prévia. Salve para confirmar ou cancele para manter o anterior.')};
 $e('layoutExport').onclick=async()=>{if(window.savePrimeiroLanceLayout){try{await window.savePrimeiroLanceLayout(JSON.stringify(load(draft),null,2));notice('Layouts salvos no local escolhido.')}catch(error){notice(error.message)}return}const blob=new Blob([JSON.stringify(load(draft),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Primeiro-Lance-layouts.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('Arquivo de layouts preparado. No outro aparelho, abra Editar layout e Importar layouts.')};
 $e('layoutImport').onclick=()=>$e('layoutFile').click();
 $e('layoutFile').onchange=async()=>{try{const file=$e('layoutFile').files[0];if(!file)return;if(file.size>100000)throw Error('Arquivo grande demais para um layout.');draft=load(JSON.parse(await file.text()));refreshLists();notice('Layouts importados na prévia. Clique em Salvar e voltar para aplicar.')}catch(error){notice(error.message||'Não foi possível ler esse arquivo.')}finally{$e('layoutFile').value=''}};
 editor.addEventListener('keydown',event=>{
  event.stopPropagation();
  if(event.key==='Escape'){event.preventDefault();close()}
  if(event.key==='Tab'){const focusable=[...editor.querySelectorAll('button,select,input,[tabindex]')].filter(el=>!el.disabled&&el.getClientRects().length&&el.tabIndex>=0);const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}
 });
 window.layoutEditor={refresh:()=>apply(),close:()=>{if(opened){close();return true}return false}};
 matchMedia('(max-width:780px)').addEventListener('change',()=>apply(true));
 new MutationObserver(()=>apply()).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
 window.addEventListener('DOMContentLoaded',()=>{discover();apply()},{once:true});
 apply();
})();
