import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {writeFileSync} from 'node:fs';
import {connectWebView} from './emulator-cdp.mjs';
import {shell,pause,screenshot,launch,out} from './emulator-control.mjs';
let c;const checks=[],requests=[],tag=String(Date.now());
const report={version:'0.4.1',checks,device:{android:shell('getprop','ro.build.version.release').trim(),sdk:shell('getprop','ro.build.version.sdk').trim()}};
const draft=title=>({reply:'请检查这张草稿，确认后才会保存。',questions:[],proposals:[{kind:'habit',data:{title,cue:'每周六 20:30 自我探索',intervalCount:1,intervalUnit:'weeks',startedOn:'2026-10-24'}}]});
const mock=createServer(async(req,res)=>{try{
 let raw='';for await(const part of req)raw+=part;const body=JSON.parse(raw),last=body.messages.at(-1)?.content||'',serialized=JSON.stringify(body.messages);requests.push({headers:{userAgent:req.headers['user-agent'],session:req.headers['x-opencode-session']},last});
 let reply;
 if(last.includes('上面选中的回复'))reply=JSON.stringify(draft('旧回复恢复草稿 '+tag));
 else if(last.includes('上一条回复提到了')){if(serialized.includes('MANUAL_RECOVERY')){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({message:'temporary format repair failure'}));return;}reply=JSON.stringify(draft('自动恢复草稿 '+tag));}
 else if(last.includes('WRAPPED_CASE'))reply='我为你整理如下：\n```json\n'+JSON.stringify(draft('围栏恢复草稿 '+tag))+'\n```\n请确认。';
 else if(last.includes('MANUAL_RECOVERY'))reply='MANUAL_RECOVERY：我先把这条拟成每周循环的习惯：每周六20:30，从10月24日开始。要保存到计划本吗？下面这条是草稿。';
 else reply='周六晚上八点半留一块给自己。我先把这条拟成每周循环的习惯：每周六20:30，从10月24日开始。要保存到计划本吗？下面这条是草稿。';
 res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:reply}}]}));
 }catch(e){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}});
