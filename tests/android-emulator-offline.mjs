import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {connectWebView} from './emulator-cdp.mjs';
import {shell,pause,screenshot,out,launch} from './emulator-control.mjs';
let client;const result={};
try{
 client=await connectWebView();
 if(await client.evaluate("!!document.querySelector('[data-chat-action=remove-image]')"))await client.click('[data-chat-action=remove-image]');
 shell('cmd','connectivity','airplane-mode','enable');shell('svc','wifi','disable');shell('svc','data','disable');
 await client.wait('navigator.onLine===false');result.offlineDetected=true;
 await client.click('nav [data-page=today]');await client.click('[data-action=add-task]');await client.fill('#modal input[name=title]','Offline emulator plan');await client.click('#modal .primary');
 await client.wait("document.body.innerText.includes('Offline emulator plan')");
 for(let i=0;i<30;i++){const s=JSON.parse(shell('run-as','com.nongplanner.app','cat','files/planner.json')).state;if(s.tasks.some(t=>t.title==='Offline emulator plan')){result.savedNativelyWithoutNetwork=true;break;}await pause(100);}
 assert.ok(result.savedNativelyWithoutNetwork);client.close();launch();await pause(500);client=await connectWebView();await client.wait("document.body.innerText.includes('Offline emulator plan')");result.offlineColdReopenRetainedTask=true;screenshot('09-offline-reopen');
 shell('settings','put','system','accelerometer_rotation','0');shell('settings','put','system','user_rotation','1');await client.wait('innerWidth>innerHeight');
 assert.equal(await client.evaluate('document.documentElement.scrollWidth>innerWidth'),false);result.landscapeNoHorizontalOverflow=true;screenshot('10-landscape');
 result.status='passed';
}catch(e){result.status='failed';result.error=e.stack;throw e;}
finally{
 shell('settings','put','system','user_rotation','0');shell('cmd','connectivity','airplane-mode','disable');shell('svc','wifi','enable');shell('svc','data','enable');
 client?.close();writeFileSync(path.join(out,'offline-rotation-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
