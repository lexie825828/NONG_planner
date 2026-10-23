export function habitDue(h){
 const count=Number(h.intervalCount);if(!Number.isInteger(count)||count<1)return '';
 const base=[...(h.days||[])].sort().at(-1)||h.startedOn;if(!base)return '';
 const d=new Date(base+'T12:00:00Z');if(Number.isNaN(d.getTime()))return '';
 if(h.intervalUnit==='months'){const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+count);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));}
 else d.setUTCDate(d.getUTCDate()+count*(h.intervalUnit==='weeks'?7:1));
 return d.toISOString().slice(0,10);
}
export const dueHabits=(habits,date)=>habits.filter(h=>{const due=habitDue(h);return due&&due<=date&&!(h.days||[]).includes(date);});
export function aiHeaders(sessionId){return {'User-Agent':'NongPlanner/0.6.0','x-opencode-session':String(sessionId||'nong-default').replace(/[^a-zA-Z0-9_.:-]/g,'_').slice(0,128)};}
export const addDays=(date,count)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+count);return d.toISOString().slice(0,10);};
export const weekStart=date=>addDays(date,-(new Date(date+'T12:00:00Z').getUTCDay()+6)%7);
export const PLAN_TYPES={short:'短期行动 · 周计划',medium:'中期目标 · 超过一周',long:'长期目标'};
export const planningTypeLabel=t=>PLAN_TYPES[t.planningType]||'待确认计划类型';
export const isLongPlan=t=>['medium','long'].includes(t.planningType);
export function taskParent(state,t){return t.parentTask?state.tasks.find(p=>p.id===t.parentTask&&isLongPlan(p)&&!p.canceled&&!p.deleted&&(p.project||'')===(t.project||'')):null;}
// A project link says nothing about the duration of an action. Never reinterpret dates.
export function migrateTask(t){return {...t,scheduleVersion:2,progressNotes:Array.isArray(t.progressNotes)?t.progressNotes:[]};}
export const unclassifiedTasks=state=>state.tasks.filter(t=>activeTask(t)&&!PLAN_TYPES[t.planningType]);
export const activeTask=t=>!t.done&&!t.canceled&&!t.deleted;
export function visibleHabits(habits,date){return habits.filter(h=>{const due=habitDue(h);return !due||due<=addDays(date,3);});}
export function pendingTasks(state,date){const start=weekStart(date);return state.tasks.filter(t=>activeTask(t)&&(t.schedule==='pool'||(t.date&&t.date<date)||(!t.date&&t.week&&t.week<start)));}
export function sortDayTasks(tasks){return tasks.slice().sort((a,b)=>Number(!!a.done)-Number(!!b.done)||(a.done?(a.completedAt||'').localeCompare(b.completedAt||''):(a.time||'99').localeCompare(b.time||'99')));}
export const defaultPreferences=date=>({id:'preferences',reviewEnabled:true,dailyTime:'09:00',weeklyTime:'20:30',weeklyDay:0,projectIdleDays:7,habitGapDays:3,quietFrom:'22:00',quietTo:'08:00',reviewStartDate:date,snoozedUntil:''});
export function preferences(state,date){return {...defaultPreferences(date),...(state.plannerSettings||[]).find(x=>x.id==='preferences')};}
export function savePreferences(state,patch,date){const next={...preferences(state,date),...patch,id:'preferences'};state.plannerSettings=[...(state.plannerSettings||[]).filter(x=>x.id!=='preferences'),next];return next;}
export function arrangeTask(task,choice,date,note='',idFactory=()=>crypto.randomUUID()){
 if(!activeTask(task))throw Error('该事项已完成或取消，请先恢复再安排');
 if(!['today','date','week','cancel'].includes(choice))throw Error('请选择有效安排方式');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('请选择有效日期');
 const previous={date:task.date||'',time:task.time||'',week:task.week||''};
 task.schedulingHistory=[...(task.schedulingHistory||[]),{...previous,choice,at:new Date().toISOString()}].slice(-100);
 if(choice==='cancel'){task.canceled=true;task.canceledAt=new Date().toISOString();}
 else if(choice==='week'){task.date='';task.time='';task.week=weekStart(date);task.schedule='week';}
 else {task.date=date;task.week='';task.schedule='dated';}
 if(note.trim())task.progressNotes=[...(task.progressNotes||[]),{id:idFactory(),date,text:note.trim().slice(0,4000)}];
 task.updatedAt=new Date().toISOString();return task;
}
export function reviewScheduleItems(state,date){const prefs=preferences(state,date),baseline=prefs.reviewStartDate||date,items=[];
 const lastActivity=t=>[t.updatedAt?.slice(0,10),t.createdAt?.slice(0,10),...(t.progressNotes||[]).map(n=>n.date)].filter(Boolean).sort().at(-1)||baseline;
 for(const t of state.tasks.filter(activeTask)){
  if(t.priority==='high')items.push({id:'important:'+t.id,title:t.title,category:'重要未完成',eligibleOn:t.date||date});
  if(t.due)items.push({id:'deadline:'+t.id,title:t.title,category:'截止日期已到',eligibleOn:t.due});
  if(['medium','long'].includes(t.planningType))items.push({id:'idle-task:'+t.id,title:t.title,category:'中长期任务停滞',eligibleOn:addDays(lastActivity(t),Number(prefs.projectIdleDays)||7)});
 }
 for(const p of state.projects){const linked=state.tasks.filter(t=>t.project===p.id&&!t.canceled&&!t.deleted);if(linked.length&&linked.every(t=>t.done))continue;const last=[p.updatedAt?.slice(0,10),p.createdAt?.slice(0,10),...linked.map(lastActivity)].filter(Boolean).sort().at(-1)||baseline;items.push({id:'project:'+p.id,title:p.title,category:'项目等待推进',eligibleOn:addDays(last,Number(prefs.projectIdleDays)||7)});}
 for(const h of state.habits){const due=habitDue(h),last=[...(h.days||[])].sort().at(-1)||h.startedOn||baseline;items.push({id:'habit:'+h.id,title:h.title,category:due?'循环习惯到期':'习惯中断',eligibleOn:due||addDays(last,Number(prefs.habitGapDays)||3)});}
 return items;
}
export const reviewCandidates=(state,date)=>reviewScheduleItems(state,date).filter(x=>x.eligibleOn<=date);
