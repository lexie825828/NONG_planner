import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardOrder,dailyQuote,calendarDays,DASHBOARD_CARDS} from '../public/overview.js';
import {emptyState,validateData,normalizeProposals,applyProposal,migrateState} from '../public/chat-core.js';
import {taskParent} from '../public/planner-core.js';
test('overview defaults to daily plan first and retains only valid unique cards in saved order',()=>{
 const s=emptyState();assert.equal(dashboardOrder(s)[0],'plans');s.plannerSettings=[{id:'preferences',reviewEnabled:false},{id:'dashboard',order:['habits','plans','plans','bad','__proto__']}];assert.deepEqual(dashboardOrder(s),['habits','plans',...Object.keys(DASHBOARD_CARDS).filter(k=>!['habits','plans'].includes(k))]);assert.equal(s.plannerSettings[0].reviewEnabled,false);assert.deepEqual(migrateState(s).plannerSettings,s.plannerSettings);
});
test('daily quote is stable within a Shanghai date and changes every day including year boundary',()=>{
 assert.equal(dailyQuote('2026-10-23'),dailyQuote('2026-10-23'));let previous='';for(let i=0;i<366;i++){const date=new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10),quote=dailyQuote(date);assert.ok(quote);assert.notEqual(quote,previous);previous=quote;}
});
test('monthly calendar aligns to Monday and includes leap day and adjacent month dates',()=>{
 const days=calendarDays('2028-02');assert.equal(days.length,42);assert.equal(new Date(days[0]+'T12:00:00Z').getUTCDay(),1);assert.ok(days.includes('2028-02-29'));assert.ok(days.includes('2028-03-01'));assert.equal(new Set(days).size,42);
});
test('short action attaches to an explicit middle target without altering its week date or project DDL',()=>{
 const s=emptyState();s.projects=[{id:'wine',title:'红酒学习',planningType:'medium',due:'2026-10-31'}];s.tasks=[{id:'course',title:'课程目标',planningType:'medium',project:'wine',due:'2026-10-31'}];const [p]=normalizeProposals([{kind:'task',data:{title:'学习一课时',planningType:'short',date:'2026-10-23',project:'wine',parentTask:'course'}}],s,()=> 'lesson');const t=applyProposal(s,p,p.data,{confirmed:true});assert.equal(taskParent(s,t).id,'course');assert.equal(t.date,'2026-10-23');assert.equal(s.projects[0].due,'2026-10-31');assert.equal(s.tasks[0].due,'2026-10-31');
 assert.throws(()=>validateData('task',{...t,project:''},s),/同一项目/);assert.throws(()=>validateData('task',{...t,parentTask:'missing'},s),/有效/);assert.throws(()=>validateData('task',{...s.tasks[0],planningType:'short',due:'',date:'2026-10-23'},s),/先调整/);
 s.tasks[0].canceled=true;assert.equal(taskParent(s,t),undefined);assert.equal(t.date,'2026-10-23');
});
