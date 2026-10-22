package com.nongplanner.app;
import android.app.*;
import android.app.job.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.CalendarContract;
import org.json.*;
import java.text.SimpleDateFormat;
import java.util.*;

final class DevicePlanner {
 static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences("nong-private",Context.MODE_PRIVATE);}
 static Uri syncUri(Uri uri){return uri.buildUpon().appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER,"true").appendQueryParameter("account_name","Nong Planner").appendQueryParameter("account_type",CalendarContract.ACCOUNT_TYPE_LOCAL).build();}
 static boolean calendarAllowed(Context c){return c.checkSelfPermission(android.Manifest.permission.READ_CALENDAR)==PackageManager.PERMISSION_GRANTED&&c.checkSelfPermission(android.Manifest.permission.WRITE_CALENDAR)==PackageManager.PERMISSION_GRANTED;}
 static synchronized void syncCalendar(Context c)throws Exception{
  if(!calendarAllowed(c))return;
  android.content.SharedPreferences p=prefs(c);ContentResolver r=c.getContentResolver();
  long cal=-1;
  try(Cursor rows=r.query(CalendarContract.Calendars.CONTENT_URI,new String[]{"_id"},"account_name=? AND account_type=? AND name=?",new String[]{"Nong Planner",CalendarContract.ACCOUNT_TYPE_LOCAL,"nong-planner-owned"},null)){if(rows!=null&&rows.moveToFirst())cal=rows.getLong(0);}
  if(!p.getBoolean("calendarEnabled",false)){if(cal!=-1)r.delete(syncUri(ContentUris.withAppendedId(CalendarContract.Calendars.CONTENT_URI,cal)),null,null);return;}
  if(cal==-1){ContentValues v=new ContentValues();v.put("account_name","Nong Planner");v.put("account_type",CalendarContract.ACCOUNT_TYPE_LOCAL);v.put("name","nong-planner-owned");v.put("calendar_displayName","Nong Planner");v.put("calendar_color",0xff476e9e);v.put("calendar_access_level",700);v.put("ownerAccount","Nong Planner");v.put("calendar_timezone","Asia/Shanghai");v.put("visible",1);v.put("sync_events",1);Uri created=r.insert(syncUri(CalendarContract.Calendars.CONTENT_URI),v);if(created==null)throw new Exception("系统未创建日历");cal=ContentUris.parseId(created);}
  Map<String,Long> existing=new HashMap<>();
  try(Cursor rows=r.query(CalendarContract.Events.CONTENT_URI,new String[]{"_id","_sync_id"},"calendar_id=?",new String[]{Long.toString(cal)},null)){while(rows!=null&&rows.moveToNext())existing.put(rows.getString(1),rows.getLong(0));}
  JSONArray tasks=new JSONObject(p.getString("devicePlanner","{}")).optJSONArray("tasks");if(tasks==null)return;
  SimpleDateFormat format=new SimpleDateFormat("yyyy-MM-dd HH:mm",Locale.US);format.setTimeZone(TimeZone.getTimeZone("Asia/Shanghai"));format.setLenient(false);
  for(int i=0;i<tasks.length();i++){
   JSONObject t=tasks.getJSONObject(i);String id=t.optString("id"),date=t.optString("date"),time=t.optString("time");
   if(id.isEmpty()||!date.matches("\\d{4}-\\d{2}-\\d{2}")||!time.matches("([01]\\d|2[0-3]):[0-5]\\d")||t.optBoolean("deleted"))continue;
   long start;try{start=format.parse(date+" "+time).getTime();}catch(Exception e){continue;}
   ContentValues v=new ContentValues();v.put("calendar_id",cal);v.put("_sync_id",id);v.put("title",(t.optBoolean("done")?"✓ ":"")+t.optString("title"));v.put("description",t.optString("note"));v.put("dtstart",start);v.put("dtend",start+Math.max(5,Math.min(1440,t.optInt("duration",60)))*60000L);v.put("eventTimezone","Asia/Shanghai");v.put("hasAlarm",t.optBoolean("done")?0:1);
   Long event=existing.remove(id);
   if(event==null){Uri created=r.insert(syncUri(CalendarContract.Events.CONTENT_URI),v);if(created==null)throw new Exception("系统未创建日程");event=ContentUris.parseId(created);}else r.update(syncUri(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI,event)),v,null,null);
   r.delete(CalendarContract.Reminders.CONTENT_URI,"event_id=?",new String[]{event.toString()});
   if(!t.optBoolean("done")){ContentValues alarm=new ContentValues();alarm.put("event_id",event);alarm.put("minutes",15);alarm.put("method",CalendarContract.Reminders.METHOD_ALERT);r.insert(CalendarContract.Reminders.CONTENT_URI,alarm);}
  }
  for(Long event:existing.values())r.delete(syncUri(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI,event)),null,null);
 }
 static void schedule(Context c){JobScheduler jobs=(JobScheduler)c.getSystemService(Context.JOB_SCHEDULER_SERVICE);jobs.schedule(new JobInfo.Builder(6040,new ComponentName(c,ReminderJob.class)).setPeriodic(6*60*60*1000L).setPersisted(true).build());}
 static synchronized void notifyHabits(Context c)throws Exception{
  NotificationManager manager=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);manager.createNotificationChannel(new NotificationChannel("nong-habits","循环习惯提醒",NotificationManager.IMPORTANCE_DEFAULT));
  android.content.SharedPreferences p=prefs(c);if(!p.getBoolean("habitNotifications",false))return;
  if(Build.VERSION.SDK_INT>=33&&c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
  SimpleDateFormat fmt=new SimpleDateFormat("yyyy-MM-dd",Locale.US);fmt.setTimeZone(TimeZone.getTimeZone("Asia/Shanghai"));fmt.setLenient(false);String today=fmt.format(new Date());JSONArray habits=new JSONObject(p.getString("devicePlanner","{}")).optJSONArray("habits");if(habits==null)return;
  ArrayList<String> titles=new ArrayList<>();StringBuilder signature=new StringBuilder();
  for(int i=0;i<habits.length();i++){JSONObject h=habits.getJSONObject(i);int count=h.optInt("intervalCount");if(count<1||count>1200)continue;String base="";JSONArray days=h.optJSONArray("days");if(days!=null)for(int j=0;j<days.length();j++){String day=days.optString(j);if(day.compareTo(base)>0)base=day;}
   if(base.isEmpty())base=h.optString("startedOn");
   Calendar due=Calendar.getInstance(TimeZone.getTimeZone("Asia/Shanghai"));try{due.setTime(fmt.parse(base));}catch(Exception e){continue;}
   String unit=h.optString("intervalUnit");due.add(unit.equals("months")?Calendar.MONTH:Calendar.DAY_OF_MONTH,count*(unit.equals("weeks")?7:1));String dueDate=fmt.format(due.getTime());if(dueDate.compareTo(today)<=0){titles.add(h.optString("title"));signature.append(h.optString("id")).append(':').append(dueDate).append(';');}
  }
  if(titles.isEmpty()){manager.cancel(6040);p.edit().remove("habitNoticeSignature").apply();return;}
  String key=today+signature;if(key.equals(p.getString("habitNoticeSignature","")))return;
  PendingIntent open=PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  manager.notify(6040,new Notification.Builder(c,"nong-habits").setSmallIcon(android.R.drawable.ic_popup_reminder).setContentTitle("有 "+titles.size()+" 件循环事项到期").setContentText(android.text.TextUtils.join("、",titles)).setStyle(new Notification.BigTextStyle().bigText(android.text.TextUtils.join("、",titles)+"。完成后到习惯中打卡，周期会重新计算。" )).setContentIntent(open).setAutoCancel(true).build());p.edit().putString("habitNoticeSignature",key).apply();
 }
}
