/* 개봉 화면 · 하나 얻었을 때 · 여럿 얻었을 때 — 셋을 한 줄로 찍는다.
   애니메이션은 세워 놓고 찍는다(getAnimations): 실시간으로 찍으면 캡처 지연 때문에
   원하는 순간이 안 잡힌다. */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const PORT=9447,W=390,H=844,OUT='c:/Users/sehyu/playground/copycat/spike/dist/shots/';
const CHROME=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',(process.env.LOCALAPPDATA||'')+'/Google/Chrome/Application/chrome.exe'].find(p=>p&&fs.existsSync(p));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
const dir=path.join(process.env.TEMP,'cdp-parcel');try{fs.rmSync(dir,{recursive:true,force:true});}catch(e){}
const chrome=spawn(CHROME,['--headless=new','--hide-scrollbars','--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port='+PORT,'--user-data-dir='+dir,'about:blank'],{stdio:'ignore'});
let page;for(let i=0;i<80&&!page;i++){try{page=(await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t=>t.type==='page');}catch{}if(!page)await sleep(250);}
const ws=new WebSocket(page.webSocketDebuggerUrl);let id=0;const pend=new Map();const errs=[];
const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);return;}
 if(m.method==='Runtime.exceptionThrown')errs.push((m.params.exceptionDetails.exception?.description||'').slice(0,200));});
await new Promise(r=>ws.addEventListener('open',r));await send('Runtime.enable');
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true});if(r?.exceptionDetails)throw new Error((r.exceptionDetails.exception?.description||'').slice(0,400));return r?.result?.value;};
const shot=async n=>{const s=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(OUT+n,Buffer.from(s.data,'base64'));};
await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:2,mobile:true});
await send('Page.navigate',{url:'http://localhost:8123/index.html?3d=1'});
await sleep(15000);
await ev(`(()=>{const el=document.querySelector('#cctitle');if(el)el.remove();document.body.classList.remove('titleon');
 const st=document.createElement('style');st.textContent='#app{height:${H}px !important}';document.head.appendChild(st);
 const a=document.getElementById('app');if(a.classList.contains('tabbar'))a.dataset.col='stage';
 if(typeof colApply==='function')colApply();if(typeof fitWorld==='function')fitWorld();if(window.R3&&R3.fit)R3.fit();return 1})()`);
await sleep(2500);
const freeze = t => ev(`(()=>{let k=0;document.querySelectorAll('.gaopen,.gaopen *,.gawin,.gawin *').forEach(e=>
  e.getAnimations().forEach(a=>{a.pause();a.currentTime=${t};k++;}));return k;})()`);

/* 1. 뜯는 장면 (열 상자) */
await ev(`(()=>{const T=window.setTimeout;window.setTimeout=(f,ms)=>(ms>=1000?0:T(f,ms));
  gaOpening(new Array(10).fill({kind:'brick'}), ()=>{});window.setTimeout=T;return !!document.querySelector('.gaopen')})()`);
await sleep(400); console.log('  뜯는 장면 애니', await freeze(1200)); await sleep(250); await shot('pc-open.png');
await ev(`(()=>{const r=document.querySelector('.gaopen');if(r)r.remove();return 1})()`);

/* 2. 하나 얻었을 때 — 의자 하나 */
console.log('  하나:', await ev(`(()=>{const it=GACHA.pool().find(x=>!x.kind||x.kind==='furn');
  showGachaResult([it]);return it.n})()`));
await sleep(600); await freeze(900); await sleep(250); await shot('pc-one.png');
await ev(`(()=>{const r=document.querySelector('.gawin');if(r)r.remove();return 1})()`);

/* 3. 열 개 얻었을 때 — 갈래를 섞는다 */
console.log('  열개:', await ev(`(()=>{const p=GACHA.pool();
  const f=p.filter(x=>!x.kind||x.kind==='furn').slice(0,7);
  const rest=[p.find(x=>x.kind==='fish'),p.find(x=>x.kind==='brick'),p.filter(x=>!x.kind||x.kind==='furn')[9]];
  showGachaResult(f.concat(rest));return document.querySelectorAll('.rvcard').length})()`));
await sleep(600); await freeze(900); await sleep(250); await shot('pc-many.png');

console.log('  오류:',errs.slice(0,2).join(' | ')||'0');
ws.close();chrome.kill();process.exit(0);
})().catch(e=>{console.error('실패:',e.message);process.exit(1);});
