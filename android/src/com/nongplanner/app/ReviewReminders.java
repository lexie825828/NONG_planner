package com.nongplanner.app;
import android.app.*;
import android.content.*;
import android.os.Build;
import android.content.pm.PackageManager;
import org.json.*;
import java.text.SimpleDateFormat;
import java.time.Instant;
import java.util.*;

final class ReviewReminders {
 static final int DAILY=6051,WEEKLY=6052,ALARM=6050;
 static final TimeZone ZONE=TimeZone.getTimeZone("Asia/Shanghai");
 static JSONObject snapshot(Context c){try{return new JSONObject(DevicePlanner.prefs(c).getString("devicePlanner","{}"));}catch(Exception e){return new JSONObject();}}
 static JSONObject options(Context c){JSONObject p=snapshot(c).optJSONObject("preferences");return p==null?new JSONObject():p;}
 static String stamp(long millis,String pattern){SimpleDateFormat f=new SimpleDateFormat(pattern,Locale.US);f.setTimeZone(ZONE);return f.format(new Date(millis));}
 static boolean quiet(JSONObject p,String time){String from=p.optString("quietFrom","22:00"),to=p.optString("quietTo","08:00");if(from.equals(to))return false;return from.compareTo(to)<0?time.compareTo(from)>=0&&time.compareTo(to)<0:time.compareTo(from)>=0||time.compareTo(to)<0;}
 static String validTime(String value,String fallback){return value.matches("([01]\\d|2[0-3]):[0-5]\\d")?value:fallback;}
 static long snoozedUntil(Context c,JSONObject p){long until=DevicePlanner.prefs(c).getLong("reviewSnoozeUntil",0);try{until=Math.max(until,Instant.parse(p.optString("snoozedUntil")).toEpochMilli());}catch(Exception ignored){}return until;}
 static Calendar at(Calendar day,String value){Calendar c=(Calendar)day.clone();String[] bits=value.split(":");c.set(Calendar.HOUR_OF_DAY,Integer.parseInt(bits[0]));c.set(Calendar.MINUTE,Integer.parseInt(bits[1]));c.set(Calendar.SECOND,0);c.set(Calendar.MILLISECOND,0);return c;}
 static long deferQuiet(JSONObject p,long time){if(!quiet(p,stamp(time,"HH:mm")))return time;Calendar c=Calendar.getInstance(ZONE);c.setTimeInMillis(time);String end=validTime(p.optString("quietTo"),"08:00");Calendar target=at(c,end);if(target.getTimeInMillis()<=time)target.add(Calendar.DATE,1);return target.getTimeInMillis();}
 static void schedule(Context c){
  JSONObject p=options(c);AlarmManager alarms=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);PendingIntent alarm=PendingIntent.getBroadcast(c,ALARM,new Intent(c,ReviewReceiver.class).setAction("com.nongplanner.REVIEW_ALARM"),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  if(!p.optBoolean("reviewEnabled",true)){alarms.cancel(alarm);NotificationManager n=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);n.cancel(DAILY);n.cancel(WEEKLY);return;}
  long now=System.currentTimeMillis(),next=Long.MAX_VALUE;Calendar day=Calendar.getInstance(ZONE);
  for(int offset=0;offset<9;offset++){Calendar date=(Calendar)day.clone();date.add(Calendar.DATE,offset);long daily=deferQuiet(p,at(date,validTime(p.optString("dailyTime"),"09:00")).getTimeInMillis());if(daily>now)next=Math.min(next,daily);if(date.get(Calendar.DAY_OF_WEEK)==Calendar.SUNDAY){long weekly=deferQuiet(p,at(date,validTime(p.optString("weeklyTime"),"20:30")).getTimeInMillis());if(weekly>now)next=Math.min(next,weekly);}}
  long snooze=snoozedUntil(c,p);if(snooze>now)next=Math.max(next,snooze);next=deferQuiet(p,next);
  alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next,alarm);
 }
 static synchronized void run(Context c)throws Exception{
  JSONObject p=options(c);NotificationManager manager=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);manager.createNotificationChannel(new NotificationChannel("nong-review","梳理与复盘",NotificationManager.IMPORTANCE_DEFAULT));
  if(!p.optBoolean("reviewEnabled",true)){manager.cancel(DAILY);manager.cancel(WEEKLY);return;}
  if(Build.VERSION.SDK_INT>=33&&c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
  long now=System.currentTimeMillis();String today=stamp(now,"yyyy-MM-dd"),time=stamp(now,"HH:mm");if(snoozedUntil(c,p)>now||quiet(p,time))return;
  LinkedHashSet<String> titles=new LinkedHashSet<>();JSONArray items=snapshot(c).optJSONArray("reviewItems");if(items!=null)for(int i=0;i<items.length();i++){JSONObject item=items.optJSONObject(i);if(item!=null&&item.optString("eligibleOn","9999").compareTo(today)<=0)titles.add(item.optString("title"));}
  android.content.SharedPreferences prefs=DevicePlanner.prefs(c);
  if(time.compareTo(validTime(p.optString("dailyTime"),"09:00"))>=0&&!today.equals(prefs.getString("reviewLastDaily",""))){notify(c,DAILY,"给今天一点清晰的方向",titles);prefs.edit().putString("reviewLastDaily",today).commit();}
  Calendar day=Calendar.getInstance(ZONE);if(day.get(Calendar.DAY_OF_WEEK)==Calendar.SUNDAY&&time.compareTo(validTime(p.optString("weeklyTime"),"20:30"))>=0&&!today.equals(prefs.getString("reviewLastWeekly",""))){notify(c,WEEKLY,"这一周，值得回头看看",titles);prefs.edit().putString("reviewLastWeekly",today).commit();}
 }
 static void notify(Context c,int id,String title,Set<String> items){
  String text=items.isEmpty()?"花一分钟看看进度、精力与接下来的一小步。":items.size()+" 件事情值得回看："+android.text.TextUtils.join("、",items);
  Intent intent=new Intent(c,MainActivity.class).setAction("com.nongplanner.OPEN_REVIEW").putExtra("nong_action","review").addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
  PendingIntent open=PendingIntent.getActivity(c,id,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  PendingIntent later=PendingIntent.getBroadcast(c,id,new Intent(c,ReviewReceiver.class).setAction("com.nongplanner.REVIEW_SNOOZE"),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  ((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(id,new Notification.Builder(c,"nong-review").setGroup("nong-review-reminders").setSmallIcon(android.R.drawable.ic_popup_reminder).setContentTitle(title).setContentText(text).setStyle(new Notification.BigTextStyle().bigText(text+"。点击查看，不会自动调用模型。" )).setContentIntent(open).addAction(new Notification.Action.Builder(android.R.drawable.ic_menu_recent_history,"稍后一天",later).build()).setAutoCancel(true).build());
 }
 static void snooze(Context c,int hours){android.content.SharedPreferences.Editor edit=DevicePlanner.prefs(c).edit().putLong("reviewSnoozeUntil",hours>0?System.currentTimeMillis()+hours*3600000L:0);if(hours==0)edit.remove("reviewLastDaily").remove("reviewLastWeekly");edit.commit();NotificationManager manager=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);manager.cancel(DAILY);manager.cancel(WEEKLY);schedule(c);}
}
