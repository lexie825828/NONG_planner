import {resolveCoachReply,repairInstruction} from './public/coach-response.js';
import {aiHeaders} from './public/planner-core.js';
import {randomUUID} from 'node:crypto';
import {migrateState} from './public/chat-core.js';
import {buildCoachMessages} from './public/coach-context.js';
export {buildCoachMessages} from './public/coach-context.js';
export async function runCoach(b,ai){
 const {messages,session,mode}=buildCoachMessages(b);
 async function call(modelMessages){const upstream=await fetch(ai.url.replace(/\/$/,'')+'/chat/completions',{method:'POST',redirect:'error',headers:{...aiHeaders(session.id||b.sessionId||'nong-default'),'Content-Type':'application/json',...(ai.key?{Authorization:'Bearer '+ai.key}:{})},body:JSON.stringify({model:ai.model,messages:modelMessages}),signal:AbortSignal.timeout(90000)});if(!upstream.ok)throw Object.assign(Error(`模型接口返回 ${upstream.status}，请检查地址、模型和额度；插图需使用支持图片理解的模型`),{status:502});const result=await upstream.json();const reply=result.choices?.[0]?.message?.content;if(typeof reply!=='string'||!reply.trim())throw Object.assign(Error('模型没有返回兼容的文本内容'),{status:502});return reply;}
 const reply=await call(messages);
 if(mode==='compress')return {summary:reply.slice(0,16000),compressedThroughId:session.messages.at(-1)?.id||''};
 return resolveCoachReply(reply,migrateState(b.state),randomUUID,plain=>call([...messages,{role:'assistant',content:JSON.stringify({reply:plain,questions:[],proposals:[]})},{role:'user',content:repairInstruction}]));
}
