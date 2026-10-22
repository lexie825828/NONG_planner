export const day = (d = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
export {emptyState,validState} from './public/chat-core.js';
export {calendar} from './public/calendar.js';
