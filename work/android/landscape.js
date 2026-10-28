// O Android chama esta função após carregar a página e ao girar o aparelho.
// Não usa a proporção da WebView: o teclado também pode reduzir sua altura.
window.setAndroidLandscape=landscape=>{
 const enabled=Boolean(landscape);
 if(enabled)window.layoutEditor?.close();
 if(enabled&&!$('preferencesPage').hidden)closePreferences();
 document.documentElement.classList.toggle('android-landscape',enabled);
 if(enabled)window.scrollTo(0,0);
 requestAnimationFrame(()=>{if(board3D)board3D.landscapeFit=enabled;boardMotion.draw2D();board3D?.draw()});
};
