package com.nongplanner.app;
import android.app.job.*;
public class ReminderJob extends JobService {
 @Override public boolean onStartJob(JobParameters params){new Thread(()->{try{DevicePlanner.notifyHabits(this);ReviewReminders.run(this);ReviewReminders.schedule(this);}catch(Exception ignored){}jobFinished(params,false);}).start();return true;}
 @Override public boolean onStopJob(JobParameters params){return true;}
}
