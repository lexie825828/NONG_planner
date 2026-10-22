import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const data=await mkdtemp(path.join(tmpdir(),'nong-android-ui-'));
const server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'24178',DATA_DIR:data},stdio:'pipe'});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
let browser;try{
 browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
 const context=await browser.newContext({viewport:{width:411,height:891}});
 await context.addInitScript(()=>{
  const keys=['tasks','projects','habits','checkins','reviews','goals','notes','messages','sessions','diaries','memories'];
  let db=JSON.parse(localStorage.getItem('native-test-db')||'null')||{revision:0,state:Object.fromEntries(keys.map(k=>[k,[]]))};
  window.nativeExports=[];window.nativeConnections=0;window.nativePayloads=[];window.nativeReadyCount=0;window.nativeBootErrors=[];
  window.NongAndroid={
   ready(){window.nativeReadyCount++;},
   reportError(message){window.nativeBootErrors.push(message);},
   request(id,path,method,raw){const data=JSON.parse(raw);let out={};
    if(path==='/api/bootstrap')out={token:'native-personal-token'};
    if(path==='/api/state'){if(method==='PUT'){if(data.revision!==db.revision)out={nativeStatus:409,error:'冲突'};else{db={revision:db.revision+1,state:data.state};localStorage.setItem('native-test-db',JSON.stringify(db));out={revision:db.revision};}}else out=db;}
    if(path==='/api/settings')out={ai:{url:'https://example.invalid/v1',model:'mock-model',hasKey:false},calendarPath:'/calendar.ics',androidStandalone:true};
    if(path==='/api/coach'){window.nativePayloads.push(data);out={rawContent:JSON.stringify({reply:'要把阅读计划保存下来吗？',proposals:[{kind:'task',data:{title:'每天读一点书',date:'2026-10-21'}}]})};}
    setTimeout(()=>window.__nongNativeResult(id,200,JSON.stringify(out)),10);
   },
   saveFile(name,text,type){window.nativeExports.push({name,text,type});},
   configureServer(){window.nativeConnections++;}
  };
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:24178');await page.waitForFunction(()=>document.querySelector('#sync-status')?.textContent==='已同步至个人空间');
 assert.ok(await page.locator('body.native-android').count());
 assert.equal(await page.evaluate(()=>window.nativeReadyCount),1);
 await page.getByRole('button',{name:'＋ 添加计划',exact:true}).click();await page.locator('#modal input[name=title]').fill('手机本地计划');await page.locator('#modal button.primary').click();await page.reload();await page.waitForFunction(()=>document.querySelector('.task b')?.textContent==='手机本地计划');
 await page.locator('nav [data-page=coach]').click();await page.getByRole('button',{name:'开始第一段对话'}).click();await page.locator('.chat-window textarea').fill('帮我规划阅读');await page.locator('.chat-window form button.primary').click();await page.locator('.plan-proposal.pending').waitFor();
 assert.ok(await page.evaluate(()=>window.nativePayloads[0].modelMessages.length>=3));await page.getByRole('button',{name:'查看并确认'}).click();await page.locator('#modal button.primary').click();await page.locator('.plan-proposal.applied').waitFor();
 await page.locator('nav [data-page=settings]').click();await page.getByRole('button',{name:'连接电脑 / 切回本地'}).click();assert.equal(await page.evaluate(()=>window.nativeConnections),1);assert.equal(await page.locator('#pair-form').isVisible(),false);
 await page.getByRole('button',{name:'导出备份',exact:true}).click();assert.equal(await page.evaluate(()=>JSON.parse(window.nativeExports.at(-1).text).state.tasks.length),2);
 await page.evaluate(()=>window.dispatchEvent(new Event('nong-server-changed')));await page.locator('.conflict').waitFor();await page.getByRole('button',{name:'采用服务器版本'}).click();await page.locator('#modal button.primary').click();await page.waitForFunction(()=>!document.querySelector('.conflict'));
 await page.screenshot({path:'android-app-preview.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.nativeBootErrors),[]);console.log('ANDROID ADAPTER UI PASS: boot-ready callback with no resource errors, independent local state, reload, native AI payload, confirmation, native export, connection entry and protected space switching. Native Android device execution remains to be tested.');
}finally{await browser?.close();server.kill();}
