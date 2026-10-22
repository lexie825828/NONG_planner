import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const testData=await mkdtemp(path.join(tmpdir(),'nong-ui-'));
const server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'24174',DATA_DIR:testData},stdio:'pipe'});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
try{
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:24174');await page.waitForFunction(()=>document.querySelector('#sync-status')?.textContent==='已同步至个人空间');
await page.getByRole('button',{name:'＋ 添加计划',exact:true}).click();await page.locator('#modal input[name=title]').fill('验收：完成 Nong Planner 第一版');await page.locator('#modal input[name=time]').fill('14:30');await page.locator('#modal').getByRole('button',{name:'保存',exact:true}).click();await page.getByText('验收：完成 Nong Planner 第一版',{exact:true}).waitFor();
await page.locator('[data-toggle]').first().click();assert.equal(await page.locator('.task.done').count(),1);
await page.reload();await page.waitForFunction(()=>document.querySelector('.task.done'));assert.equal(await page.locator('.task.done').count(),1);
await page.screenshot({path:'desktop-preview.png',fullPage:true});
for(const p of ['week','projects','life','review','coach','settings']){await page.locator(`nav [data-page="${p}"]`).click();await page.waitForTimeout(100);assert.equal(await page.locator('main h1').count(),1);}
await page.locator('nav [data-page="today"]').click();await page.setViewportSize({width:390,height:844});await page.screenshot({path:'mobile-preview.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
await page.setViewportSize({width:820,height:1180});await page.screenshot({path:'tablet-preview.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
await page.locator('[data-edit]').first().click();await page.evaluate(()=>window.confirm=()=>true);await page.locator('[data-delete-type=tasks]').click();await page.waitForTimeout(700);
assert.deepEqual(errors,[]);console.log('Desktop, mobile, tablet, task create/complete/reload/delete, navigation: PASS');await browser.close();
}finally{server.kill();}
