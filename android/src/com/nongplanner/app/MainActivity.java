package com.nongplanner.app;

import android.app.*;
import android.os.*;
import android.content.*;
import android.net.Uri;
import android.graphics.Color;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import android.security.keystore.*;
import android.util.Base64;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import java.util.*;
import java.util.concurrent.*;

/** Offline Android host. Only bundled code can access the narrow native API. */
public class MainActivity extends Activity {
  static final String ORIGIN="https://appassets.androidplatform.net/";
  static final String[] COLLECTIONS={"tasks","projects","habits","checkins","reviews","goals","notes","messages","sessions","diaries","memories","weekTodos"};
  final ExecutorService deviceWorker=Executors.newSingleThreadExecutor();
  final ExecutorService workers=Executors.newFixedThreadPool(4);
  final Object stateLock=new Object();
  WebView web; android.content.SharedPreferences prefs;
  ValueCallback<Uri[]> picker; String exportText; volatile boolean trusted=false;
  final Handler mainHandler=new Handler(Looper.getMainLooper());
  volatile boolean pageReady=false; boolean diagnosticsShown=false; String loadDiagnostics="";
  final Runnable bootWatchdog=()->{if(!pageReady&&!isFinishing())showLoadFailure("页面启动未完成");};

  @Override public void onCreate(Bundle saved){
    super.onCreate(saved); prefs=getSharedPreferences("nong-private",MODE_PRIVATE);
    if(!prefs.contains("token"))prefs.edit().putString("token",UUID.randomUUID().toString()).apply();
    LinearLayout frame=new LinearLayout(this);frame.setOrientation(LinearLayout.VERTICAL);frame.setBackgroundColor(Color.rgb(248,246,241));
    if((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE)!=0)WebView.setWebContentsDebuggingEnabled(true);
    web=new WebView(this);frame.addView(web,new LinearLayout.LayoutParams(-1,-1));setContentView(frame);
    frame.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});
    WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setSupportMultipleWindows(false);
    web.addJavascriptInterface(new Bridge(),"NongAndroid");
    web.setWebViewClient(new WebViewClient(){
      @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){trusted=url.startsWith(ORIGIN);}
      @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){return localResource(request.getUrl());}
      @Override public WebResourceResponse shouldInterceptRequest(WebView view,String url){return localResource(Uri.parse(url));}
      @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){
        recordLoadError(request.getUrl()+": "+error.getDescription());
        if(request.isForMainFrame())runOnUiThread(()->showLoadFailure("本地页面载入失败"));
      }
      @Override public void onReceivedHttpError(WebView view,WebResourceRequest request,WebResourceResponse response){
        recordLoadError(request.getUrl()+": HTTP "+response.getStatusCode());
        if(request.isForMainFrame())runOnUiThread(()->showLoadFailure("本地首页响应异常"));
      }
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
        Uri uri=request.getUrl();if(uri.toString().startsWith(ORIGIN))return false;
        if(request.hasGesture()&&("https".equals(uri.getScheme())||"http".equals(uri.getScheme()))){try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception e){toast("未找到可打开链接的应用");}}
        return true;
      }
      @Override public void onReceivedSslError(WebView view,android.webkit.SslErrorHandler handler,android.net.http.SslError error){handler.cancel();}
    });
    web.setWebChromeClient(new WebChromeClient(){
      @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
        if(picker!=null)picker.onReceiveValue(null);picker=callback;
        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("*/*");
        String[] types=params.getAcceptTypes();if(types!=null&&types.length>0&&!types[0].isEmpty()){String[] accepted=android.text.TextUtils.join(",",types).split(",");intent.putExtra(Intent.EXTRA_MIME_TYPES,accepted);if(accepted[0].startsWith("image/"))intent.setType("image/*");}
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);
        try{startActivityForResult(intent,10);return true;}catch(Exception e){picker=null;toast("无法打开系统文件选择器");return false;}
      }
    });
    loadLocalHome();
    DevicePlanner.schedule(this);
  }
  void loadLocalHome(){
    pageReady=false;diagnosticsShown=false;loadDiagnostics="";mainHandler.removeCallbacks(bootWatchdog);
    try(InputStream in=getAssets().open("www/index.html")){
      if(!read(in).contains("id=\"app\""))throw new IOException("首页内容不完整");
      // The APK path bug is fixed. Load the explicit asset URL, avoiding the
      // loadDataWithBaseURL -> data: bootstrap used by recent Android WebViews.
      // Same HTTPS origin means upgrades retain localStorage and IndexedDB.
      trusted=true;
      web.loadUrl(ORIGIN+"index.html");
      mainHandler.postDelayed(bootWatchdog,20000);
    }catch(Exception e){recordLoadError("读取安装包首页失败: "+e.getMessage());showLoadFailure("无法读取应用内首页");}
  }
  WebResourceResponse localResource(Uri uri){
    LocalAssets.Route route=LocalAssets.route(uri.getScheme(),uri.getHost(),uri.getPort());
    if(route==LocalAssets.Route.BROWSER)return null;
    if(route!=LocalAssets.Route.ASSET)return blocked();
    String asset=LocalAssets.resolve(uri.getPath());if(asset==null)return blocked();
    try{
      InputStream stream=getAssets().open(asset);
      Map<String,String> headers=new HashMap<>();headers.put("Cache-Control","no-store");headers.put("X-Content-Type-Options","nosniff");
      headers.put("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'");
      return new WebResourceResponse(LocalAssets.mime(asset),asset.endsWith(".png")?null:"UTF-8",200,"OK",headers,stream);
    }catch(IOException e){recordLoadError("资源读取失败: "+asset+" ("+e.getMessage()+")");return blocked();}
  }
  synchronized void recordLoadError(String message){if(loadDiagnostics.length()<6000)loadDiagnostics+=message+"\n";}
  String diagnostics(){
    android.content.pm.PackageInfo engine=WebView.getCurrentWebViewPackage();
    return "Nong Planner 0.4.1\nAndroid "+Build.VERSION.RELEASE+" / API "+Build.VERSION.SDK_INT+"\n"+Build.MANUFACTURER+" "+Build.MODEL+"\nWebView: "+(engine==null?"unknown":engine.packageName+" "+engine.versionName)+"\n"+loadDiagnostics;
  }
  void showLoadFailure(String title){
    if(diagnosticsShown||isFinishing()||pageReady)return;diagnosticsShown=true;
    new AlertDialog.Builder(this).setTitle(title).setMessage("应用尚未完成启动。可以重新加载，或复制诊断信息用于排查；不会清空你的记录。\n\n"+diagnostics())
      .setPositiveButton("重新加载",(d,w)->loadLocalHome())
      .setNeutralButton("复制诊断",(d,w)->{((android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Nong Planner diagnostics",diagnostics()));toast("诊断信息已复制");})
      .setNegativeButton("关闭",null).show();
  }
  static WebResourceResponse blocked(){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",new HashMap<>(),new ByteArrayInputStream(new byte[0]));}
  void toast(String text){runOnUiThread(()->Toast.makeText(this,text,Toast.LENGTH_LONG).show());}
  JSONObject error(String text){JSONObject o=new JSONObject();try{o.put("error",text);}catch(Exception ignored){}return o;}
  public final class Bridge {
    @JavascriptInterface public void ready(){if(!trusted)return;pageReady=true;mainHandler.removeCallbacks(bootWatchdog);}
    @JavascriptInterface public void reportError(String message){if(trusted)recordLoadError(message);}
    @JavascriptInterface public void request(String id,String route,String method,String raw){
      if(!trusted)return;
      workers.execute(()->{int status=200;String result;
        try{if(raw.length()>24_000_000)throw new IOException("内容过大，请清理旧图片后重试");JSONObject data=raw.equals("null")?new JSONObject():new JSONObject(raw);result=dispatch(route,method,data).toString();}
        catch(Exception e){status=400;result=error(e instanceof SocketTimeoutException?"连接超时，请检查服务地址":e.getMessage()==null?"操作失败，请检查配置与网络":e.getMessage()).toString();}
        final String js="window.__nongNativeResult("+JSONObject.quote(id)+","+status+","+JSONObject.quote(result)+");";
        runOnUiThread(()->{if(web!=null&&trusted)web.evaluateJavascript(js,null);});
      });
    }
    @JavascriptInterface public String getTheme(){return trusted?prefs.getString("plannerTheme","{}"):"{}";}
    @JavascriptInterface public void saveTheme(String raw){if(!trusted||raw.length()>300)return;try{JSONObject input=new JSONObject(raw),out=new JSONObject();for(String part:new String[]{"paper","surface","accent"}){String color=input.optString(part);if(!Arrays.asList("red","blue","pink").contains(color))return;out.put(part,color);}prefs.edit().putString("plannerTheme",out.toString()).commit();}catch(Exception ignored){}}
    @JavascriptInterface public String deviceStatus(){if(!trusted)return "{}";try{return new JSONObject().put("calendar",prefs.getBoolean("calendarEnabled",false)&&DevicePlanner.calendarAllowed(MainActivity.this)).put("notifications",prefs.getBoolean("habitNotifications",false)&&(Build.VERSION.SDK_INT<33||checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)==android.content.pm.PackageManager.PERMISSION_GRANTED)).toString();}catch(Exception e){return "{}";}}
    @JavascriptInterface public void syncPlanner(String raw){if(!trusted||raw.length()>4000000)return;deviceWorker.execute(()->{try{new JSONObject(raw);prefs.edit().putString("devicePlanner",raw).commit();DevicePlanner.syncCalendar(MainActivity.this);DevicePlanner.notifyHabits(MainActivity.this);}catch(Exception e){toast("手机日历或提醒更新失败："+e.getMessage());}});}
    @JavascriptInterface public void configureCalendar(){if(trusted)runOnUiThread(()->{if(prefs.getBoolean("calendarEnabled",false)){new AlertDialog.Builder(MainActivity.this).setMessage("关闭后停止同步，并移除 Nong Planner 自动写入的日程？计划本内的记录保留。").setNegativeButton("取消",null).setPositiveButton("关闭并移除",(d,w)->{prefs.edit().putBoolean("calendarEnabled",false).apply();deviceWorker.execute(()->{try{DevicePlanner.syncCalendar(MainActivity.this);}catch(Exception e){toast(e.getMessage());}});deviceReady();toast("自动日历已关闭");}).show();}else if(checkSelfPermission(android.Manifest.permission.READ_CALENDAR)!=android.content.pm.PackageManager.PERMISSION_GRANTED||checkSelfPermission(android.Manifest.permission.WRITE_CALENDAR)!=android.content.pm.PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{android.Manifest.permission.READ_CALENDAR,android.Manifest.permission.WRITE_CALENDAR},21);}else{prefs.edit().putBoolean("calendarEnabled",true).apply();deviceReady();toast("自动日历已开启");}});}
    @JavascriptInterface public void enableReminders(){if(trusted)runOnUiThread(()->{if(prefs.getBoolean("habitNotifications",false)){prefs.edit().putBoolean("habitNotifications",false).apply();((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).cancel(6040);deviceReady();toast("循环习惯通知已关闭");return;}if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},22);else{prefs.edit().putBoolean("habitNotifications",true).apply();DevicePlanner.schedule(MainActivity.this);deviceReady();toast("循环习惯通知已开启");}});}
    @JavascriptInterface public void configureServer(){if(trusted)runOnUiThread(()->serverDialog());}
    @JavascriptInterface public void saveFile(String name,String text,String type){if(!trusted)return;runOnUiThread(()->{
      if(exportText!=null){toast("请先完成当前文件保存");return;}if(text.length()>20_000_000){toast("导出内容过大");return;}
      String safeName=name.replaceAll("[^a-zA-Z0-9._-]","_");safeName=safeName.substring(0,Math.min(safeName.length(),120));exportText=text;Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType(type);i.putExtra(Intent.EXTRA_TITLE,safeName);
      try{startActivityForResult(i,11);}catch(Exception e){exportText=null;toast("无法打开系统文件保存窗口");}
    });}
  }
  JSONObject dispatch(String route,String method,JSONObject data)throws Exception{
    if(!Arrays.asList("/api/bootstrap","/api/state","/api/settings","/api/coach").contains(route))throw new IOException("不支持的操作");
    if(route.equals("/api/bootstrap"))return new JSONObject().put("token",prefs.getString("token",""));
    String remote=prefs.getString("remote","");
    if(!remote.isEmpty()){
      JSONObject outgoing=new JSONObject(data.toString());outgoing.remove("modelMessages");
      JSONObject result=http(remote+route,method,method.equals("GET")?null:outgoing,secret("remoteToken"));
      if(route.equals("/api/settings")&&method.equals("GET"))result.put("calendarUrl",remote+result.optString("calendarPath","/calendar.ics"));return result;
    }
    if(route.equals("/api/state"))synchronized(stateLock){
      JSONObject db=readState();if(method.equals("GET"))return db;
      if(!method.equals("PUT"))throw new IOException("请求方法错误");
      if(data.optInt("revision",-1)!=db.getInt("revision"))return new JSONObject().put("nativeStatus",409).put("error","本地数据已有更新，请处理同步冲突");
      JSONObject state=data.getJSONObject("state");for(String key:COLLECTIONS)if(!state.has(key)||state.getJSONArray(key).length()>10000)throw new IOException("数据格式错误");
      JSONObject next=new JSONObject().put("revision",db.getInt("revision")+1).put("state",state);writeState(next);return new JSONObject().put("revision",next.getInt("revision"));
    }
    if(route.equals("/api/settings")){
      if(method.equals("GET"))return new JSONObject().put("ai",new JSONObject().put("url",prefs.getString("aiUrl","")).put("model",prefs.getString("aiModel","")).put("hasKey",!secret("aiKey").isEmpty())).put("calendarPath","/calendar.ics").put("androidStandalone",true);
      String url=data.optString("url","").trim();if(!url.isEmpty())validateUrl(url);
      String key=data.optBoolean("clearKey",false)?"":data.optString("key","");if(key.isEmpty()&&!data.optBoolean("clearKey",false))key=secret("aiKey");
      putSecret("aiKey",key);prefs.edit().putString("aiUrl",url).putString("aiModel",data.optString("model","").trim()).apply();return new JSONObject().put("ok",true);
    }
    if(route.equals("/api/coach")){
      String url=prefs.getString("aiUrl",""),model=prefs.getString("aiModel","");if(url.isEmpty()||model.isEmpty())throw new IOException("请先在设置中填写模型 API 地址、模型名称与密钥");
      validateUrl(url);JSONObject result=http(url.replaceAll("/+$","")+"/chat/completions","POST",new JSONObject().put("model",model).put("messages",data.getJSONArray("modelMessages")),secret("aiKey"),data.optString("sessionId","nong-default"));
      if(result.has("nativeStatus"))return result;
      String reply=result.getJSONArray("choices").getJSONObject(0).getJSONObject("message").getString("content");return new JSONObject().put("rawContent",reply);
    }
    throw new IOException("操作不存在");
  }
  JSONObject readState()throws Exception{
    File file=new File(getFilesDir(),"planner.json");if(file.exists())try(InputStream in=new FileInputStream(file)){return new JSONObject(read(in));}
    JSONObject state=new JSONObject();for(String k:COLLECTIONS)state.put(k,new JSONArray());return new JSONObject().put("revision",0).put("state",state);
  }
  void writeState(JSONObject value)throws Exception{File file=new File(getFilesDir(),"planner.json"),tmp=new File(getFilesDir(),"planner.tmp");try(FileOutputStream out=new FileOutputStream(tmp)){out.write(value.toString().getBytes(StandardCharsets.UTF_8));out.getFD().sync();}if(!tmp.renameTo(file))throw new IOException("本机文件保存失败");}
  static String read(InputStream in)throws IOException{ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1){out.write(buffer,0,n);if(out.size()>24_000_000)throw new IOException("响应内容过大");}return out.toString("UTF-8");}
  JSONObject http(String endpoint,String method,JSONObject data,String key)throws Exception{return http(endpoint,method,data,key,"");}
  JSONObject http(String endpoint,String method,JSONObject data,String key,String session)throws Exception{
    validateUrl(endpoint);HttpURLConnection connection=(HttpURLConnection)new URL(endpoint).openConnection();
    try{connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(15000);connection.setReadTimeout(90000);connection.setRequestMethod(method);connection.setRequestProperty("Accept","application/json");connection.setRequestProperty("User-Agent","NongPlanner/0.4.1");if(!session.isEmpty())connection.setRequestProperty("x-opencode-session",session.replaceAll("[^a-zA-Z0-9_.:-]","_"));if(!key.isEmpty())connection.setRequestProperty("Authorization","Bearer "+key);
      if(data!=null){connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json; charset=utf-8");try(OutputStream out=connection.getOutputStream()){out.write(data.toString().getBytes(StandardCharsets.UTF_8));}}
      int code=connection.getResponseCode();if(code<200||code>=300){String detail="服务返回 "+code+"，请检查地址、密钥、模型与服务是否开启";if(connection.getErrorStream()!=null)try(InputStream in=connection.getErrorStream()){JSONObject err=new JSONObject(read(in));detail=err.optString("message",err.optString("error",detail));}catch(Exception ignored){}return new JSONObject().put("nativeStatus",code>=400?code:502).put("error",detail);}
      try(InputStream in=connection.getInputStream()){return new JSONObject(read(in));}
    }finally{connection.disconnect();}
  }
  static void validateUrl(String endpoint)throws Exception{
    URL u=new URL(endpoint);String host=u.getHost();boolean local=host.equals("localhost")||host.equals("127.0.0.1")||host.equals("10.0.2.2")||host.matches("10\\.\\d+\\.\\d+\\.\\d+")||host.matches("192\\.168\\.\\d+\\.\\d+")||host.matches("172\\.(1[6-9]|2\\d|3[01])\\.\\d+\\.\\d+");
    if(!u.getProtocol().equals("https")&&!(u.getProtocol().equals("http")&&local))throw new IOException("公网地址须使用 HTTPS；HTTP 仅允许本机或私有局域网 IP");
    if(u.getUserInfo()!=null||u.getRef()!=null||u.getQuery()!=null)throw new IOException("服务地址不能包含账号、查询参数或片段");
  }
  javax.crypto.SecretKey key()throws Exception{KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);if(store.containsAlias("nong-key"))return (javax.crypto.SecretKey)store.getKey("nong-key",null);KeyGenerator g=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");g.init(new KeyGenParameterSpec.Builder("nong-key",KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());return g.generateKey();}
  String secret(String name)throws Exception{String raw=prefs.getString(name,"");if(raw.isEmpty())return "";String[] parts=raw.split(":",2);Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));return new String(c.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),StandardCharsets.UTF_8);}
  void putSecret(String name,String value)throws Exception{Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key());String result=Base64.encodeToString(c.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(c.doFinal(value.getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP);prefs.edit().putString(name,result).apply();}
  void serverDialog(){
    LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);int pad=(int)(22*getResources().getDisplayMetrics().density);layout.setPadding(pad,10,pad,0);
    TextView info=new TextView(this);info.setText("默认独立使用，无需电脑。同步时请填写电脑局域网 IP（例如 http://192.168.1.5:4173）或 HTTPS 地址，不能填电脑的 localhost。切换后会询问保留哪份数据。留空地址可切回手机本地空间。");layout.addView(info);
    EditText url=new EditText(this);url.setSingleLine(true);url.setHint("电脑或服务器地址（留空为本地）");url.setInputType(17);url.setText(prefs.getString("remote",""));layout.addView(url);
    EditText token=new EditText(this);token.setSingleLine(true);token.setHint("电脑设置中的配对密钥");token.setInputType(129);layout.addView(token);
    AlertDialog dialog=new AlertDialog.Builder(this).setTitle("连接电脑同步 / 手机本地").setView(layout).setNegativeButton("取消",null).setPositiveButton("保存连接",null).create();
    dialog.setOnShowListener(d->dialog.getButton(-1).setOnClickListener(v->{try{String target=url.getText().toString().trim().replaceAll("/+$","");if(!target.isEmpty())validateUrl(target);String secret=token.getText().toString().trim();if(!target.isEmpty()&&secret.isEmpty()){if(!target.equals(prefs.getString("remote","")))throw new IOException("请填写配对密钥");secret=secret("remoteToken");}putSecret("remoteToken",secret);prefs.edit().putString("remote",target).apply();web.evaluateJavascript("window.dispatchEvent(new Event('nong-server-changed'))",null);dialog.dismiss();}catch(Exception e){toast(e.getMessage());}}));dialog.show();
  }
  void deviceReady(){if(web!=null&&trusted)web.evaluateJavascript("window.dispatchEvent(new Event('nong-device-ready'))",null);}
  @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] grants){super.onRequestPermissionsResult(request,permissions,grants);boolean ok=grants.length>0;for(int grant:grants)if(grant!=android.content.pm.PackageManager.PERMISSION_GRANTED)ok=false;if(request==21){prefs.edit().putBoolean("calendarEnabled",ok).apply();toast(ok?"自动日历已开启":"未获日历权限，可在设置中重新开启");}if(request==22){prefs.edit().putBoolean("habitNotifications",ok).apply();toast(ok?"循环习惯通知已开启":"通知权限未开启，仍会在计划本内提醒");DevicePlanner.schedule(this);}if(ok)deviceReady();}
  @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);
    if(request==10&&picker!=null){Uri[] uris=null;if(result==RESULT_OK&&data!=null){if(data.getClipData()!=null){uris=new Uri[data.getClipData().getItemCount()];for(int i=0;i<uris.length;i++)uris[i]=data.getClipData().getItemAt(i).getUri();}else if(data.getData()!=null)uris=new Uri[]{data.getData()};}picker.onReceiveValue(uris);picker=null;}
    if(request==11){final String content=exportText;exportText=null;if(result==RESULT_OK&&data!=null&&data.getData()!=null&&content!=null){Uri uri=data.getData();workers.execute(()->{try(OutputStream out=getContentResolver().openOutputStream(uri)){if(out==null)throw new IOException();out.write(content.getBytes(StandardCharsets.UTF_8));toast("文件已保存");}catch(Exception e){toast("文件保存失败，请重新导出");}});}}
  }
  @Override public void onBackPressed(){web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){d.close();return 'closed';}return 'exit';})()",value->{if(!value.contains("closed"))new AlertDialog.Builder(this).setMessage("退出 Nong Planner？未发送的聊天草稿不会保留，计划和聊天记录会自动保存。").setNegativeButton("继续使用",null).setPositiveButton("退出",(d,w)->finish()).show();});}
  @Override protected void onPause(){super.onPause();if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('focus'))",null);}
  @Override protected void onResume(){super.onResume();if(web!=null&&trusted)web.evaluateJavascript("window.dispatchEvent(new Event('focus'))",null);}
  @Override protected void onDestroy(){mainHandler.removeCallbacks(bootWatchdog);trusted=false;if(picker!=null)picker.onReceiveValue(null);if(web!=null){web.removeJavascriptInterface("NongAndroid");web.destroy();web=null;}workers.shutdown();deviceWorker.shutdown();super.onDestroy();}
}
