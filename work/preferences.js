// Tela separada de aparência; a partida e os controles existentes são preservados.
let preferencesScroll={page:0,menu:0},preferencesTitle=document.title;
function showPreferences(open){
 const page=$('preferencesPage'),trainer=document.querySelector('main:not(#preferencesPage)');
 if(open&&!trainer.hidden)preferencesScroll={page:scrollY,menu:document.querySelector('.layout>aside').scrollTop};
 trainer.hidden=open;page.hidden=!open;$('configTab').setAttribute('aria-expanded',String(open));
 document.title=open?'Configurações · Primeiro Lance':preferencesTitle;
 if(open){window.scrollTo(0,0);$('preferencesTitle').focus({preventScroll:true})}
 else{render();requestAnimationFrame(()=>{document.querySelector('.layout>aside').scrollTop=preferencesScroll.menu;window.scrollTo(0,preferencesScroll.page);$('configTab').focus({preventScroll:true})})}
}
function closePreferences(){
 if(window.bottomMenu?.close())return true;
 if(window.layoutEditor?.close())return true;
 if($('preferencesPage').hidden)return false;
 if(history.state?.primeiroLancePreferences)history.back();
 else{history.replaceState(null,'',location.pathname+location.search);showPreferences(false)}
 return true;
}
function setupPreferences(){
 $('configTab').onclick=()=>{history.pushState({primeiroLancePreferences:true},'','#configuracoes');showPreferences(true)};
 $('closePreferences').onclick=closePreferences;
 window.addEventListener('popstate',()=>showPreferences(location.hash==='#configuracoes'));
 if(location.hash==='#configuracoes')showPreferences(true);
}
