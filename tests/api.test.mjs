import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {emptyState} from '../lib.mjs';
test('authenticated persistence, conflict protection, calendar and compatible AI',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'nong-api-'));
 let child;const base='http://localhost:24173';
 async function start(){child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'24173',DATA_DIR:dir},stdio:'pipe'});let stderr='';child.stderr.on('data',c=>stderr+=c);await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',c=>reject(Error('Server exited '+c+' '+stderr)));});}
 async function stop(){const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;}
 let mock;try{await start();assert.equal((await fetch(base+'/api/state')).status,401);const plannerModule=await fetch(base+'/planner-core.js');assert.equal(plannerModule.status,200);assert.match(await plannerModule.text(),/export function habitDue/);
 assert.equal((await fetch(base+'/api/bootstrap',{headers:{Origin:'https://untrusted.example'}})).status,403);
 const {token}=await (await fetch(base+'/api/bootstrap')).json();const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const state=emptyState();state.tasks.push({id:'test',title:'任务',date:'2026-10-21',time:'13:00'});
 let r=await fetch(base+'/api/state',{method:'PUT',headers,body:JSON.stringify({revision:0,state})});assert.equal(r.status,200);
 r=await fetch(base+'/api/state',{method:'PUT',headers,body:JSON.stringify({revision:0,state:emptyState()})});assert.equal(r.status,409);
 const concurrent=await Promise.all([1,2].map(()=>fetch(base+'/api/state',{method:'PUT',headers,body:JSON.stringify({revision:1,state})})));assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
 r=await fetch(base+'/api/state',{method:'PUT',headers,body:JSON.stringify({revision:2,state:{tasks:[]}})});assert.equal(r.status,400);
 r=await fetch(base+'/api/coach',{method:'POST',headers,body:JSON.stringify({state,prompt:'分析'})});assert.equal(r.status,400);
 let called=false;mock=http.createServer(async(req,res)=>{let text='';for await(const c of req)text+=c;const b=JSON.parse(text);assert.equal(req.url,'/v1/chat/completions');assert.equal(req.headers.authorization,'Bearer test-secret');assert.equal(req.headers['user-agent'],'NongPlanner/0.6.0');assert.ok(req.headers['x-opencode-session']);assert.equal(b.model,'mock-model');assert.match(b.messages[1].content,/任务/);called=true;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:'先推进一个小步骤。'}}]}));});await new Promise(resolve=>mock.listen(24175,'127.0.0.1',resolve));
 r=await fetch(base+'/api/settings',{method:'PUT',headers,body:JSON.stringify({url:'http://127.0.0.1:24175/v1',model:'mock-model',key:'test-secret'})});assert.equal(r.status,200);
 const settings=await(await fetch(base+'/api/settings',{headers})).json();assert.equal(settings.ai.hasKey,true);assert.equal(settings.ai.key,undefined);
 r=await fetch(base+'/api/coach',{method:'POST',headers,body:JSON.stringify({state,prompt:'分析我的项目'})});assert.equal((await r.json()).reply,'先推进一个小步骤。');assert.equal(called,true);
 assert.equal((await fetch(base+'/calendar.ics?key=invalid')).status,401);const ics=await(await fetch(base+settings.calendarPath)).text();assert.match(ics,/SUMMARY:任务/);assert.match(ics,/DTSTART:20261021T050000Z/);
 await stop();await start();const persisted=await(await fetch(base+'/api/state',{headers})).json();assert.equal(persisted.revision,2);assert.equal(persisted.state.tasks[0].title,'任务');
 assert.equal((await readFile(path.join(dir,'planner.json'),'utf8')).includes('test-secret'),false);
 }finally{if(child?.exitCode===null)await stop();if(mock)await new Promise(r=>mock.close(r));}
});
