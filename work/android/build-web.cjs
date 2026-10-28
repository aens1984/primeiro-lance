// Prepare the Android edition from the current desktop source, without changing its gateway.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'../..');
execFileSync(process.execPath,['work/build.cjs'],{cwd:root,stdio:'inherit'});
const assets=path.join(__dirname,'assets');fs.mkdirSync(assets,{recursive:true});
let html=fs.readFileSync(path.join(root,'outputs/Treinador-de-Xadrez.html'),'utf8');
html=html.replace('<head>','<head><script src="/android-runtime.js"></script>')
 .replaceAll('Abra pelo atalho Primeiro Lance no Windows para acessar a biblioteca.','Não foi possível abrir a biblioteca local. Feche e abra o aplicativo.')
 .replaceAll('Feche e abra o Primeiro Lance pelo atalho do Windows para ativar a biblioteca.','Feche e abra o Primeiro Lance para tentar abrir a biblioteca local.')
 .replaceAll('Abra o treinador pelo atalho com Stockfish para receber uma avaliação.','O Stockfish local não está disponível para avaliar esta posição.')
 .replaceAll('O Stockfish está indisponível. Reabra pelo atalho e tente novamente.','O Stockfish está indisponível. Feche e abra o aplicativo e tente novamente.')
 .replaceAll('O adversário está indisponível. Reabra pelo atalho com Stockfish.','O adversário está indisponível. Feche e abra o aplicativo para tentar novamente.');
html=html.replace('</head>','<style>'+fs.readFileSync(path.join(__dirname,'landscape.css'),'utf8')+'</style></head>')
 .replace('</body>','<script>'+fs.readFileSync(path.join(__dirname,'landscape.js'),'utf8')+'</script></body>');
fs.writeFileSync(path.join(assets,'index.html'),html);
fs.copyFileSync(path.join(__dirname,'android-runtime.js'),path.join(assets,'android-runtime.js'));
const seed={collections:[],catalog:[['Morphy','Paul Morphy'],['Capablanca','José Raúl Capablanca'],['Fischer','Bobby Fischer'],['Carlsen','Magnus Carlsen'],['Kasparov','Garry Kasparov'],['Karpov','Anatoly Karpov'],['Anand','Viswanathan Anand']].map(([file,title])=>({id:'mentor-'+file,title,source:'PGN Mentor',url:'https://www.pgnmentor.com/players/'+file+'.zip'}))};
for(const [file,title,key] of [['Partidas-de-exemplo.pgn','Primeiros estudos — exemplos','exemplos'],['Partida-da-Opera.pgn','Clássicos — Partida da Ópera','opera']]){
 const text=fs.readFileSync(path.join(root,'outputs',file),'utf8');const {splitPgn}=require('../../outputs/stockfish-support/pgn-split.cjs');
 seed.collections.push({id:crypto.createHash('sha256').update('local:'+key).digest('hex').slice(0,20),title,source:'Primeiro Lance',url:'local:'+key,count:splitPgn(text).length,bytes:Buffer.byteLength(text),text});
}
fs.writeFileSync(path.join(assets,'seed.json'),JSON.stringify(seed));
const out=path.join(root,'outputs/Android'),source=path.join(out,'fontes');
fs.mkdirSync(source,{recursive:true});
// Explicit file list: never copy pairing data, downloaded collections, logs or signing keys.
for(const file of ['MainActivity.java','StockfishEngine.java','CompileAndroid.java','AndroidManifest.xml','android-runtime.js','landscape.css','landscape.js','build.ps1','stockfish-build.ps1','LEIA-ME.txt','COPYING.txt'])fs.copyFileSync(path.join(__dirname,file),path.join(source,file));
for(const dir of ['assets','res'])fs.cpSync(path.join(__dirname,dir),path.join(source,dir),{recursive:true});
fs.copyFileSync(path.join(__dirname,'Gerar APK.cmd'),path.join(out,'Gerar APK.cmd'));
fs.copyFileSync(path.join(__dirname,'LEIA-ME.txt'),path.join(out,'LEIA-ME.txt'));
console.log('Edição Android preparada em outputs/Android. O APK só estará disponível após a compilação nativa.');
