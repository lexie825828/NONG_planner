import com.nongplanner.app.LocalAssets;
import java.util.zip.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.regex.*;

public class LocalAssetsTest {
  static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
  public static void main(String[] args)throws Exception {
    check(LocalAssets.route("data",null,-1)==LocalAssets.Route.BROWSER,"Android 16 in-memory document must not become HTTP 404");
    check(LocalAssets.route("blob","appassets.androidplatform.net",-1)==LocalAssets.Route.BROWSER,"blob image must stay browser-managed");
    check(LocalAssets.route("about",null,-1)==LocalAssets.Route.BROWSER,"internal blank document must stay browser-managed");
    check(LocalAssets.route("https","appassets.androidplatform.net",-1)==LocalAssets.Route.ASSET,"local HTTPS asset");
    check(LocalAssets.route("https","appassets.androidplatform.net",443)==LocalAssets.Route.ASSET,"explicit HTTPS port");
    check(LocalAssets.route("https","appassets.androidplatform.net.attacker.example",-1)==LocalAssets.Route.BLOCKED,"lookalike host");
    check(LocalAssets.route("http","appassets.androidplatform.net",-1)==LocalAssets.Route.BLOCKED,"insecure asset origin");
    check(LocalAssets.route("file",null,-1)==LocalAssets.Route.BLOCKED,"local device file access");
    check(LocalAssets.route("https","appassets.androidplatform.net",8443)==LocalAssets.Route.BLOCKED,"different origin port");
    check(LocalAssets.resolve(null).equals("www/index.html"),"null root");
    check(LocalAssets.resolve("").equals("www/index.html"),"empty root");
    check(LocalAssets.resolve("/").equals("www/index.html"),"slash root");
    check(LocalAssets.resolve("/index.html").equals("www/index.html"),"explicit entry");
    check(LocalAssets.resolve("/app.js").equals("www/app.js"),"module path");
    for(String path:new String[]{"/../config.json","/nested/file.js","//index.html","/a\\b.js","/foo?x=1"})check(LocalAssets.resolve(path)==null,"unsafe path "+path);
    check(LocalAssets.mime("app.js").equals("text/javascript"),"module MIME");
    try(ZipFile apk=new ZipFile(args[0])) {
      java.util.Enumeration<? extends ZipEntry> entries=apk.entries();
      while(entries.hasMoreElements())check(entries.nextElement().getName().indexOf('\\')<0,"APK entry contains a Windows backslash");
      String html=read(apk,"assets/"+LocalAssets.resolve("/"));
      check(html.contains("id=\"app\""),"entry markup");
      Matcher references=Pattern.compile("(?:src|href)=\"(/[^\"]+)\"").matcher(html);
      int checked=0;
      while(references.find()){String asset=LocalAssets.resolve(references.group(1));check(asset!=null,"invalid HTML reference");check(apk.getEntry("assets/"+asset)!=null,"missing resource "+asset);checked++;}
      for(String module:new String[]{"app.js","android-runtime.js","chat-core.js","chat-ui.js","storage.js","coach-context.js","calendar.js","native-boot.js"})check(apk.getEntry("assets/www/"+module)!=null,"missing module "+module);
      check(checked>=6,"entry resources not enumerated");
      System.out.println("Native Java asset resolver + packaged APK entry and resources: PASS ("+checked+" entry references)");
    }
  }
  static String read(ZipFile zip,String path)throws Exception{ZipEntry e=zip.getEntry(path);check(e!=null,"missing "+path);try(InputStream in=zip.getInputStream(e)){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buf=new byte[4096];int n;while((n=in.read(buf))!=-1)out.write(buf,0,n);return new String(out.toByteArray(),StandardCharsets.UTF_8);}}
}
