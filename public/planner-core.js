export function habitDue(h){
 const count=Number(h.intervalCount);if(!Number.isInteger(count)||count<1)return '';
 const base=[...(h.days||[])].sort().at(-1)||h.startedOn;if(!base)return '';
 const d=new Date(base+'T12:00:00Z');if(Number.isNaN(d.getTime()))return '';
 if(h.intervalUnit==='months'){const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+count);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));}
 else d.setUTCDate(d.getUTCDate()+count*(h.intervalUnit==='weeks'?7:1));
 return d.toISOString().slice(0,10);
}
export const dueHabits=(habits,date)=>habits.filter(h=>{const due=habitDue(h);return due&&due<=date&&!(h.days||[]).includes(date);});
export function aiHeaders(sessionId){return {'User-Agent':'NongPlanner/0.4.1','x-opencode-session':String(sessionId||'nong-default').replace(/[^a-zA-Z0-9_.:-]/g,'_').slice(0,128)};}
