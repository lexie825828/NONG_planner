import {adb,shell,pause} from './emulator-control.mjs';
export async function connectWebView(){
 const pid=shell('pidof','com.nongplanner.app').trim().split(/\s+/)[0];
 if(!pid)throw Error('Nong Planner is not running in the emulator');
 adb(['forward','tcp:9223','localabstract:webview_devtools_remote_'+pid]);
 let targets;
 for(let n=0;n<30;n++){try{targets=await(await fetch('http://127.0.0.1:9223/json')).json();if(targets.some(t=>t.webSocketDebuggerUrl))break;}catch{}await pause(300);}
 const target=targets?.find(t=>t.url.startsWith('https://appassets.androidplatform.net/')&&t.webSocketDebuggerUrl)||targets?.find(t=>t.webSocketDebuggerUrl);
 if(!target)throw Error('No debuggable WebView target. Install the emulator-test APK.');
 const ws=new WebSocket(target.webSocketDebuggerUrl.replace('localhost:9223','127.0.0.1:9223'));
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 let counter=0;const pending=new Map();
 ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const p=pending.get(message.id);if(!p)return;pending.delete(message.id);clearTimeout(p.timer);if(message.error)p.reject(Error(JSON.stringify(message.error)));else p.resolve(message.result);}});
 function command(method,params={}){return new Promise((resolve,reject)=>{const id=++counter;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP command timed out: '+method));},30000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}
 async function evaluate(expression){const result=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.text+' '+(result.exceptionDetails.exception?.description||''));return result.result?.value;}
 async function wait(expression,timeout=20000){const start=Date.now();let last;while(Date.now()-start<timeout){try{last=await evaluate(expression);if(last)return last;}catch{}await pause(200);}throw Error('WebView condition timed out: '+expression+'; last='+String(last));}
 async function click(selector){return evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing element '+${JSON.stringify(selector)});e.scrollIntoView({block:'center'});e.click();return true;})()`);}
 async function fill(selector,value){return evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);}
 await command('Runtime.enable');
 return {evaluate,wait,click,fill,command,close:()=>ws.close(),target};
}
if(process.argv[1]?.endsWith('emulator-cdp.mjs')){const client=await connectWebView();console.log(await client.evaluate('JSON.stringify({url:location.href,title:document.title,body:document.body.innerText,androidBridge:typeof window.NongAndroid,viewport:[innerWidth,innerHeight]})'));client.close();}
