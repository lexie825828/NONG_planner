import {parseModelReply} from './chat-core.js';
export function missingPlanCard(result){return !result.proposals.length&&/(?:保存.{0,8}计划本|写入.{0,8}计划本|下面.{0,8}(?:草稿|计划)|这条.{0,8}草稿|拟成.{0,12}习惯)/s.test(result.reply);}
export const repairInstruction='上一条回复提到了要保存的计划，却没有给出可执行卡片。请严格按系统中的 JSON 格式重新返回 reply、questions 和 proposals。只将用户明确提出、且上一条回复实际讨论的内容整理为待确认草稿；缺少日期等字段先询问，不编造。不要声称已保存，不重复创建现有记录。只输出完整 JSON，不使用 Markdown 代码围栏。';
export async function resolveCoachReply(raw,state,idFactory,repair){
 const original=parseModelReply(raw,state,idFactory);
 if(!missingPlanCard(original))return original;
 try{const repaired=parseModelReply(await repair(original.reply),state,idFactory);if(repaired.proposals.length)return {...repaired,formatRecovered:true};}catch{}
 return {...original,planCardMissing:true};
}
