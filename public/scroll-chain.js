// A drag consumes the remaining chat scroll first, then passes the remainder to the page.
export function installChatScrollChain(){
 let drag=null;
 function consume(el,delta){const old=el.scrollTop;el.scrollTop=Math.max(0,Math.min(el.scrollHeight-el.clientHeight,old+delta));const remainder=delta-(el.scrollTop-old);if(Math.abs(remainder)>.1)window.scrollBy(0,remainder);}
 document.addEventListener('touchstart',e=>{const el=e.target.closest('.messages');drag=el&&e.touches.length===1?{el,y:e.touches[0].clientY,moved:false}:null;},{passive:true});
 document.addEventListener('touchmove',e=>{if(!drag||e.touches.length!==1)return;const y=e.touches[0].clientY,delta=drag.y-y;if(!drag.moved&&Math.abs(delta)<5)return;drag.moved=true;drag.y=y;if(e.cancelable)e.preventDefault();consume(drag.el,delta);},{passive:false});
 document.addEventListener('touchend',()=>{drag=null;});document.addEventListener('touchcancel',()=>{drag=null;});
 document.addEventListener('wheel',e=>{const el=e.target.closest('.messages');if(!el||e.ctrlKey)return;const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?el.clientHeight:1);if((delta>0&&el.scrollTop+el.clientHeight>=el.scrollHeight-1)||(delta<0&&el.scrollTop<=1)){e.preventDefault();window.scrollBy(0,delta);}},{passive:false});
}
