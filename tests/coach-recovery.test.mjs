import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,parseModelReply,applyProposal} from '../public/chat-core.js';
import {resolveCoachReply} from '../public/coach-response.js';
import {buildCoachMessages} from '../public/coach-context.js';
const card={reply:'这是可编辑草稿，确认后再保存。',proposals:[{kind:'habit',data:{title:'每周自我探索',cue:'每周六 20:30',intervalCount:1,intervalUnit:'weeks',startedOn:'2026-10-24'}}]};
test('extract a complete JSON payload from prose and fenced blocks, including quoted braces',()=>{
 const s=emptyState();const raw='先给你一份草稿：\n```json\n'+JSON.stringify({...card,reply:'标题中有 { 引号 " 和 } 字符'})+'\n```\n请确认。';
 const result=parseModelReply(raw,s,()=> 'p');assert.equal(result.proposals.length,1);assert.equal(result.reply,'标题中有 { 引号 " 和 } 字符');assert.equal(s.habits.length,0);
 assert.equal(parseModelReply('{"reply":"未完结","proposals":[',s,()=> 'p').proposals.length,0);
});
test('plain save offer triggers exactly one repair, produces editable card and never auto-saves',async()=>{
 const s=emptyState();let count=0;const result=await resolveCoachReply('每周六 20:30，从 10 月 24 日开始。这条是草稿，要保存到计划本吗？',s,()=> 'p',async()=>{count++;return JSON.stringify(card);});
 assert.equal(count,1);assert.equal(result.formatRecovered,true);assert.equal(result.proposals[0].data.intervalUnit,'weeks');assert.equal(s.habits.length,0);assert.throws(()=>applyProposal(s,result.proposals[0],result.proposals[0].data),/明确确认/);
 applyProposal(s,result.proposals[0],result.proposals[0].data,{confirmed:true});assert.equal(s.habits[0].cue,'每周六 20:30');
});
test('repair failure preserves original text and offers manual recovery, no recursive retries',async()=>{
 const s=emptyState();let calls=0;const raw='下面这条是草稿。要保存到计划本吗？';const result=await resolveCoachReply(raw,s,()=> 'p',async()=>{calls++;throw Error('temporary provider error');});assert.equal(result.reply,raw);assert.equal(result.planCardMissing,true);assert.equal(calls,1);assert.equal(s.tasks.length,0);
 const chat=await resolveCoachReply('今天辛苦了，先休息一下。',s,()=> 'p',async()=>{throw Error('Ordinary chat must not trigger extra calls');});assert.equal(chat.reply,'今天辛苦了，先休息一下。');
});
test('manual recovery uses selected old reply and its user message, never later conversation',()=>{
 const s=emptyState();s.sessions.push({id:'a',summary:'后来的摘要不应混入',messages:[{id:'u1',role:'user',text:'每周六晚上八点半做自我探索'},{id:'a1',role:'assistant',text:'每周六20:30，从2026-10-24开始，要保存到计划本吗？'},{id:'u2',role:'user',text:'后来改成健身，这是之后的内容'}]});
 const built=buildCoachMessages({state:s,sessionId:'a',mode:'plan',sourceMessageId:'a1'});const serialized=JSON.stringify(built.messages);assert.match(serialized,/每周六20:30/);assert.ok(!serialized.includes('后来改成健身'));assert.ok(!serialized.includes('后来的摘要不应混入'));assert.match(serialized,/proposals/);
 assert.throws(()=>buildCoachMessages({state:s,sessionId:'a',mode:'plan',sourceMessageId:'missing'}),/原回复/);
});
