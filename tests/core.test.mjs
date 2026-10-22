import test from 'node:test';
import assert from 'node:assert/strict';
import {calendar,emptyState,validState,day} from '../lib.mjs';
test('state schema rejects missing collections and malformed records',()=>{assert.equal(validState(emptyState()),true);assert.equal(validState({tasks:[]}),false);assert.equal(validState({...emptyState(),tasks:[null]}),false);});
test('Shanghai day is independent from host time zone',()=>{assert.equal(day(new Date('2026-10-20T17:00:00Z')),'2026-10-21');});
test('calendar preserves stable UID, timezone and reminders; escapes injected properties',()=>{const s=emptyState();s.tasks.push({id:'a',title:'会议,周计划\nEND:VEVENT',date:'2026-10-21',time:'09:30',duration:60});const ics=calendar(s);assert.match(ics,/UID:a@nongplanner/);assert.match(ics,/DTSTART:20261021T013000Z/);assert.match(ics,/DTEND:20261021T023000Z/);assert.match(ics,/SUMMARY:会议\\,周计划\\nEND:VEVENT/);assert.match(ics,/TRIGGER:-PT15M/);assert.equal(ics.match(/\r\nEND:VEVENT/g).length,1);});
test('all-day event ends on next calendar day and long unicode lines fold by bytes',()=>{const s=emptyState();s.tasks.push({id:'b',title:'生活记录'.repeat(60),date:'2026-12-31'});const ics=calendar(s);assert.match(ics,/DTEND;VALUE=DATE:20270101/);for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);});
