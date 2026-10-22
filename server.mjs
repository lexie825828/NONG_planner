import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {emptyState,validState,calendar} from './lib.mjs';
import {migrateState} from './public/chat-core.js';
import {runCoach} from './coach.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),dir=process.env.DATA_DIR||path.join(root,'data');
await mkdir(dir,{recursive:true});
async function read(name,fallback){try{return JSON.parse(await readFile(path.join(dir,name),'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
async function save(name,data){await writeFile(path.join(dir,name+'.tmp'),JSON.stringify(data,null,2));await rename(path.join(dir,name+'.tmp'),path.join(dir,name));}
let config=await read('config.json',null);if(!config){config={token:randomBytes(24).toString('hex'),calendarToken:randomBytes(24).toString('hex'),ai:{url:'',model:'',key:''}};await save('config.json',config);}
let db=await read('planner.json',{revision:0,state:emptyState()});
db.state=migrateState(db.state);
const equal=(a,b)=>typeof a==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req){let chunks=[],size=0;for await(const c of req){size+=c.length;if(size>12e6)throw Object.assign(Error('数据超过 12 MB，请导出备份并清理旧会话图片'),{status:413});chunks.push(c);}return JSON.parse(Buffer.concat(chunks).toString()||'{}');}
let queue=Promise.resolve();function serial(fn){const p=queue.then(fn);queue=p.catch(()=>{});return p;}
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
if(req.headers.origin&&req.headers.origin!==`${req.headers['x-forwarded-proto']==='https'?'https':'http'}://${req.headers.host}`){return json(res,403,{error:'来源不匹配'});}
const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
if(url.pathname==='/api/bootstrap'&&req.method==='GET'){if(!local||!['localhost','127.0.0.1','[::1]'].includes((req.headers.host||'').replace(/:\d+$/,'')))return json(res,403,{error:'请在设备连接中输入配对密钥'});return json(res,200,{token:config.token});}
if(url.pathname==='/calendar.ics'){if(!equal(url.searchParams.get('key'),config.calendarToken))return json(res,401,{error:'订阅密钥无效'});res.writeHead(200,{'Content-Type':'text/calendar; charset=utf-8','Cache-Control':'no-store'});return res.end(calendar(db.state));}
if(url.pathname.startsWith('/api/')){if(!equal((req.headers.authorization||'').replace(/^Bearer /,''),config.token))return json(res,401,{error:'配对密钥无效，请在设置中重新连接'});
if(url.pathname==='/api/state'&&req.method==='GET')return json(res,200,db);
if(url.pathname==='/api/state'&&req.method==='PUT'){const b=await body(req);return await serial(async()=>{if(b.revision!==db.revision)return json(res,409,{error:'其他设备已有更新',revision:db.revision});if(!validState(b.state))return json(res,400,{error:'数据格式不正确'});const next={revision:db.revision+1,state:migrateState(b.state)};await save('planner.json',next);db=next;json(res,200,{revision:db.revision});});}
if(url.pathname==='/api/settings'&&req.method==='GET')return json(res,200,{ai:{url:config.ai.url,model:config.ai.model,hasKey:!!config.ai.key},calendarPath:'/calendar.ics?key='+config.calendarToken});
if(url.pathname==='/api/settings'&&req.method==='PUT'){const b=await body(req);return await serial(async()=>{const ai={url:String(b.url||'').trim(),model:String(b.model||'').trim(),key:b.clearKey?'':String(b.key||config.ai.key)};if(ai.url){const u=new URL(ai.url);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))return json(res,400,{error:'API 地址须使用 HTTPS；本地模型允许 localhost HTTP'});if(u.username||u.password||u.search||u.hash)return json(res,400,{error:'API 地址不能包含凭据、查询参数或片段'});}const next={...config,ai};await save('config.json',next);config=next;json(res,200,{ok:true});});}
if(url.pathname==='/api/coach'&&req.method==='POST'){
const b=await body(req);
if(!config.ai.url||!config.ai.model)return json(res,400,{error:'请先在设置中填写 API Base URL、模型和密钥（本地模型可不填密钥）'});
if((b.prompt!==undefined&&(typeof b.prompt!=='string'||b.prompt.length>12000))||!validState(b.state))return json(res,400,{error:'输入格式错误、图片无效或内容过长'});
if(b.sessionId&&!migrateState(b.state).sessions.some(s=>s.id===b.sessionId))return json(res,400,{error:'会话不存在'});
if(b.date&&!/^\d{4}-\d{2}-\d{2}$/.test(b.date))return json(res,400,{error:'日记日期无效'});
return json(res,200,await runCoach(b,config.ai));
}
return json(res,404,{error:'接口不存在'});}
const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/native-boot.js':'native-boot.js','/android-runtime.js':'android-runtime.js','/coach-context.js':'coach-context.js','/calendar.js':'calendar.js','/chat-core.js':'chat-core.js','/chat-ui.js':'chat-ui.js','/storage.js':'storage.js','/chat.css':'chat.css','/style.css':'style.css','/manifest.webmanifest':'manifest.webmanifest','/sw.js':'sw.js','/icon.svg':'icon.svg','/icon-192.png':'icon-192.png','/icon-512.png':'icon-512.png'};
files['/planner-core.js']='planner-core.js';files['/coach-response.js']='coach-response.js';
const f=files[url.pathname];if(!f)return json(res,404,{error:'页面不存在'});const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};res.writeHead(200,{'Content-Type':types[path.extname(f)],'Cache-Control':'no-cache'});res.end(await readFile(path.join(root,'public',f)));
}catch(e){if(!res.headersSent)json(res,e.status||500,{error:e.name==='TimeoutError'?'模型响应超时，请重试':e.status?e.message:'操作失败，请检查设置或稍后重试'});else res.end();}});
const port=Number(process.env.PORT)||4173;server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Nong Planner: http://localhost:${port}\n首次在本机打开即可使用。配对密钥保存在 data/config.json。`));
