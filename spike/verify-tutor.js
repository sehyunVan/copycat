/* 첫 출근 안내가 다섯 걸음으로 끝까지 가는지. CD·달력·게시판·배치를 뺐으니
   그 걸음들이 기다리던 이벤트도 없어야 하고, 마지막에 tutor:done 이 떠야 한다. */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const PORT=9441,W=390,H=844;
const CHROME=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',(process.env.LOCALAPPDATA||'')+'/Google/Chrome/Application/chrome.exe'].find(p=>p&&fs.existsSync(p));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rows=[];const ok=(n,p,note)=>rows.push({name:n,pass:!!p,note});
(async()=>{
const dir=path.join(process.env.TEMP,'cdp-tut');try{fs.rmSync(dir,{recursive:true,force:true});}catch(e){}
const chrome=spawn(CHROME,['--headless=new','--hide-scrollbars','--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port='+PORT,'--user-data-dir='+dir,'about:blank'],{stdio:'ignore'});
let page;for(let i=0;i<80&&!page;i++){try{page=(await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t=>t.type==='page');}catch{}if(!page)await sleep(250);}
const ws=new WebSocket(page.webSocketDebuggerUrl);let id=0;const pend=new Map();const errs=[];
const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);return;}
 if(m.method==='Runtime.exceptionThrown')errs.push((m.params.exceptionDetails.exception?.description||'').slice(0,180));});
await new Promise(r=>ws.addEventListener('open',r));await send('Runtime.enable');
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});if(r?.exceptionDetails)throw new Error((r.exceptionDetails.exception?.description||'').slice(0,300));return r?.result?.value;};
await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:2,mobile:true});
await send('Page.navigate',{url:'http://localhost:8123/index.html?3d=1'});
await sleep(14000);
await ev(`(()=>{const el=document.querySelector('#cctitle');if(el)el.remove();document.body.classList.remove('titleon');return 1})()`);
await sleep(1500);

const steps=await ev(`(()=>({ n: TUTOR_STEPS.length, ids: TUTOR_STEPS.map(s=>s.id),
  waits: TUTOR_STEPS.map(s=>s.on).filter(Boolean) }))()`);
ok('걸음이 다섯이다', steps.n===5, steps.ids.join(','));
ok('CD·달력·게시판·배치가 없다',
   !['juke','cal','board','edit'].some(k=>steps.ids.includes(k)), steps.ids.join(','));
ok('그 걸음들이 기다리던 이벤트도 없다',
   !steps.waits.some(w=>['juke:open','cal:open','board:open','edit:on'].includes(w)), steps.waits.join(','));
const dead=await ev(`(()=>({ cell: typeof tutCell, spot: typeof tutSpot }))()`);
ok('죽은 클로즈업 장치가 없다', dead.cell==='undefined'&&dead.spot==='undefined',
   `tutCell ${dead.cell} · tutSpot ${dead.spot}`);

/* 처음부터 끝까지 실제로 굴린다 — 각 걸음이 기다리는 이벤트를 그대로 쏜다 */
const run=await ev(`(async()=>{
  let done=false; bus.on('tutor:done', ()=>done=true);
  S.tutor=0; startTutor();
  const seen=[];
  for (let i=0;i<12 && tutorRunning();i++){
    const s=tutorSteps()[TUT.i]; seen.push(s.id);
    if (s.on) bus.emit(s.on, {}); else tutorNext();
    await new Promise(r=>setTimeout(r,420));
  }
  return { seen, done, running: tutorRunning() };
})()`);
ok('다섯 걸음을 다 지나 끝난다', run.done && !run.running, `${run.seen.join('→')} · done ${run.done}`);
ok('콘솔 오류 없음', errs.length===0, errs.slice(0,2).join(' | ')||'0');

ws.close();chrome.kill();
for(const r of rows)console.log(`  ${r.pass?'OK ':'X  '} ${r.name.padEnd(26)} ${r.note||''}`);
console.log(`\n  ${rows.filter(r=>r.pass).length}/${rows.length}`);
process.exit(0);
})().catch(e=>{console.error('실패:',e.message);process.exit(1);});