await new Promise(r=>mock.listen(24179,'127.0.0.1',r));
const state=()=>JSON.parse(shell('run-as','com.nongplanner.app','cat','files/planner.json')).state;
async function until(fn){for(let i=0;i<60;i++){const value=fn();if(value)return value;await pause(150);}throw Error('Native condition timed out');}
async function newChat(text){await c.click('nav [data-page=coach]');await c.click('[data-chat-action=new]');await c.fill('.chat-window.is-active [data-chat-draft]',text);await c.click('.chat-window.is-active .chat-compose .primary');}
function passed(text){checks.push(text);console.log(text);}
try{
 c=await connectWebView();await c.wait("document.querySelector('#sync-status')?.textContent==='已同步至个人空间'");report.webview=await c.evaluate('navigator.userAgent');report.beforeCounts={tasks:state().tasks.length,sessions:state().sessions.length};
 await c.click('nav [data-page=settings]');await c.wait("document.querySelector('#settings-form [name=url]')");await c.fill('#settings-form [name=url]','http://10.0.2.2:24179/v1');await c.fill('#settings-form [name=model]','mock-format-recovery');await c.click('#settings-form .primary');await pause(400);
 await newChat('自动补全：每周六20:30自我探索，从2026年10月24日开始。');await c.wait("document.querySelector('.chat-window.is-active .plan-proposal.pending')",30000);assert.equal(requests.length,2);assert.ok(!state().habits.some(h=>h.title==='自动恢复草稿 '+tag));passed('截图同类纯文字保存承诺自动补出卡片，仅重试一次，确认前未写入');
 await c.click('.chat-window.is-active [data-chat-action=proposal]');await c.click('#modal .primary');await until(()=>state().habits.some(h=>h.title==='自动恢复草稿 '+tag));passed('用户检查确认后，每周循环习惯真实保存到 Android 私有数据');screenshot('041-auto-plan-card');
 await newChat('MANUAL_RECOVERY：请把周六20:30自我探索整理为习惯。');await c.wait("document.querySelector('.chat-window.is-active .plan-recovery small')?.textContent.includes('没有附上计划卡片')",30000);assert.equal(requests.length,4);assert.ok(!state().habits.some(h=>h.title==='旧回复恢复草稿 '+tag));
 await c.click('.chat-window.is-active [data-chat-action=extract-plan]');await c.wait("document.querySelector('.chat-window.is-active .plan-proposal.pending')",30000);assert.equal(requests.length,5);assert.ok(!state().habits.some(h=>h.title==='旧回复恢复草稿 '+tag));await c.click('.chat-window.is-active [data-chat-action=proposal]');await c.click('#modal .primary');await until(()=>state().habits.some(h=>h.title==='旧回复恢复草稿 '+tag));passed('自动补全失败保留原回复，点击生成计划卡片可恢复，仍需确认');screenshot('041-manual-recovery');
 await newChat('WRAPPED_CASE：请生成一张可确认卡片。');await c.wait("document.querySelector('.chat-window.is-active .plan-proposal.pending')",30000);assert.equal(requests.length,6);passed('正文加 Markdown JSON 围栏直接解析为卡片，无额外 API 调用');
 await c.click('nav [data-page=week]');const targetDate=await c.evaluate("document.querySelector('.week-day:last-child [data-task-date]').dataset.taskDate");await c.click('.week-day:last-child [data-task-date]');await c.fill('#modal [name=title]','周日保持位置 '+tag);await c.click('#modal .primary');await until(()=>state().tasks.some(t=>t.title==='周日保持位置 '+tag));const task=state().tasks.find(t=>t.title==='周日保持位置 '+tag);
 await c.evaluate("(()=>{const el=document.querySelector('.week-scroll');el.scrollLeft=el.scrollWidth-el.clientWidth;window.scrollTo(0,100);})()");await pause(300);
 const before=await c.evaluate("({left:document.querySelector('.week-scroll').scrollLeft,y:scrollY})");assert.ok(before.left>300);
 await c.evaluate(`document.querySelector('.week-task[data-toggle="${task.id}"]').click()`);await until(()=>state().tasks.find(t=>t.id===task.id)?.done);await pause(300);const after=await c.evaluate("({left:document.querySelector('.week-scroll').scrollLeft,y:scrollY})");assert.ok(Math.abs(before.left-after.left)<=1);assert.ok(Math.abs(before.y-after.y)<=1);report.weekScroll={before,after,date:targetDate};screenshot('041-week-scroll-preserved');
 await c.evaluate(`document.querySelector('.week-task[data-toggle="${task.id}"]').click()`);await until(()=>!state().tasks.find(t=>t.id===task.id)?.done);assert.equal(await c.evaluate("document.querySelector('.week-scroll').scrollLeft"),before.left);passed('周日事项完成和撤销后横向位置及页面纵向位置保持，不跳回周一');
 await c.click('nav [data-page=settings]');await c.wait("document.querySelector('.settings-layout')");const dimensions=await c.evaluate("Array.from(document.querySelectorAll('.settings-layout button')).map(b=>({text:b.textContent.trim(),width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})).filter(b=>b.height>0)");assert.ok(dimensions.every(b=>b.height<=42));assert.ok(dimensions.every(b=>b.width<=185));report.settingsButtons=dimensions;passed('设置页按钮均为紧凑尺寸，实测高度不超过42 CSS像素，页面无横向溢出');
 for(const color of ['blue','pink','red']){await c.click(`[data-theme-preset=${color}]`);await pause(400);assert.equal(await c.evaluate('document.documentElement.dataset.accent'),color);assert.equal(await c.evaluate('document.documentElement.scrollWidth>innerWidth'),false);screenshot('041-settings-'+color);}
 await c.click('.theme-custom summary');await c.click('[data-theme-part=paper][data-theme-value=blue]');await c.click('[data-theme-part=surface][data-theme-value=pink]');await c.click('[data-theme-part=accent][data-theme-value=blue]');assert.equal(await c.evaluate("document.querySelector('.theme-custom').open"),true);passed('红蓝粉整套预设、分层混搭与展开状态保留正常');screenshot('041-theme-custom');
 c.close();launch();await pause(500);c=await connectWebView();await c.wait("document.querySelector('#sync-status')?.textContent==='已同步至个人空间'");assert.equal(await c.evaluate('document.documentElement.dataset.paper'),'blue');assert.ok(state().habits.some(h=>h.title==='旧回复恢复草稿 '+tag));assert.ok(state().tasks.some(t=>t.id===task.id));passed('强制退出重开后，恢复生成的计划与原有记录、主题均保留');
 const logs=shell('logcat','-d','-t','500','AndroidRuntime:E','chromium:E','*:S');assert.ok(!logs.includes('FATAL EXCEPTION'));report.headers=requests.map(r=>r.headers);report.status='passed';
}catch(e){report.status='failed';report.error=e.stack;try{screenshot('041-failure');report.ui=await c?.evaluate('document.body.innerText');}catch{}throw e;}
finally{report.finishedAt=new Date().toISOString();writeFileSync(out+'/041-functional-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));c?.close();await new Promise(r=>mock.close(r));}
