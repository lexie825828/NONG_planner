import {createServer} from 'node:http';
import {writeFileSync,readFileSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {adb,shell,pause,screenshot,out,launch,hierarchy} from './emulator-control.mjs';
import {connectWebView} from './emulator-cdp.mjs';

// This test talks to the actual app's Android WebView and native Java bridge.
// The only mock is the external AI vendor, hosted on the Windows loopback interface.
const checks=[],requests=[];let client;
const report={startedAt:new Date().toISOString(),device:JSON.parse(JSON.stringify({android:shell('getprop','ro.build.version.release').trim(),sdk:shell('getprop','ro.build.version.sdk').trim(),model:shell('getprop','ro.product.model').trim()})),checks};
const mock=createServer(async(req,res)=>{try{
 let raw='';for await(const chunk of req)raw+=chunk;const input=JSON.parse(raw);requests.push({url:req.url,authorization:req.headers.authorization,model:input.model,messages:input.messages});
 const context=JSON.parse(input.messages[1].content.split('\n').slice(1).join('\n'));const final=input.messages.at(-1).content;
 let output={reply:'让我们从今天的一小步开始。要把这个计划保存下来吗？',questions:['今天想留多少休息时间？'],proposals:[{kind:'task',data:{title:'Emulator AI reading plan',date:context.today,time:'20:00'}}]};
 if(typeof final==='string'&&final.includes('日记'))output={reply:'这是今天的日记草稿，确认后保存。',proposals:[{kind:'diary',data:{title:'Emulator diary',date:context.today,content:'今天为阅读和休息留了一点时间。'}}]};
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(output)}}]}));
 }catch(e){res.statusCode=500;res.end(JSON.stringify({error:e.message}));}});
await new Promise(resolve=>mock.listen(24179,'127.0.0.1',resolve));
const state=()=>JSON.parse(shell('run-as','com.nongplanner.app','cat','files/planner.json')).state;
async function nativeStateWait(predicate,timeout=10000){const start=Date.now();while(Date.now()-start<timeout){try{const s=state();if(predicate(s))return s;}catch{}await pause(150);}throw Error('Native persistent state did not update');}
try{
 client=await connectWebView();await client.wait("document.querySelector('#sync-status')?.textContent==='已同步至个人空间'");
 report.webview=await client.evaluate('navigator.userAgent');report.viewport=await client.evaluate('({width:innerWidth,height:innerHeight})');checks.push('Real Android WebView loaded the packaged app and native bootstrap completed');
 await client.click('[data-action=add-task]');await client.fill('#modal input[name=title]','Emulator native persistence');await client.click('#modal .primary');await nativeStateWait(s=>s.tasks.some(t=>t.title==='Emulator native persistence'));
 const firstId=state().tasks.find(t=>t.title==='Emulator native persistence').id;await client.click(`[data-toggle="${firstId}"]`);await nativeStateWait(s=>s.tasks.some(t=>t.id===firstId&&t.done));screenshot('02-android16-plan-saved');checks.push('Task creation and completion persisted through the real native Java file API');
 client.close();launch();await pause(1000);client=await connectWebView();await client.wait("document.querySelector('.task.done b')?.textContent==='Emulator native persistence'");checks.push('Force-stop and reopen retained completed plan');
 await client.click('nav [data-page=settings]');await client.wait("document.querySelector('#settings-form input[name=url]')");await client.fill('#settings-form input[name=url]','http://10.0.2.2:24179/v1');await client.fill('#settings-form input[name=model]','emulator-mock-vision');await client.fill('#settings-form input[name=key]','emulator-test-key');await client.click('#settings-form .primary');await client.wait("document.querySelector('#settings-form input[name=key]')?.placeholder==='已保存，留空保留'");
 const prefs=shell('run-as','com.nongplanner.app','cat','shared_prefs/nong-private.xml');assert.ok(!prefs.includes('emulator-test-key'));checks.push('Android Keystore encrypted the API key and native settings restored hasKey');
 await client.click('nav [data-page=coach]');await client.click('[data-chat-action=new]');await client.wait("document.querySelector('[data-chat-draft]')");
 await client.fill('[data-chat-draft]','Please help me plan reading today.');await client.click('.chat-compose .primary');await client.wait("document.querySelector('.plan-proposal.pending')",30000);
 assert.equal(requests.at(-1).authorization,'Bearer emulator-test-key');assert.ok(!state().tasks.some(t=>t.title==='Emulator AI reading plan'));checks.push('Actual native HTTP called the local mock AI; proposed plan did not autosave');
 await client.click('[data-chat-action=proposal]');await client.click('#modal .primary');await nativeStateWait(s=>s.tasks.some(t=>t.title==='Emulator AI reading plan'));checks.push('User confirmation saved the AI draft through the native API');
 await client.click('[data-chat-action=diary]');await client.click('#modal .primary');await client.wait("document.querySelector('.plan-proposal.pending')",30000);await client.click('.plan-proposal.pending [data-chat-action=proposal]');await client.click('#modal .primary');await nativeStateWait(s=>s.diaries.some(d=>d.title==='Emulator diary'));screenshot('03-android16-chat-confirmation');checks.push('Diary generation and confirmation wrote to the real Android diary library');
 await client.click('nav [data-page=review]');await client.wait("document.body.innerText.includes('Emulator diary')");screenshot('04-android16-diary');
 await client.click('nav [data-page=today]');assert.equal(await client.evaluate('document.documentElement.scrollWidth>innerWidth'),false);
 const logs=shell('logcat','-d','-t','500','AndroidRuntime:E','chromium:E','*:S');writeFileSync(path.join(out,'android-runtime-log.txt'),logs);assert.ok(!logs.includes('FATAL EXCEPTION'));checks.push('No horizontal overflow or fatal Android runtime exception during tested flows');
 report.status='passed';report.finishedAt=new Date().toISOString();report.aiRequests=requests.length;writeFileSync(path.join(out,'functional-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(e){report.status='failed';report.error=e.stack;report.finishedAt=new Date().toISOString();try{screenshot('failure');report.ui=hierarchy('failure').filter(n=>n.text||n['content-desc']);}catch{}writeFileSync(path.join(out,'functional-report.json'),JSON.stringify(report,null,2));throw e;}
finally{client?.close();await new Promise(resolve=>mock.close(resolve));}
