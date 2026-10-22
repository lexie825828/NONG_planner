package com.nongplanner.app;

/** One mapping for all WebView callback variants, including an empty root path. */
public final class LocalAssets {
  private LocalAssets() {}
  public enum Route { BROWSER, ASSET, BLOCKED }
  public static Route route(String scheme,String host,int port) {
    // Let Chromium load its own in-memory documents, images and internal pages.
    // Returning a synthetic 404 here also blocks loadDataWithBaseURL's bootstrap.
    if("data".equalsIgnoreCase(scheme)||"blob".equalsIgnoreCase(scheme)||"about".equalsIgnoreCase(scheme))return Route.BROWSER;
    if("https".equalsIgnoreCase(scheme)&&"appassets.androidplatform.net".equalsIgnoreCase(host)&&(port==-1||port==443))return Route.ASSET;
    return Route.BLOCKED;
  }
  public static String resolve(String path) {
    if(path==null||path.isEmpty()||path.equals("/"))return "www/index.html";
    if(!path.matches("/[a-zA-Z0-9._-]+")||path.contains(".."))return null;
    return "www"+path;
  }
  public static String mime(String path) {
    if(path.endsWith(".js"))return "text/javascript";
    if(path.endsWith(".css"))return "text/css";
    if(path.endsWith(".png"))return "image/png";
    if(path.endsWith(".svg"))return "image/svg+xml";
    if(path.endsWith(".webmanifest"))return "application/manifest+json";
    return "text/html";
  }
}
