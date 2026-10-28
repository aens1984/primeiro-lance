/* Android-only adapter. The desktop build does not load this file. */
(() => {
  'use strict';
  if (!window.PrimeiroLanceAndroid) return;
  const originalFetch=window.fetch.bind(window),pending=new Map();
  let sequence=0;
  window.stockfishConnection={token:'android-local',platform:'android',ready:false,starting:true};
  window.PrimeiroLanceNativeResult=(id,result,error)=>{
    const task=pending.get(id); if(!task)return;
    pending.delete(id); clearTimeout(task.timer); task.clean();
    if(error)task.reject(Error(error)); else task.resolve(result);
  };
  function native(action,data={},signal,timeout=90000){
    return new Promise((resolve,reject)=>{
      if(signal?.aborted){reject(new DOMException('Operação cancelada.','AbortError'));return}
      const id=String(++sequence);
      const cancel=()=>{const task=pending.get(id);if(!task)return;pending.delete(id);clearTimeout(task.timer);task.clean();reject(new DOMException('Operação cancelada.','AbortError'))};
      const timer=setTimeout(()=>{const task=pending.get(id);if(!task)return;pending.delete(id);task.clean();reject(Error('A operação demorou demais. Tente novamente.'))},timeout);
      pending.set(id,{resolve,reject,timer,clean:()=>signal?.removeEventListener('abort',cancel)});
      signal?.addEventListener('abort',cancel,{once:true});
      try{window.PrimeiroLanceAndroid.request(id,action,JSON.stringify(data))}
      catch(e){const task=pending.get(id);pending.delete(id);clearTimeout(timer);task.clean();reject(e)}
    });
  }

  const MAX=24*1024*1024,dbReady=new Promise((resolve,reject)=>{
    const request=indexedDB.open('primeiro-lance-android',1);
    request.onupgradeneeded=()=>{request.result.createObjectStore('collections',{keyPath:'id'});request.result.createObjectStore('meta')};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(Error('Não foi possível abrir a biblioteca neste celular.'));
  });
  // Attach an early rejection handler; callers still receive the original failure.
  dbReady.catch(()=>{});
  async function transaction(stores,mode,action){
    const db=await dbReady;
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(stores,mode);let value;
      tx.oncomplete=()=>resolve(value);tx.onabort=tx.onerror=()=>reject(Error('Não foi possível guardar a biblioteca. Confira o espaço disponível no celular.'));
      try{action(tx,x=>{value=x})}catch(e){tx.abort();reject(e)}
    });
  }
  const get=(store,key)=>transaction([store],'readonly',(tx,set)=>{const r=key===undefined?tx.objectStore(store).getAll():tx.objectStore(store).get(key);r.onsuccess=()=>set(r.result)});
  const put=(store,key,value)=>transaction([store],'readwrite',tx=>{if(store==='collections')tx.objectStore(store).put(value);else tx.objectStore(store).put(value,key)});
  const cache=new Map();let seeded;
  const seed=()=>seeded||(seeded=(async()=>{
    const data=await (await originalFetch('/seed.json')).json();
    for(const item of data.collections)if(!await get('collections',item.id))await put('collections',null,item);
    if(!await get('meta','catalog'))await put('meta','catalog',data.catalog);
  })().catch(e=>{seeded=null;throw e}));
  async function digest(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,20)}
  function gamesOf(item){
    if(!item)throw Error('Coleção não encontrada.');
    if(!cache.has(item.id)){cache.set(item.id,splitPgn(item.text));if(cache.size>3)cache.delete(cache.keys().next().value)}
    return cache.get(item.id);
  }
  function headers(text){const out={};for(const m of text.matchAll(/^\s*\[(\w+)\s+"((?:\\.|[^"\\])*)"\s*\]/gm))out[m[1]]=m[2].replace(/\\(["\\])/g,'$1');return out}
  function validateCollection(item){
    if(typeof item.text!=='string'||new TextEncoder().encode(item.text).length>MAX)throw Error('A coleção excede o limite de 24 MB.');
    const games=splitPgn(item.text);
    if(!games.length||games.length>40000||games.some(x=>!/^\s*\[/.test(x)))throw Error('PGN inválido ou coleção grande demais.');
    const board=new Chess();board.loadPgn(games[0]);
    return {...item,count:games.length,bytes:new TextEncoder().encode(item.text).length};
  }
  async function library(route,data){
    await seed();
    const url=new URL(route,'https://local.invalid'),path=url.pathname,query=url.searchParams;
    if(path==='state'||path==='/state')return {collections:(await get('collections')).map(({text,...item})=>item),catalog:await get('meta','catalog'),favorites:await get('meta','favorites')||[]};
    if(path==='/catalog'){
      const twic=data.source==='twic',source=twic?'TWIC':'PGN Mentor',base=twic?'https://theweekinchess.com/twic':'https://www.pgnmentor.com/files.html';
      const {text}=await native('remote',{url:base}),items=new Map();
      for(const m of text.matchAll(/href\s*=\s*["']([^"']+)["']/gi)){
        let link;try{link=new URL(m[1],base)}catch{continue}
        if(link.protocol!=='https:'||link.port||link.username||link.password||link.search||link.hash)continue;
        if(twic?link.hostname!=='theweekinchess.com'||!/^\/(?:zips|assets\/files\/pgn)\/twic\d+g\.zip$/.test(link.pathname):link.hostname!=='www.pgnmentor.com'||!/^\/(players|openings|events)\/[\w.-]+\.(pgn|zip)$/.test(link.pathname))continue;
        const file=link.pathname.split('/').pop(),title=twic?'TWIC — edição '+file.match(/\d+/)[0]:file.replace(/\.(pgn|zip)$/,'').replace(/([a-z])([A-Z])/g,'$1 $2');
        items.set(link.href,{id:await digest(link.href),title,source,url:link.href});
      }
      if(!items.size)throw Error('Não foi possível reconhecer o catálogo desta fonte.');
      const catalog=[...(await get('meta','catalog')).filter(x=>x.source!==source),...items.values()];await put('meta','catalog',catalog);return {catalog};
    }
    if(path==='/download'){
      const item=(await get('meta','catalog')).find(x=>x.id===data.id);if(!item)throw Error('Escolha uma coleção do catálogo.');
      const id=await digest(item.url),saved=await get('collections',id);if(saved)return {id};
      const {text}=await native('remote',{url:item.url});
      await put('collections',null,validateCollection({...item,id,text,saved:new Date().toISOString()}));return {id};
    }
    const id=query.get('collection')||data?.collection;
    const item=await get('collections',id),games=gamesOf(item),favorites=await get('meta','favorites')||[];
    if(path==='/games'){
      const q=(query.get('q')||'').toLocaleLowerCase('pt-BR').slice(0,200),only=query.get('favorites')==='1',offset=Math.max(0,Number(query.get('offset'))||0);
      const all=games.map((s,i)=>({i,...headers(s),favorite:favorites.includes(id+':'+i)})).filter(h=>(!only||h.favorite)&&(!q||[h.White,h.Black,h.Event,h.Date,h.Result].join(' ').toLocaleLowerCase('pt-BR').includes(q)));
      return {total:all.length,games:all.slice(offset,offset+40)};
    }
    if(path==='/game'||path==='/favorite'){
      const i=Number(path==='/game'?query.get('i'):data.i);if(!Number.isInteger(i)||i<0||!games[i])throw Error('Partida não encontrada.');
      if(path==='/game'){const board=new Chess();board.loadPgn(games[i]);return {pgn:games[i]}}
      const key=id+':'+i,updated=favorites.filter(x=>x!==key);if(data.favorite===true)updated.push(key);await put('meta','favorites',updated);return {ok:true};
    }
    throw Error('Operação desconhecida da biblioteca.');
  }
  window.fetch=async(input,options={})=>{
    const url=new URL(typeof input==='string'?input:input.url,location.href);
    if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return originalFetch(input,options);
    try{
      const data=options.body?JSON.parse(options.body):{};let result;
      if(url.pathname==='/api/analyse'){
        const board=new Chess(data.fen);for(const move of data.moves||[])board.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]});
        if(board.isGameOver())return Response.json({engine:'Stockfish',move:null,terminal:true});
        result=await native('analyse',data,options.signal,45000);
        if(!result.move)throw Error('O Stockfish não retornou um lance.');
        board.move(result.move); // Also validate every native response against the actual position.
      }else if(url.pathname.startsWith('/api/library/'))result=await library(url.pathname.slice('/api/library'.length)+url.search,data);
      else throw Error('Operação desconhecida.');
      return Response.json(result);
    }catch(e){if(e.name==='AbortError')throw e;return Response.json({error:e.message},{status:503})}
  };

  document.addEventListener('DOMContentLoaded',async()=>{
    // Android uses a document picker for exports rather than blob downloads.
    window.savePrimeiroLanceLayout=text=>native('save',{name:'Primeiro-Lance-layouts.json',text},undefined,600000);
    $('export').onclick=async()=>{
      try{await native('save',{name:'minha-partida.pgn',text:(mode==='pgn'&&pgnGames.length?pgnGames[pgnSelected].source:game.pgn())||'[Event "Treino Primeiro Lance"]\n\n*'});$('coach').textContent='Partida salva no local escolhido.'}
      catch(e){$('coach').textContent=e.message}
    };
    for(const el of document.querySelectorAll('.appearance-note'))el.textContent=el.textContent.replaceAll('neste navegador','neste celular');
    const libraryPanel=$('libraryPanel');
    libraryPanel.querySelector('.eyebrow').textContent='Biblioteca neste celular';
    libraryPanel.querySelector('.lesson').textContent='Coleções e favoritos ficam neste celular. As coleções salvas funcionam sem internet. Use o backup abaixo para guardar uma cópia. Não há sincronização automática com o notebook.';
    $('libraryDownload').textContent='Baixar e guardar no celular';
    const oldTask=window.libraryTask; // libraryTask is a global function in the existing interface.
    if(oldTask)window.libraryTask=task=>oldTask(async()=>{const result=await task();$('libraryMessage').textContent=$('libraryMessage').textContent.replaceAll('no notebook','no celular');return result});
    const help=document.querySelector('aside>details p:nth-of-type(2)');
    if(help)help.textContent='O Stockfish roda neste celular. As dicas e análises usam a força completa; o adversário segue o nível escolhido. O indicador mostra quando o adversário básico está ativo. Seus dados ficam neste aparelho. Exporte partidas e backups para guardar uma cópia.';
    const card=document.createElement('div');card.className='card';card.id='androidData';
    card.innerHTML='<div class="eyebrow">No seu celular</div><h2>Guardar meus estudos</h2><p class="lesson">O backup guarda biblioteca, favoritos, preferências, histórico de notas e a última sessão concluída. Desinstalar o aplicativo apaga os dados locais. Guarde o backup em uma pasta sua.</p><button class="action" id="androidBackup">Salvar backup</button><label for="androidRestore">Restaurar um backup do Primeiro Lance</label><input id="androidRestore" type="file" accept=".json,application/json"><p id="androidDataMessage" class="lesson" role="status"></p><details><summary>Sobre e licenças</summary><p>Primeiro Lance · Android · versão 1.0.0. Motor Stockfish 19 (GPLv3). Interface e integração Android: GPLv3. Bibliotecas chess.js, PDF.js e Tesseract mantêm suas próprias licenças. O pacote de distribuição acompanha os códigos-fonte correspondentes.</p><button class="action" id="androidLicenses">Ver licenças</button><pre id="androidLicenseText" hidden style="white-space:pre-wrap;max-height:300px;overflow:auto;font-size:11px"></pre></details>';
    document.querySelector('aside').append(card);
    if($('studyTab').classList.contains('active'))openStudyMenu();
    $('androidLicenses').onclick=async()=>{const el=$('androidLicenseText');el.hidden=!el.hidden;if(!el.hidden)try{el.textContent=(await (await originalFetch('/stockfish-license.txt')).text())+'\n\n'+['license','pdfLicense','ocrLicense'].map(id=>$(id).textContent).join('\n\n')}catch{el.textContent='Consulte as licenças no pacote de distribuição.'}};
    window.saveAndroidSession=()=>{
      if(busy||mode==='puzzle')return;
      try{localStorage.setItem('primeiro-lance-android-sessao',JSON.stringify({pgn:mode==='pgn'&&pgnGames.length?pgnGames[pgnSelected].source:game.pgn(),mode,ply:pgnPly,assisted:[...assistedPositions],references:[...engineMoveReferences]}))}catch{}
    };
    setInterval(()=>window.saveAndroidSession(),1500);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)window.saveAndroidSession()});
    try{
      const saved=JSON.parse(localStorage.getItem('primeiro-lance-android-sessao')||'null');
      if(saved?.pgn){
        const parsed=readPgn(saved.pgn);
        if(saved.mode==='pgn'){pgnGames=parsed;pgnSelected=0;$('pgnGame').replaceChildren(new Option('Partida retomada',0));setMode('pgn');showPgn(saved.ply)}
        else {game.loadPgn(saved.pgn);last=game.history({verbose:true}).at(-1)||null;render()}
        for(const key of saved.assisted||[])assistedPositions.add(key);
        for(const [key,value] of saved.references||[])engineMoveReferences.set(key,value);
        $('androidDataMessage').textContent='Sua última sessão foi retomada.';
      }
    }catch{$('androidDataMessage').textContent='A última sessão não pôde ser retomada. Seus backups e coleções continuam disponíveis.'}
    $('androidBackup').onclick=async()=>{
      const button=$('androidBackup');button.disabled=true;
      try{await seed();window.saveAndroidSession();const preferences={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith('primeiro-lance'))preferences[key]=localStorage.getItem(key)}
        const backup={format:'primeiro-lance-android',version:1,date:new Date().toISOString(),collections:await get('collections'),favorites:await get('meta','favorites')||[],catalog:await get('meta','catalog'),preferences};
        await native('save',{name:'primeiro-lance-backup.json',text:JSON.stringify(backup)},undefined,600000);$('androidDataMessage').textContent='Backup salvo no local escolhido.';
      }catch(e){$('androidDataMessage').textContent=e.message}finally{button.disabled=false}
    };
    $('androidRestore').onchange=async e=>{
      const file=e.target.files[0];if(!file)return;
      try{
        if(busy)throw Error('Aguarde a análise terminar antes de restaurar.');
        if(file.size>64*1024*1024)throw Error('O backup excede o limite de 64 MB.');
        const backup=JSON.parse(await file.text());
        if(backup.format!=='primeiro-lance-android'||backup.version!==1||!Array.isArray(backup.collections)||!Array.isArray(backup.favorites)||typeof backup.preferences!=='object'||!backup.preferences)throw Error('Este arquivo não é um backup compatível.');
        const collections=backup.collections.map(item=>{
          if(!item||!/^[a-f0-9]{20}$/.test(item.id)||typeof item.title!=='string')throw Error('Coleção inválida no backup.');
          return validateCollection({id:item.id,title:item.title.slice(0,200),source:String(item.source||''),url:String(item.url||''),saved:String(item.saved||''),text:item.text});
        });
        if(!backup.favorites.every(x=>typeof x==='string'&&/^[a-f0-9]{20}:\d{1,5}$/.test(x)))throw Error('Favoritos inválidos no backup.');
        if(!Object.entries(backup.preferences).every(([key,value])=>key.startsWith('primeiro-lance')&&typeof value==='string'))throw Error('Preferências inválidas no backup.');
        if(!confirm('Adicionar as coleções deste backup e restaurar suas preferências e última sessão? O aplicativo será reaberto.'))return;
        const favorites=[...new Set([...(await get('meta','favorites')||[]),...backup.favorites])];
        await transaction(['collections','meta'],'readwrite',tx=>{for(const item of collections)tx.objectStore('collections').put(item);tx.objectStore('meta').put(favorites,'favorites')});
        for(const [key,value] of Object.entries(backup.preferences))localStorage.setItem(key,value);
        // Prevent the current session from overwriting the just-restored session.
        window.saveAndroidSession=()=>{};location.reload();
      }catch(error){$('androidDataMessage').textContent=error.message}finally{e.target.value=''}
    };
    try{const info=await native('engineInfo',{},undefined,45000);engineConnected=true;engineLast=info;window.stockfishConnection.ready=true}
    catch(e){engineConnected=false;$('androidDataMessage').textContent='Não foi possível iniciar o Stockfish. O adversário básico está disponível. '+e.message}
    finally{window.stockfishConnection.starting=false;refreshEngineStatus()}
  });
})();
