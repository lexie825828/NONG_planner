import {buildCoachMessages} from './coach-context.js';
import {migrateState,parseModelReply} from './chat-core.js';
import {calendar} from './calendar.js';
// Native requests stay on the packaged, trusted origin; credentials remain native.
if(window.NongAndroid){
 document.body.classList.add('native-android');
 const pending=new Map();
 window.__nongNativeResult=(id,status,body)=>{const p=pending.get(id);if(!p)return;clearTimeout(p.timer);pending.delete(id);try{const parsed=JSON.parse(body);if(Number.isInteger(parsed.nativeStatus)&&parsed.nativeStatus>=400&&parsed.nativeStatus<=599)status=parsed.nativeStatus;}catch{}p.resolve(new Response(body,{status,headers:{'Content-Type':'application/json'}}));};
 const request=(path,method='GET',data=null)=>new Promise((resolve,reject)=>{const id=crypto.randomUUID();const timer=setTimeout(()=>{pending.delete(id);reject(Error('连接超时，请检查网络或电脑服务地址'));},100000);pending.set(id,{resolve,reject,timer});window.NongAndroid.request(id,path,method,JSON.stringify(data));});
 const originalFetch=window.fetch.bind(window);
 window.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input.url,location.href);
  if(url.origin!==location.origin||(!url.pathname.startsWith('/api/')&&url.pathname!=='/calendar.ics'))return originalFetch(input,options);
  const data=options.body?JSON.parse(options.body):null;
  if(url.pathname==='/calendar.ics'){const response=await request('/api/state');if(!response.ok)return response;return new Response(calendar((await response.json()).state),{headers:{'Content-Type':'text/calendar'}});}
  if(url.pathname==='/api/coach'){
   let built;try{built=buildCoachMessages(data);}catch(e){return new Response(JSON.stringify({error:e.message}),{status:e.status||400});}
   const response=await request('/api/coach','POST',{...data,modelMessages:built.messages});if(!response.ok)return response;
   const result=await response.json();if(typeof result.rawContent!=='string')return new Response(JSON.stringify(result));
   const out=built.mode==='compress'?{summary:result.rawContent.slice(0,16000),compressedThroughId:built.session.messages.at(-1)?.id||''}:parseModelReply(result.rawContent,migrateState(data.state),()=>crypto.randomUUID());
   return new Response(JSON.stringify(out));
  }
  return request(url.pathname,options.method||'GET',data);
 };
}
