import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState} from '../public/chat-core.js';
test('Android bridge sends model messages, parses drafts, propagates conflicts, and exports calendar',async()=>{
 const state=emptyState();state.tasks.push({id:'t',title:'原计划',date:'2026-10-21'});state.sessions.push({id:'chat',botName:'小禾',messages:[{id:'m',role:'user',text:'帮我做计划'}]});
 globalThis.location=new URL('https://appassets.androidplatform.net/');globalThis.document={body:{classList:{add(){}}}};
 let last,callbackMode='state';globalThis.window={fetch:async()=>{throw Error('Native APIs must not use browser network')},NongAndroid:{request(id,path,method,raw){last={path,method,data:JSON.parse(raw)};let result={revision:1,state};if(path==='/api/coach')result={rawContent:JSON.stringify({reply:'确认保存吗？',proposals:[{kind:'task',data:{title:'阅读',date:'2026-10-21'}}]})};if(callbackMode==='conflict')result={nativeStatus:409,error:'版本冲突'};queueMicrotask(()=>window.__nongNativeResult(id,200,JSON.stringify(result)));}}};
 try{await import('../public/android-runtime.js');let r=await window.fetch('/api/state');assert.equal((await r.json()).state.tasks.length,1);
 r=await window.fetch('/api/coach',{method:'POST',body:JSON.stringify({state,sessionId:'chat',prompt:'帮我做计划'})});const response=await r.json();assert.equal(response.proposals[0].status,'pending');assert.equal(state.tasks.length,1);assert.match(last.data.modelMessages[0].content,/小禾/);
 r=await window.fetch('/calendar.ics');assert.match(await r.text(),/SUMMARY:原计划/);
 callbackMode='conflict';r=await window.fetch('/api/state',{method:'PUT',body:JSON.stringify({revision:0,state})});assert.equal(r.status,409);assert.equal((await r.json()).error,'版本冲突');
 }finally{delete globalThis.window;delete globalThis.document;delete globalThis.location;}
});
