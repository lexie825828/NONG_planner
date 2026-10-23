package com.nongplanner.app;
import android.content.*;
public class ReviewReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){final PendingResult pending=goAsync();new Thread(()->{try{if("com.nongplanner.REVIEW_SNOOZE".equals(intent.getAction()))ReviewReminders.snooze(context,24);else ReviewReminders.run(context);ReviewReminders.schedule(context);}catch(Exception ignored){}finally{pending.finish();}}).start();}
}
