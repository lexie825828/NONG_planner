import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {writeFileSync} from 'node:fs';
import {connectWebView} from './emulator-cdp.mjs';
import {shell,adb,pause,screenshot,launch,out,hierarchy,tapNode} from './emulator-control.mjs';
import {habitDue} from '../public/planner-core.js';
let c;const checks=[],requests=[];const report={version:'0.4.0',checks,device:{android:shell('getprop','ro.build.version.release').trim(),sdk:shell('getprop','ro.build.version.sdk').trim()}};
const mock=createServer(async(req,res)=>{let raw='';for await(const x of req)raw+=x;requests.push({headers:req.headers,body:JSON.parse(raw)});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({reply:'已收到，等待你确认计划。',proposals:[]})}}]}));});
await new Promise(r=>mock.listen(24179,'127.0.0.1',r));
const state=()=>JSON.parse(shell('run-as','com.nongplanner.app','cat','files/planner.json')).state;
async function until(fn){for(let i=0;i<60;i++){try{const result=fn();if(result)return result;}catch{}await pause(150);}throw Error('Native condition timed out');}
const submit=()=>c.click('#modal .primary');
const events=()=>shell('content','query','--uri','content://com.android.calendar/events','--projection','_id:title:dtstart:_sync_id');
async function permission(){await pause(400);const nodes=hierarchy('040-permission');const allow=nodes.find(n=>n['resource-id']?.endsWith('permission_allow_button'));if(allow)tapNode(allow);await pause(400);}
try{
 c=await connectWebView();await c.wait("document.querySelector('#sync-status')?.textContent==='已同步至个人空间'");
 report.webview=await c.evaluate('navigator.userAgent');const old=state();report.preservedRecords={tasks:old.tasks.length,diaries:old.diaries.length};
 await c.click('nav [data-page=week]');await c.click('[data-week-todo-add]');await c.fill('#modal [name=title]','本周整理生活空间');await submit();
 let todo=await until(()=>state().weekTodos?.filter(x=>x.title==='本周整理生活空间').at(-1));await c.click(`[data-week-todo-toggle="${todo.id}"]`);await until(()=>state().weekTodos.find(x=>x.id===todo.id)?.done);
 assert.equal(await c.evaluate(`document.querySelector('[data-week-todo-toggle="${todo.id}"]').closest('.task').classList.contains('done')`),true);
 screenshot('040-week-todo-done');await c.click(`[data-week-todo-toggle="${todo.id}"]`);await until(()=>!state().weekTodos.find(x=>x.id===todo.id)?.done);console.log('验收进度',checks.length);checks.push('独立周待办可新增、点击完成变灰、再次点击恢复');
 await c.click('nav [data-page=life]');await c.click('[data-action=add-habit]');await c.fill('#modal [name=title]','更换床单');await c.fill('#modal [name=intervalCount]','2');await c.fill('#modal [name=intervalUnit]','months');await c.fill('#modal [name=startedOn]','2026-08-01');await submit();
 const habit=await until(()=>state().habits.filter(x=>x.title==='更换床单').at(-1));assert.equal(habitDue(habit),'2026-10-01');assert.ok(await c.evaluate("document.querySelector('.habit-due')?.innerText.includes('更换床单')"));screenshot('040-habit-due');
 await c.click('nav [data-page=settings]');if(!shell('run-as','com.nongplanner.app','cat','shared_prefs/nong-private.xml').includes('<boolean name="habitNotifications" value="true"')){await c.click('[data-action=native-reminders]');await permission();}
 await until(()=>shell('dumpsys','notification','--noredact').includes('更换床单'));console.log('验收进度',checks.length);checks.push('两个月循环到期显示提醒，并通过真实 Android 通知服务发出通知');
 await c.click('nav [data-page=life]');await c.click(`[data-habit="${habit.id}"]`);await until(()=>state().habits.find(x=>x.id===habit.id)?.days.length);
 const updated=state().habits.find(x=>x.id===habit.id);report.resetDue=habitDue(updated);assert.equal(report.resetDue,'2026-12-21');await until(()=>!shell('dumpsys','notification','--noredact').includes('pkg=com.nongplanner.app user=UserHandle{0} id=6040'));
 console.log('验收进度',checks.length);checks.push('打卡后两个月周期重新计算，到期通知撤销');screenshot('040-habit-reset');
 await c.click('nav [data-page=projects]');await c.click('[data-action=add-project]');await c.fill('#modal [name=title]','年度阅读项目');await submit();await until(()=>state().projects.some(x=>x.title==='年度阅读项目'));
 const project=state().projects.find(x=>x.title==='年度阅读项目');await c.click(`[data-project-task="${project.id}"]`);await c.fill('#modal [name=title]','整理阅读书单');await c.fill('#modal [name=date]','2026-12-15');await submit();await c.wait("document.body.innerText.includes('DDL · 2026-12-15')");console.log('验收进度',checks.length);checks.push('项目拆解任务展示日期 DDL');screenshot('040-project-ddl');
 await c.click('nav [data-page=settings]');await c.click('[data-theme-part=paper][data-theme-value=blue]');await c.click('[data-theme-part=surface][data-theme-value=pink]');await c.click('[data-theme-part=accent][data-theme-value=blue]');assert.deepEqual(await c.evaluate('({...document.documentElement.dataset})'),{paper:'blue',surface:'pink',accent:'blue'});screenshot('040-theme-layers');console.log('验收进度',checks.length);checks.push('纸张、卡片、重点色可独立混搭');
 if(!shell('run-as','com.nongplanner.app','cat','shared_prefs/nong-private.xml').includes('<boolean name="calendarEnabled" value="true"')){await c.click('[data-action=native-calendar]');await permission();}
 await until(()=>events().includes('Emulator AI reading plan'));const original=events();report.calendarInitial=original;
 await c.click('nav [data-page=today]');await c.click('[data-action=add-task]');await c.fill('#modal [name=title]','日历自动联动验收');await c.fill('#modal [name=time]','16:20');await submit();await until(()=>events().includes('日历自动联动验收'));
 const calendarTask=state().tasks.find(x=>x.title==='日历自动联动验收');const before=events().split('\n').find(x=>x.includes(calendarTask.id));const eventId=before.match(/_id=(\d+)/)[1];
 await c.click(`[data-edit="${calendarTask.id}"]`);await c.fill('#modal [name=title]','日历修改验收');await c.fill('#modal [name=time]','17:40');await submit();await until(()=>events().includes('日历修改验收'));
 assert.equal(events().split('\n').find(x=>x.includes(calendarTask.id)).match(/_id=(\d+)/)[1],eventId);assert.equal(events().split('\n').filter(x=>x.includes(calendarTask.id)).length,1);
 await c.click(`[data-edit="${calendarTask.id}"]`);await c.fill('#modal [name=time]','');await submit();await until(()=>!events().includes(calendarTask.id));console.log('验收进度',checks.length);checks.push('真实系统日历自动创建，修改复用原事件，清空时间后移除且无重复');
 await c.click('nav [data-page=settings]');await c.fill('#settings-form [name=url]','http://10.0.2.2:24179/v1');await c.fill('#settings-form [name=model]','mock');await c.click('#settings-form .primary');await pause(300);
 await c.click('nav [data-page=coach]');await c.click('[data-chat-action=new]');await c.fill('.chat-window.is-active [data-chat-draft]','帮我安排明天');await c.click('.chat-window.is-active .chat-compose .primary');await until(()=>requests.length===1);await c.wait("document.body.innerText.includes('已收到，等待你确认计划。')");
 await c.fill('.chat-window.is-active [data-chat-draft]','留一点休息时间');await c.click('.chat-window.is-active .chat-compose .primary');await until(()=>requests.length===2);await c.wait("!document.querySelector('.chat-window.is-active .chat-compose .primary').disabled");
 assert.equal(requests[0].headers['user-agent'],'NongPlanner/0.4.0');assert.ok(requests[0].headers['x-opencode-session']);assert.equal(requests[0].headers['x-opencode-session'],requests[1].headers['x-opencode-session']);
 await c.click('[data-chat-action=new]');await c.fill('.chat-window.is-active [data-chat-draft]','另一段对话');await c.click('.chat-window.is-active .chat-compose .primary');await until(()=>requests.length===3);assert.notEqual(requests[0].headers['x-opencode-session'],requests[2].headers['x-opencode-session']);console.log('验收进度',checks.length);checks.push('真实原生 HTTP 发送 app User-Agent，窗口内 session 稳定，不同窗口 session 不同');
 report.headers=requests.map(r=>({userAgent:r.headers['user-agent'],session:r.headers['x-opencode-session']}));
 c.close();launch();await pause(600);c=await connectWebView();await c.wait("document.querySelector('#sync-status')?.textContent==='已同步至个人空间'");assert.equal(await c.evaluate('document.documentElement.dataset.paper'),'blue');assert.ok(state().weekTodos.some(x=>x.id===todo.id));assert.ok(state().habits.some(x=>x.id===habit.id&&x.days.length));console.log('验收进度',checks.length);checks.push('强制退出重开后，原记录、周待办、打卡和主题均保留');
 await c.click('nav [data-page=week]');assert.equal(await c.evaluate('document.documentElement.scrollWidth>innerWidth'),false);screenshot('040-final-week');
 report.status='passed';
}catch(e){report.status='failed';report.error=e.stack;try{screenshot('040-failure');report.ui=await c?.evaluate('document.body.innerText');}catch{}throw e;}
finally{report.finishedAt=new Date().toISOString();writeFileSync(out+'/040-functional-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));c?.close();await new Promise(r=>mock.close(r));}
