import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {writeFileSync} from 'node:fs';
import {connectWebView} from './emulator-cdp.mjs';
import {shell,pause,hierarchy,tapNode,screenshot,out,launch} from './emulator-control.mjs';
let c,calls=0;const checks=[];const report={version:'0.5.0',checks};
const mock=createServer((req,res)=>{calls++;res.writeHead(500);res.end('Unexpected AI request');});await new Promise(r=>mock.listen(24179,'127.0.0.1',r));
const active=()=>shell('dumpsys','notification','--noredact').split('Notification List:')[1]?.split('Notification Preferences:')[0]||'';
const hasReview=()=>/NotificationRecord\([^\n]*pkg=com\.nongplanner\.app[^\n]*id=6051\b/.test(active());
async function wait(fn){for(let i=0;i<60;i++){if(fn())return;await pause(200);}throw Error('Notification condition timed out');}
async function configure({enabled=true,quietFrom='00:00',quietTo='00:00'}={}){await c.click('nav [data-page=settings]');await c.click('[data-action=review-preferences]');await c.evaluate(`document.querySelector('#modal [name=enabled]').checked=${enabled}`);await c.fill('#modal [name=dailyTime]','00:01');await c.fill('#modal [name=quietFrom]',quietFrom);await c.fill('#modal [name=quietTo]',quietTo);await c.click('#modal .primary');await pause(500);if(enabled){await c.click('[data-action=review-resume]');await pause(450);}}
try{
 launch();await pause(650);
 c=await connectWebView();await c.wait("document.querySelector('#sync-status')?.textContent==='已同步至个人空间'");if(await c.evaluate("!!document.querySelector('#modal[open]')"))await c.click('#modal [data-close]');
 await configure();await c.evaluate("window.NongAndroid.snoozeReview(0)");await pause(400);assert.equal(hasReview(),false);c.close();
 shell('am','start','-a','android.intent.action.MAIN','-c','android.intent.category.HOME');await pause(300);shell('am','kill','com.nongplanner.app');await pause(350);try{report.pidBeforeJob=shell('pidof','com.nongplanner.app').trim();}catch{report.pidBeforeJob='';}assert.equal(report.pidBeforeJob,'');
 const result=shell('cmd','jobscheduler','run','-f','com.nongplanner.app','6040');report.jobCommand=result;await wait(hasReview);assert.equal(calls,0);checks.push('应用退到后台后，由真实系统 JobService 发出复盘通知，后台无 AI HTTP 请求');
 shell('cmd','statusbar','expand-notifications');await pause(400);let nodes=hierarchy('050-background-notifications');const expand=nodes.find(n=>n['resource-id']==='com.android.systemui:id/expand_button'&&n.clickable==='true');if(expand){tapNode(expand);await pause(350);nodes=hierarchy('050-background-notifications-expanded');}const notice=nodes.find(n=>n.text==='给今天一点清晰的方向');assert.ok(notice);screenshot('050-background-review-notification');tapNode(notice);await pause(600);c=await connectWebView();await c.wait("!!document.querySelector('.review-hub')");checks.push('实际点击后台通知可冷启动/恢复应用，并进入复盘清单');
 await configure({quietFrom:'00:00',quietTo:'23:59'});await c.evaluate("window.NongAndroid.snoozeReview(0)");await pause(300);shell('cmd','jobscheduler','run','-f','com.nongplanner.app','6040');await pause(700);assert.equal(hasReview(),false);checks.push('覆盖当前时段的免打扰生效，不发送复盘通知');
 await configure({enabled:false});await c.evaluate("window.NongAndroid.snoozeReview(0)");await pause(300);shell('cmd','jobscheduler','run','-f','com.nongplanner.app','6040');await pause(700);assert.equal(hasReview(),false);checks.push('暂停提醒后，后台检查不发送通知');
 await configure();await c.click('[data-action=review-snooze]');await pause(300);shell('cmd','jobscheduler','run','-f','com.nongplanner.app','6040');await pause(700);assert.equal(hasReview(),false);checks.push('稍后一天生效，后台检查不会打扰');
 await c.click('[data-action=review-preferences]');await c.fill('#modal [name=dailyTime]','09:00');await c.fill('#modal [name=quietFrom]','22:00');await c.fill('#modal [name=quietTo]','08:00');await c.click('#modal .primary');assert.equal(calls,0);report.aiRequests=calls;report.status='passed';
}catch(e){report.status='failed';report.error=e.stack;try{screenshot('050-notifications-failure');}catch{}throw e;}
finally{report.finishedAt=new Date().toISOString();writeFileSync(out+'/050-notifications-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));c?.close();await new Promise(r=>mock.close(r));}
