import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,migrateState,validateData,normalizeProposals,applyProposal} from '../public/chat-core.js';
import {visibleHabits,pendingTasks,arrangeTask,weekStart,reviewScheduleItems,reviewCandidates,savePreferences,sortDayTasks,unclassifiedTasks} from '../public/planner-core.js';
test('today habits show daily and due within three days including overdue, hide a freshly reset cycle',()=>{
 const h=[{id:'daily'},{id:'soon',intervalCount:10,intervalUnit:'days',startedOn:'2026-10-15'},{id:'far',intervalCount:2,intervalUnit:'months',startedOn:'2026-10-01'},{id:'late',intervalCount:3,intervalUnit:'days',startedOn:'2026-10-01'}];
 assert.deepEqual(visibleHabits(h,'2026-10-22').map(h=>h.id),['daily','soon','late']);h[1].days=['2026-10-22'];assert.deepEqual(visibleHabits(h,'2026-10-22').map(h=>h.id),['daily','late']);
});
test('legacy project actions keep their schedule; migration does not infer horizon and retains week todo IDs',()=>{
 const s=emptyState();s.tasks.push({id:'project',project:'p',date:'2026-11-05',title:'论文'},{id:'appointment',project:'p',date:'2026-10-22',time:'16:00',title:'讨论'});s.weekTodos.push({id:'w',week:'2026-10-19',title:'本周阅读'});
 const n=migrateState(s);assert.equal(n.tasks[0].due,undefined);assert.equal(n.tasks[0].date,'2026-11-05');assert.equal(n.tasks[0].planningType,undefined);assert.equal(n.tasks[1].date,'2026-10-22');assert.ok(n.tasks.some(t=>t.id==='w'&&t.week==='2026-10-19'));assert.deepEqual(migrateState(n),n);assert.equal(s.tasks[0].date,'2026-11-05');
});
test('rollover pool ignores DDL-only, canceled and completed items; last week undated tasks return on Monday',()=>{
 const s=emptyState();s.tasks=[{id:'overdue',date:'2026-10-21'},{id:'ddl',due:'2026-10-21'},{id:'done',date:'2026-10-21',done:true},{id:'cancel',date:'2026-10-21',canceled:true},{id:'week',week:'2026-10-19'}];assert.deepEqual(pendingTasks(s,'2026-10-22').map(t=>t.id),['overdue']);assert.deepEqual(pendingTasks(s,'2026-10-26').map(t=>t.id),['overdue','week']);assert.equal(weekStart('2026-10-25'),'2026-10-19');
});
test('reschedule keeps identity, DDL, progress notes and history; weekly and cancel do not delete records',()=>{
 const t={id:'a',title:'论文',date:'2026-10-21',time:'16:00',due:'2026-10-23',progressNotes:[{id:'old',date:'2026-10-20',text:'完成一半'}]};arrangeTask(t,'today','2026-10-22','等待反馈',()=> 'note');assert.equal(t.id,'a');assert.equal(t.date,'2026-10-22');assert.equal(t.due,'2026-10-23');assert.equal(t.progressNotes.length,2);assert.equal(t.schedulingHistory[0].date,'2026-10-21');arrangeTask(t,'week','2026-10-22');assert.equal(t.date,'');assert.equal(t.time,'');assert.equal(t.week,'2026-10-19');arrangeTask(t,'cancel','2026-10-22');assert.equal(t.canceled,true);assert.equal(t.due,'2026-10-23');assert.equal(t.progressNotes[0].text,'完成一半');
});
test('date, DDL and undated week are separately validated and AI still requires explicit confirmation',()=>{
 const s=emptyState();assert.doesNotThrow(()=>validateData('task',{title:'论文DDL',due:'2026-11-05'},s));assert.doesNotThrow(()=>validateData('task',{title:'本周阅读',week:'2026-10-19'},s));assert.throws(()=>validateData('task',{title:'无日期无DDL'},s),/补充/);assert.throws(()=>validateData('task',{title:'只有时间',due:'2026-11-05',time:'09:00'},s),/日程日期/);
 const [p]=normalizeProposals([{kind:'task',data:{title:'项目拆解',due:'2026-11-05',date:''}}],s,()=> 'draft');assert.throws(()=>applyProposal(s,p,p.data),/明确确认/);applyProposal(s,p,p.data,{confirmed:true});assert.equal(s.tasks[0].due,'2026-11-05');assert.equal(s.tasks[0].date,'');
});
test('completed day items sort to the end and undo restores the original schedule order',()=>{
 const a={id:'a',time:'08:00'},b={id:'b',time:'09:00'},c={id:'c',done:true,completedAt:'2026-10-22T01:00:00Z'};assert.deepEqual(sortDayTasks([a,b,c]).map(t=>t.id),['a','b','c']);a.done=true;a.completedAt='2026-10-22T02:00:00Z';assert.deepEqual(sortDayTasks([a,b,c]).map(t=>t.id),['b','c','a']);a.done=false;assert.deepEqual(sortDayTasks([a,b,c]).map(t=>t.id),['a','b','c']);
});
test('review rules include important work, stalled projects and broken habits; recent progress resets idle clock',()=>{
 const s=emptyState();savePreferences(s,{reviewStartDate:'2026-10-01'},'2026-10-22');s.tasks=[{id:'high',title:'重要工作',priority:'high',date:'2026-10-21'},{id:'long',title:'长期任务',planningType:'long',project:'p',due:'2026-11-30',updatedAt:'2026-10-01T00:00:00Z'},{id:'done',title:'已完成',done:true,priority:'high'}];s.projects=[{id:'p',title:'论文',createdAt:'2026-10-01'}];s.habits=[{id:'h',title:'阅读',days:['2026-10-18']}];const items=reviewCandidates(s,'2026-10-22');assert.ok(items.some(i=>i.category==='重要未完成'));assert.ok(items.some(i=>i.id==='idle-task:long'));assert.ok(items.some(i=>i.id==='habit:h'));assert.ok(!items.some(i=>i.title==='已完成'));s.tasks[1].progressNotes=[{id:'n',date:'2026-10-22',text:'推进了一节'}];assert.ok(!reviewCandidates(s,'2026-10-22').some(i=>i.id==='idle-task:long'));assert.equal(reviewScheduleItems(s,'2026-10-22').find(i=>i.id==='idle-task:long').eligibleOn,'2026-10-29');
});

