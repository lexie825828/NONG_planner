import {execFileSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
export const serial=process.env.NONG_EMULATOR_SERIAL||'emulator-5554';
if(!/^emulator-\d+$/.test(serial))throw Error('Tests are restricted to an emulator; physical phones are not touched.');
const adbPath=path.resolve('.android-tools/sdk/platform-tools/adb.exe');
export const out=path.resolve('output/android/emulator-test');mkdirSync(out,{recursive:true});
export function adb(args,{binary=false,timeout=30000}={}){return execFileSync(adbPath,['-s',serial,...args],{encoding:binary?null:'utf8',timeout,maxBuffer:20*1024*1024,windowsHide:true});}
const quote=s=>"'"+String(s).replace(/'/g,"'\\''")+"'";
export const shell=(...args)=>adb(['shell',args.map(quote).join(' ')]);
export const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function screenshot(name){const target=path.join(out,name+'.png');writeFileSync(target,adb(['exec-out','screencap','-p'],{binary:true}));return target;}
export function launch(){shell('am','force-stop','com.nongplanner.app');return shell('am','start','-W','-n','com.nongplanner.app/.MainActivity');}
const decode=s=>s.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
export function hierarchy(name='current-ui'){
 shell('uiautomator','dump','/sdcard/nong-ui.xml');const xml=adb(['exec-out','cat','/sdcard/nong-ui.xml']);writeFileSync(path.join(out,name+'.xml'),xml);
 return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(m=>Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a=>[a[1],decode(a[2])])));
}
export function tapNode(node){if(!node)throw Error('UI node not found');const values=node.bounds?.match(/\d+/g)?.map(Number);if(!values||values.length!==4)throw Error('UI node has no bounds');shell('input','tap',String(Math.round((values[0]+values[2])/2)),String(Math.round((values[1]+values[3])/2)));}
export function tapText(text,nodes=hierarchy()){const matches=nodes.filter(n=>n.text===text||n['content-desc']===text);tapNode(matches.find(n=>n.clickable==='true')||matches[0]);}
if(process.argv[1]?.endsWith('emulator-control.mjs')){console.log(JSON.stringify({device:serial,android:shell('getprop','ro.build.version.release').trim(),sdk:shell('getprop','ro.build.version.sdk').trim(),webview:shell('dumpsys','webviewupdate')},null,2));console.log(hierarchy().filter(n=>n.text||n['content-desc']).map(n=>({text:n.text,description:n['content-desc'],class:n.class,bounds:n.bounds})));screenshot('current-screen');}
