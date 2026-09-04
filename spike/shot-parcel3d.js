/* 택배 컷신(3D)을 시각을 지정해 찍는다.
   WebGL 은 Page.captureScreenshot 에 안 잡힌다 — **같은 evaluate 안에서** 그린 뒤
   캔버스를 읽어야 한다(이 저장소에서 여러 번 겪은 것). */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const PORT=9451,W=390,H=844,OUT='c:/Users/sehyu/playground/copycat/spike/dist/shots/';
const CHROME=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',(process.env.LOCALAPPDATA||'')+'/Google/Chrome/Application/chrome.exe'].find(p=>p&&fs.existsSync(p));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
const dir=path.join(process.env.TEMP,'cdp-pc3d');try{fs.rmSync(dir,{recursive:true,force:true});}catch(e){}
const chrome=spawn(CHROME,['--headless=new','--hide-scrollbars','--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port='+PORT,'--user-data-dir='+dir,'about:blank'],{stdio:'ignore'});
let page;for(let i=0;i<80&&!page;i++){try{page=(await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t=>t.type==='page');}catch{}if(!page)await sleep(250);}
const ws=new WebSocket(page.webSocketDebuggerUrl);let id=0;const pend=new Map();const errs=[];
const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);return;}
 if(m.method==='Runtime.exceptionThrown')errs.push((m.params.exceptionDetails.exception?.description||'').slice(0,220));});
await new Promise(r=>ws.addEventListener('open',r));await send('Runtime.enable');
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true});if(r?.exceptionDetails)throw new Error((r.exceptionDetails.exception?.description||'').slice(0,400));return r?.result?.value;};
await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:2,mobile:true});
await send('Page.navigate',{url:'http://localhost:8123/index.html?3d=1'});
await sleep(15000);
await ev(`(()=>{const el=document.querySelector('#cctitle');if(el)el.remove();document.body.classList.remove('titleon');
 const st=document.createElement('style');st.textContent='#app{height:${H}px !important}';document.head.appendChild(st);
 const a=document.getElementById('app');if(a.classList.contains('tabbar'))a.dataset.col='stage';
 if(typeof colApply==='function')colApply();if(typeof fitWorld==='function')fitWorld();if(window.R3&&R3.fit)R3.fit();return 1})()`);
await sleep(2500);

console.log('  진단:', JSON.stringify(await ev(`(()=>({
  desks: (window.W && window.W.desks || []).length,
  cats: (S.cats||[]).length,
  look: R3.getCatLook && R3.getCatLook(),
  ready: R3.ready, api: typeof R3.parcelBuild,
  dbg: (R3.debug && R3.debug().cats || []).map(c=>c.look).slice(0,3),
}))()`)));
/* 의자가 같이 물리는지 · 드로우콜이 얼마나 늘었는지 */
console.log('  전:', JSON.stringify(await ev(`(()=>{ const p=R3.perf?R3.perf():{}; 
  return { calls:p.calls, tris:p.tris }; })()`)));
const info = await ev(`(()=>{ const r = R3.parcelBuild(S.cats); return r; })()`);
console.log('  세웠다:', JSON.stringify(info));
if (!info){ console.log('  실패: 컷신을 못 세웠다'); ws.close(); chrome.kill(); process.exit(1); }
console.log('  좌표:', JSON.stringify(await ev(`(()=>{
  const d = R3.debug();
  const cam = R3.parcelSeek(2.2, 0.03);
  return { cam: cam.pos.map(v=>+v.toFixed(2)), look: cam.look.map(v=>+v.toFixed(2)),
           cats: d.cats.map(c=>({ pos:c.pos.map(v=>+v.toFixed(2)), yaw:+c.yaw.toFixed(2), pose:c.pose })) };
})()`)));
const TS=[1.5,2.9];
for (const t of TS){
  const url = await ev(`(()=>{ R3.parcelSeek(${t}, 0.03); R3.draw();
    const c = document.querySelector('#viewport canvas') || document.querySelector('canvas');
    return c ? c.toDataURL('image/png') : null; })()`);
  if (!url){ console.log('  캔버스를 못 읽었다'); break; }
  fs.writeFileSync(OUT+'p3-'+String(t).replace('.','_')+'.png', Buffer.from(url.split(',')[1],'base64'));
  console.log('  '+t+'s');
}
console.log('  후:', JSON.stringify(await ev(`(()=>{ const p=R3.perf?R3.perf():{};
  return { calls:p.calls, tris:p.tris }; })()`)));
await ev(`R3.parcelStop()`);
console.log('  오류:',errs.slice(0,2).join(' | ')||'0');
ws.close();chrome.kill();process.exit(0);
})().catch(e=>{console.error('실패:',e.message);process.exit(1);});
