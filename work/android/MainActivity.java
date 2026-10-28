package br.com.primeirolance.treinador;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.*;
import android.webkit.*;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.zip.*;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final int PICK=1, SAVE=2, MAX=24*1024*1024;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private final ExecutorService tasks = Executors.newSingleThreadExecutor();
    private StockfishEngine engine;
    private String saveId;
    private byte[] saveBytes;
    private boolean destroyed;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,this::handleBack);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setDecorFitsSystemWindows(false);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(16,26,23));
        // Reserve a área das barras no contêiner: padding na WebView não
        // posiciona de forma confiável o documento abaixo da barra de status.
        android.widget.FrameLayout safeArea = new android.widget.FrameLayout(this);
        safeArea.setBackgroundColor(Color.rgb(16,26,23));
        final int topGap = Math.round(8 * getResources().getDisplayMetrics().density);
        safeArea.setPadding(0,topGap,0,0);
        safeArea.addView(web,new android.widget.FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        safeArea.setOnApplyWindowInsetsListener((view,insets) -> {
            android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            android.graphics.Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
            boolean landscape=getResources().getConfiguration().orientation==android.content.res.Configuration.ORIENTATION_LANDSCAPE;
            view.setPadding(bars.left,bars.top+(landscape?0:topGap),bars.right,Math.max(bars.bottom,keyboard.bottom));
            return WindowInsets.CONSUMED;
        });
        setContentView(safeArea);
        safeArea.requestApplyInsets();
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // User-selected content:// documents only.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        android.webkit.CookieManager.getInstance().setAcceptCookie(false);
        engine = new StockfishEngine(getApplicationInfo().nativeLibraryDir + "/libstockfish.so");
        web.addJavascriptInterface(new Bridge(), "PrimeiroLanceAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view,String url) {
                updateDisplayOrientation();
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!local(uri)) return blocked();
                String path = uri.getPath();
                if (path==null || path.equals("/")) path="/index.html";
                // An explicit allowlist prevents access to other bundled or private files.
                if (!Arrays.asList("/index.html","/android-runtime.js","/seed.json","/stockfish-license.txt").contains(path)) return blocked();
                try {
                    String mime=path.endsWith(".html")?"text/html":path.endsWith(".js")?"text/javascript":path.endsWith(".json")?"application/json":"text/plain";
                    Map<String,String> headers=new HashMap<>();
                    headers.put("X-Content-Type-Options","nosniff");
                    headers.put("Cache-Control","no-store");
                    headers.put("Content-Security-Policy","default-src 'self' blob: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; connect-src 'self' blob: data:; img-src 'self' blob: data:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");
                    return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,getAssets().open(path.substring(1)));
                } catch(IOException e) { return blocked(); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (local(request.getUrl())) return false;
                if (request.isForMainFrame() && request.hasGesture() && "https".equals(request.getUrl().getScheme())) openExternal(request.getUrl());
                return true;
            }
        });
        // Worker fetches must also remain within the bundled application.
        ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) { return blocked(); }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback!=null) fileCallback.onReceiveValue(null);
                fileCallback=callback;
                Intent picker=new Intent(Intent.ACTION_OPEN_DOCUMENT);
                picker.addCategory(Intent.CATEGORY_OPENABLE); picker.setType("*/*");
                picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,false);
                try { startActivityForResult(picker,PICK); }
                catch(ActivityNotFoundException e) { fileCallback.onReceiveValue(null); fileCallback=null; }
                return true;
            }
            @Override public boolean onJsAlert(WebView view,String url,String message,JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("OK",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show(); return true;
            }
            @Override public boolean onJsConfirm(WebView view,String url,String message,JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("Continuar",(d,w)->result.confirm()).setNegativeButton("Cancelar",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show(); return true;
            }
        });
        web.loadUrl("https://"+HOST+"/index.html");
    }

    private boolean local(Uri u) { return "https".equals(u.getScheme()) && HOST.equals(u.getHost()) && u.getPort()==-1 && u.getUserInfo()==null; }
    private static WebResourceResponse blocked() { return new WebResourceResponse("text/plain","UTF-8",403,"Forbidden",Collections.emptyMap(),new ByteArrayInputStream(new byte[0])); }
    private void openExternal(Uri u) { try { startActivity(new Intent(Intent.ACTION_VIEW,u).addCategory(Intent.CATEGORY_BROWSABLE)); } catch(ActivityNotFoundException ignored) {} }

    public final class Bridge {
        @JavascriptInterface public void request(String id,String action,String json) {
            if (destroyed || !id.matches("[0-9]{1,12}") || json==null || json.length()>64*1024*1024) return;
            tasks.execute(() -> {
                try {
                    JSONObject data=new JSONObject(json),result;
                    switch(action) {
                        case "engineInfo": result=engine.info(); break;
                        case "analyse": result=engine.analyse(data); break;
                        case "remote": result=new JSONObject().put("text",remoteText(data.getString("url"))); break;
                        case "save":
                            byte[] bytes=data.getString("text").getBytes(StandardCharsets.UTF_8);
                            if(bytes.length>64*1024*1024) throw new IOException("O arquivo excede o limite de 64 MB.");
                            String name=data.optString("name","minha-partida.pgn").replaceAll("[^a-zA-Z0-9._-]","_");
                            String mime=name.endsWith(".json")?"application/json":"application/x-chess-pgn";
                            runOnUiThread(()->{
                                if(saveId!=null) { complete(id,null,"Conclua o salvamento anterior."); return; }
                                saveId=id; saveBytes=bytes;
                                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE,name);
                                try { startActivityForResult(intent,SAVE); }
                                catch(ActivityNotFoundException e) { saveId=null; saveBytes=null; complete(id,null,"Não foi possível abrir o seletor de arquivos."); }
                            });
                            return;
                        default: throw new IOException("Operação desconhecida.");
                    }
                    complete(id,result,null);
                } catch(Exception e) {
                    String message=e.getMessage();
                    if(message==null || e instanceof SocketTimeoutException || e instanceof UnknownHostException || e instanceof ConnectException)
                        message="Não foi possível concluir a operação. Confira a internet para baixar coleções; as salvas continuam disponíveis.";
                    complete(id,null,message);
                }
            });
        }
    }

    private void complete(String id,JSONObject result,String error) {
        runOnUiThread(()->{
            if(destroyed) return;
            web.evaluateJavascript("window.PrimeiroLanceNativeResult("+JSONObject.quote(id)+","+(result==null?"null":result.toString())+","+(error==null?"null":JSONObject.quote(error))+")",null);
        });
    }

    private static URL allowed(String value) throws Exception {
        URL u=new URL(value);
        if(!u.getProtocol().equals("https") || u.getPort()!=-1 || u.getUserInfo()!=null || u.getQuery()!=null || u.getRef()!=null) throw new IOException("Fonte não permitida.");
        boolean mentor=u.getHost().equals("www.pgnmentor.com") && u.getPath().matches("/(files\\.html|(?:players|openings|events)/[\\w.-]+\\.(?:pgn|zip))");
        boolean twic=u.getHost().equals("theweekinchess.com") && u.getPath().matches("/(twic|(?:zips|assets/files/pgn)/twic\\d+g\\.zip)");
        if(!mentor && !twic) throw new IOException("Fonte não permitida.");
        return u;
    }

    private static byte[] limited(InputStream stream,int limit) throws IOException {
        ByteArrayOutputStream out=new ByteArrayOutputStream(); byte[] buffer=new byte[16384]; int n,total=0;
        while((n=stream.read(buffer))!=-1) { total+=n; if(total>limit) throw new IOException("Arquivo muito grande (limite de 24 MB)."); out.write(buffer,0,n); }
        return out.toByteArray();
    }

    private String remoteText(String address) throws Exception {
        byte[] bytes=null;
        for(int i=0;i<4;i++) {
            URL url=allowed(address);
            HttpURLConnection connection=(HttpURLConnection)url.openConnection();
            connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(25000); connection.setReadTimeout(25000);
            connection.setRequestProperty("User-Agent","PrimeiroLance/1.0 (personal chess study)");
            try {
                int status=connection.getResponseCode();
                if(status==301 || status==302 || status==303 || status==307 || status==308) { address=new URL(url,connection.getHeaderField("Location")).toString(); allowed(address); continue; }
                if(status!=200) throw new IOException("A fonte não respondeu. Tente novamente mais tarde.");
                if(connection.getContentLengthLong()>MAX) throw new IOException("Coleção muito grande (limite de 24 MB).");
                try(InputStream stream=connection.getInputStream()) { bytes=limited(stream,MAX); }
                break;
            } finally { connection.disconnect(); }
        }
        if(bytes==null) throw new IOException("Redirecionamento não permitido.");
        if(address.endsWith(".zip")) {
            byte[] pgn=null; int expanded=0,entries=0;
            try(ZipInputStream zip=new ZipInputStream(new ByteArrayInputStream(bytes))) {
                ZipEntry entry;
                while((entry=zip.getNextEntry())!=null) {
                    if(++entries>100) throw new IOException("ZIP com entradas demais.");
                    if(entry.isDirectory()) continue;
                    byte[] value=limited(zip,MAX-expanded); expanded+=value.length;
                    if(entry.getName().toLowerCase(Locale.ROOT).endsWith(".pgn")) {
                        if(pgn!=null) throw new IOException("O ZIP contém vários PGNs. Importe-os separadamente.");
                        pgn=value;
                    }
                }
            }
            if(pgn==null) throw new IOException("O ZIP não contém PGN.");
            bytes=pgn;
        }
        try { return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).decode(java.nio.ByteBuffer.wrap(bytes)).toString(); }
        catch(CharacterCodingException e) { return new String(bytes,Charset.forName("windows-1252")); }
    }

    @Override protected void onActivityResult(int request,int result,Intent intent) {
        super.onActivityResult(request,result,intent);
        if(request==PICK && fileCallback!=null) {
            fileCallback.onReceiveValue(result==RESULT_OK && intent!=null && intent.getData()!=null ? new Uri[]{intent.getData()} : null); fileCallback=null;
        }
        if(request==SAVE && saveId!=null) {
            String id=saveId; byte[] bytes=saveBytes; saveId=null; saveBytes=null;
            if(result!=RESULT_OK || intent==null || intent.getData()==null) { complete(id,null,"Salvamento cancelado."); return; }
            Uri destination=intent.getData();
            tasks.execute(()->{
                try(OutputStream out=getContentResolver().openOutputStream(destination,"wt")) {
                    if(out==null) throw new IOException("Não foi possível salvar o arquivo.");
                    out.write(bytes); complete(id,new JSONObject().put("ok",true),null);
                } catch(Exception e) { complete(id,null,"Não foi possível salvar o arquivo."); }
            });
        }
    }

    private void updateDisplayOrientation() {
        if (web==null || destroyed) return;
        boolean landscape=getResources().getConfiguration().orientation==android.content.res.Configuration.ORIENTATION_LANDSCAPE;
        WindowInsetsController controller=getWindow().getInsetsController();
        if(controller!=null){
            controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            if(landscape)controller.hide(WindowInsets.Type.systemBars());
            else controller.show(WindowInsets.Type.systemBars());
        }
        ((View)web.getParent()).requestApplyInsets();
        web.evaluateJavascript("window.setAndroidLandscape && window.setAndroidLandscape("+landscape+")",null);
    }
    @Override public void onConfigurationChanged(android.content.res.Configuration configuration) {
        super.onConfigurationChanged(configuration);
        if(web!=null)web.post(this::updateDisplayOrientation);
    }
    @Override protected void onPause() { web.evaluateJavascript("window.saveAndroidSession && window.saveAndroidSession()",null); super.onPause(); }
    @Override public void onBackPressed() {
        handleBack();
    }
    private void handleBack() {
        web.evaluateJavascript("Boolean(window.closePreferences && window.closePreferences())",value -> {
            if (!destroyed && !"true".equals(value)) confirmExit();
        });
    }
    private void confirmExit() {
        web.evaluateJavascript("window.saveAndroidSession && window.saveAndroidSession()",null);
        new AlertDialog.Builder(this).setMessage("Sair do Primeiro Lance? A última posição concluída fica salva neste celular.").setPositiveButton("Sair",(d,w)->finish()).setNegativeButton("Continuar",null).show();
    }
    @Override protected void onDestroy() {
        destroyed=true;
        if(fileCallback!=null) fileCallback.onReceiveValue(null);
        tasks.shutdownNow();
        // Do not wait for a native search on the UI thread.
        new Thread(()->engine.close(),"Stockfish-close").start();
        web.removeJavascriptInterface("PrimeiroLanceAndroid"); web.destroy(); super.onDestroy();
    }
}
