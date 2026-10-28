// Navegação móvel: os controles originais mudam de lugar, sem recriar a partida.
(()=>{
 const $b=id=>document.getElementById(id),trainer=document.querySelector('main:not(#preferencesPage)'),section=trainer.querySelector('.layout>section');
 const style=document.createElement('style');style.textContent=`/*BOTTOM_MENU_CSS*/`;document.head.append(style);
 const dock=document.createElement('nav');dock.id='bottomDock';dock.hidden=true;dock.setAttribute('aria-label','Menu principal');
 const items=[['play','♟','Jogar'],['training','♞','Treinar'],['games','▤','Partidas'],['review','◈','Análise'],['settings','⚙','Ajustes']];
 dock.innerHTML=items.map(([id,icon,label])=>`<button type="button" data-bottom-page="${id}" aria-expanded="false" aria-controls="bottomSheet"><span aria-hidden="true">${icon}</span>${label}</button>`).join('');
 const overlay=document.createElement('div');overlay.id='bottomOverlay';overlay.hidden=true;
 overlay.innerHTML='<section id="bottomSheet" role="dialog" aria-modal="true" aria-labelledby="bottomTitle" tabindex="-1"><div class="bottom-heading"><h2 id="bottomTitle" tabindex="-1"></h2><button type="button" id="bottomClose" aria-label="Fechar painel e voltar ao tabuleiro">✕</button></div><div id="bottomPages"></div></section>';
 document.body.append(dock,overlay);
 const pages={};for(const [id] of items){pages[id]=document.createElement('div');pages[id].className='bottom-page';pages[id].hidden=true;$b('bottomPages').append(pages[id])}
 const makeButton=(page,text,action)=>{const button=document.createElement('button');button.type='button';button.className='action';button.textContent=text;button.onclick=action;pages[page].append(button);return button};
 makeButton('settings','Cores do tabuleiro e peças',()=>{close();$b('configTab').click()});
 makeButton('settings','Editar disposição do layout',()=>{close();$b('editLayout').click()});
 const gameTabs=document.createElement('div');gameTabs.className='bottom-game-tabs';pages.games.append(gameTabs);
 const gameContent={};for(const [id,label] of [['session','Lances'],['pgn','PGN'],['library','Biblioteca'],['book','PDF / imagem']]){
  const button=document.createElement('button');button.type='button';button.className='action';button.textContent=label;button.dataset.gamePage=id;gameTabs.append(button);
  const content=document.createElement('div');content.hidden=id!=='session';gameContent[id]=content;pages.games.append(content);
  button.onclick=()=>{selectGame(id);if(id==='pgn')$b('pgnTab').click();if(id==='library')$b('libraryTab').click();if(id==='book')$b('bookPanel').hidden=false};
 }
 function selectGame(id){for(const [key,page] of Object.entries(gameContent))page.hidden=key!==id;for(const button of gameTabs.children)button.setAttribute('aria-pressed',String(button.dataset.gamePage===id))}
 selectGame('session');
 const quickHint=document.createElement('button');quickHint.id='bottomHint';quickHint.type='button';quickHint.className='action primary';quickHint.textContent='💡 Dica';quickHint.onclick=()=>{open('training');$b('hint').click()};
 let active=false,current='',slots=[],lastFocus=null;
 function move(node,target){if(!node||slots.some(s=>s.node===node))return;const anchor=document.createComment('posição original do controle');node.before(anchor);slots.push({node,anchor});target.append(node)}
 function collect(){
  move($b('settings'),pages.play);move($b('coach').parentElement,pages.training);move($b('puzzleInfo'),pages.training);
  move($b('trainingReview'),pages.review);move($b('sessionHistory'),gameContent.session);move($b('export'),gameContent.session);
  move($b('pgnPanel'),gameContent.pgn);move($b('libraryPanel'),gameContent.library);move($b('bookPanel'),gameContent.book);
  move($b('bookTab'),gameContent.book);move($b('androidData'),pages.settings);move($b('layoutHelp'),pages.settings);
  const board=$b('board').closest('.board-wrap');move($b('tools3d'),board.parentElement);
  if(board.nextElementSibling!==$b('tools3d'))board.after($b('tools3d'));
 }
 function eligible(){return matchMedia('(max-width:780px)').matches&&!document.documentElement.classList.contains('android-landscape')&&!document.body.classList.contains('layout-editing')&&$b('preferencesPage').hidden}
 function sync(){
  if(eligible()&&!active){active=true;document.body.classList.add('bottom-navigation');collect();$b('undo').after(quickHint);dock.hidden=false;window.scrollTo(0,0);requestAnimationFrame(()=>board3D?.draw())}
  else if(!eligible()&&active){close();active=false;document.body.classList.remove('bottom-navigation');dock.hidden=true;quickHint.remove();for(const {node,anchor} of slots){anchor.before(node);anchor.remove()}slots=[];$b('settings').hidden=mode!=='play';$b('pgnPanel').hidden=mode!=='pgn';$b('puzzleInfo').hidden=mode!=='puzzle';window.layoutEditor?.refresh();requestAnimationFrame(()=>board3D?.draw())}
  else if(active)collect();
 }
 function open(id){
  if(!active)return;lastFocus=document.activeElement;current=id;
  if(id==='training')openStudyMenu();if(id==='play')$b('settings').hidden=false;
  for(const [key,page] of Object.entries(pages))page.hidden=key!==id;
  $b('bottomTitle').textContent=items.find(item=>item[0]===id)[2];overlay.hidden=false;document.body.classList.add('bottom-panel-open');trainer.inert=true;
  document.querySelector('body>header').inert=true;
  for(const button of dock.children)button.setAttribute('aria-expanded',String(button.dataset.bottomPage===id));
  $b('bottomPages').scrollTop=0;$b('bottomTitle').focus({preventScroll:true});
 }
 function close(){if(overlay.hidden)return false;overlay.hidden=true;document.body.classList.remove('bottom-panel-open');trainer.inert=false;document.querySelector('body>header').inert=false;for(const button of dock.children)button.setAttribute('aria-expanded','false');const target=dock.querySelector(`[data-bottom-page="${current}"]`);(target||lastFocus)?.focus({preventScroll:true});current='';return true}
 for(const button of dock.children)button.onclick=()=>current===button.dataset.bottomPage?close():open(button.dataset.bottomPage);
 $b('bottomClose').onclick=close;overlay.onclick=event=>{if(event.target===overlay)close()};
 overlay.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}
  if(event.key==='Tab'){const controls=[...overlay.querySelectorAll('button,input,select,textarea,a,[tabindex]')].filter(el=>el.tabIndex>=0&&!el.disabled&&el.getClientRects().length),first=controls[0],last=controls.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===$b('bottomTitle'))){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}
 });
 // Abas antigas continuam disponíveis no notebook e nas rotinas de importação.
 const originalPriority=prioritizeMenuPanel;prioritizeMenuPanel=function(ids,tab){if(!active)return originalPriority(ids,tab);for(const button of trainer.querySelectorAll('.tabs button'))button.classList.toggle('active',button.id===tab)};
 const edit=$b('editLayout'),editOriginal=edit.onclick;edit.onclick=()=>{suspendForEditor=true;syncEditor();editOriginal();suspendForEditor=false;if(!document.body.classList.contains('layout-editing'))sync()};
 let suspendForEditor=false;
 function syncEditor(){if(active){document.body.classList.add('layout-editing');sync();document.body.classList.remove('layout-editing')}}
 // A troca de orientação e a tela de aparência restauram os lugares originais.
 const originalPreferences=showPreferences;showPreferences=function(opened){if(opened)close();originalPreferences(opened);sync()};
 const originalNew=$b('new').onclick;$b('new').onclick=event=>{if(mode!=='play')setMode('play');else originalNew?.call($b('new'),event);close()};
 $b('next').addEventListener('click',()=>{if(!busy)close()});
 $b('bookApply').addEventListener('click',()=>{if(mode==='pgn'&&/^\d+ lances individuais validados/.test($b('bookResult').textContent))close()});
 window.bottomMenu={get active(){return active},open,close};
 matchMedia('(max-width:780px)').addEventListener('change',sync);
 new MutationObserver(()=>{if(!suspendForEditor)sync()}).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
 new MutationObserver(()=>{if(!suspendForEditor)sync()}).observe(document.body,{attributes:true,attributeFilter:['class']});
 window.addEventListener('DOMContentLoaded',sync,{once:true});sync();
})();