test('wine project DDL and short actions are independent; linked short actions remain scheduled',()=>{
 const s=emptyState();s.projects=[{id:'wine',title:'红酒学习',planningType:'medium',due:'2026-10-31'}];
 const [p]=normalizeProposals([{kind:'task',data:{title:'学习一课时',planningType:'short',project:'wine',date:'2026-10-22',due:'',duration:60}}],s,()=> 'wine-action');
 const action=applyProposal(s,p,p.data,{confirmed:true});assert.equal(action.project,'wine');assert.equal(action.date,'2026-10-22');assert.equal(s.projects[0].due,'2026-10-31');
 arrangeTask(action,'week','2026-10-22');assert.equal(action.week,'2026-10-19');assert.equal(action.planningType,'short');assert.equal(s.projects[0].due,'2026-10-31');
 assert.throws(()=>validateData('task',{title:'学习一课时',planningType:'short',due:'2026-10-31'},s),/执行日期/);
 assert.throws(()=>validateData('task',{title:'红酒目标',planningType:'medium',date:'2026-10-22',due:'2026-10-31'},s),/另拆短期/);
 assert.doesNotThrow(()=>validateData('task',{title:'红酒目标',planningType:'medium',due:'2026-10-31'},s));
 assert.throws(()=>validateData('task',{title:'目标',planningType:'long'},s),/截止日期/);
 assert.throws(()=>validateData('task',{title:'目标',planningType:'guess',due:'2026-10-31'},s),/请选择/);
});
test('previous converted records await explicit classification without losing original date or notes',()=>{
 const s=emptyState();s.tasks=[{id:'legacy',project:'wine',date:'',due:'2026-10-22',legacyScheduledDate:'2026-10-22',scheduleVersion:2,progressNotes:[{id:'n',text:'完成一半'}]},{id:'short',project:'wine',planningType:'short',date:'2026-10-22'},{id:'finished',done:true}];
 const n=migrateState(s);assert.deepEqual(unclassifiedTasks(n).map(t=>t.id),['legacy']);assert.equal(n.tasks[0].legacyScheduledDate,'2026-10-22');assert.equal(n.tasks[0].progressNotes[0].text,'完成一半');assert.deepEqual(migrateState(n),n);
});
test('a linked short action is not classified as a stalled medium or long task',()=>{
 const s=emptyState();s.projects=[{id:'wine',title:'红酒学习'}];s.tasks=[{id:'lesson',title:'学习一课时',planningType:'short',project:'wine',date:'2026-10-22',updatedAt:'2026-10-01'}];
 assert.ok(!reviewScheduleItems(s,'2026-10-22').some(x=>x.id==='idle-task:lesson'));
});
