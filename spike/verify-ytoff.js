/* 「노동요」(유튜브)는 **앱에서는 안 내놓는다.**

   왜: 유튜브 API 약관이 **영상이 안 보이는 오디오 재생**과 **200×200 보다 작은
   플레이어**를 금지하는데, 이 기능은 정확히 그 둘을 한다(1px 로 숨기고 소리만).
   웹에서는 그래도 되지만 스토어에 올린 앱이 남의 약관을 어기면 애플이 반려하고
   유튜브가 접근을 끊는다 — 끊기면 이미 받은 사람 화면에서 죽는다.

   배포 파일은 한 벌이라(dist/android 를 PWA 와 앱 껍데기가 같이 쓴다) 빌드로는
   못 가른다. 그래서 **실행하는 자리**에서 가르고, 그게 맞는지 여기서 본다.

     node spike/serve.js      (다른 창에서)
     node spike/verify-ytoff.js
*/
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const CHROME=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',(process.env.LOCALAPPDATA||'')+'/Google/Chrome/Application/chrome.exe'].find(p=>p&&fs.existsSync(p));
const BASE=process.env.COPYCAT_BASE||'http://localhost:8123';
const PORT=9500+(process.pid%80), sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rows=[];const ok=(n,p,note)=>rows.push({name:n,pass:!!p,note});
(async()=>{
try{const r=await fetch(BASE+'/index.html');if(!r.ok)throw 0;}catch(e){console.log(`\n  ${BASE} 가 안 열린다 — node spike/serve.js 먼저.`);process.exit(2);}
const dir=path.join(process.env.TEMP,'cdp-vytoff');try{fs.rmSync(dir,{recursive:true,force:true});}catch(e){}
const chrome=spawn(CHROME,['--headless=new','--hide-scrollbars','--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port='+PORT,'--user-data-dir='+dir,'about:blank'],{stdio:'ignore'});
let page;for(let i=0;i<160&&!page;i++){try{page=(await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t=>t.type==='page');}catch{}if(!page)await sleep(250);}
if(!page){chrome.kill();throw new Error('크롬이 안 떴다');}
const ws=new WebSocket(page.webSocketDebuggerUrl);let id=0;const pend=new Map();const errs=[];
const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);
 if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);return;}
 if(m.method==='Runtime.exceptionThrown')errs.push((m.params.exceptionDetails.exception?.description||'').slice(0,150));});
await new Promise(r=>ws.addEventListener('open',r));await send('Runtime.enable');
/* Page 를 켜야 addScriptToEvaluateOnNewDocument 가 먹는다 — 안 켜면 조용히 무시된다. */
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});

/* ── 웹: 그대로 있다 ─────────────────────────────────────────────── */
await send('Page.navigate',{url:BASE+'/index.html?3d=1'});
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});
 if(r?.exceptionDetails)throw new Error((r.exceptionDetails.exception?.description||'').slice(0,300));return r?.result?.value;};
let up=false;
for(let i=0;i<70&&!up;i++){await sleep(700);
  up=await ev(`(()=>{const t=document.querySelector('#cctitle');if(t)t.remove();
    document.body.classList.remove('titleon');
    return typeof music!=='undefined' && !!window.showJuke})()`).catch(()=>false);}
const web=await ev(`(()=>{
  document.querySelectorAll('.veil').forEach(x=>x.remove());
  showJuke();
  const v=[...document.querySelectorAll('.veil')].pop();
  const r={ allowed: music.ytAllowed(),
            inList: music.tracks().some(t=>t.yt),
            input: !!(v&&v.querySelector('#ytUrl')),
            go: !!(v&&v.querySelector('#ytGo')) };
  document.querySelectorAll('.veil').forEach(x=>x.remove());
  return r })()`);
ok('웹에서는 노동요가 있다', web.allowed===true && web.inList && web.input && web.go,
   `허용 ${web.allowed} · 목록 ${web.inList} · 입력칸 ${web.input}`);

/* ── 앱: 아예 없다 ───────────────────────────────────────────────
   `Capacitor` 를 **페이지가 뜨기 전에** 심는다 — music.js 가 파일을 읽는 순간
   한 번만 판정하기 때문이다(그게 맞는 설계다: 중간에 바뀔 값이 아니다). */
await send('Page.addScriptToEvaluateOnNewDocument',{source:
  `window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: {} };`});
await send('Page.navigate',{url:BASE+'/index.html?3d=1'});
up=false;
for(let i=0;i<70&&!up;i++){await sleep(700);
  up=await ev(`(()=>{const t=document.querySelector('#cctitle');if(t)t.remove();
    document.body.classList.remove('titleon');
    return typeof music!=='undefined' && !!window.showJuke})()`).catch(()=>false);}
const app=await ev(`(()=>{
  document.querySelectorAll('.veil').forEach(x=>x.remove());
  showJuke();
  const v=[...document.querySelectorAll('.veil')].pop();
  const r={ native: !!(window.Capacitor&&Capacitor.isNativePlatform()),
            allowed: music.ytAllowed(),
            inList: music.tracks().some(t=>t.yt),
            input: !!(v&&v.querySelector('#ytUrl')),
            go: !!(v&&v.querySelector('#ytGo')),
            body: v ? v.textContent : '' };
  document.querySelectorAll('.veil').forEach(x=>x.remove());
  return r })()`);
ok('앱으로 인식한다', app.native===true, String(app.native));
ok('**앱에서는 목록에 없다**', app.inList===false, '목록에 yt ' + app.inList);
ok('**입력칸이 아예 안 그려진다**', !app.input && !app.go, `입력칸 ${app.input} · 단추 ${app.go}`);
ok('「노동요」 글자도 안 남는다', !/노동요/.test(app.body||''), /노동요/.test(app.body||'') ? '남아 있다' : '없다');

/* 웹에서 틀어 두고 앱으로 옮긴 저장 — 되살아나면 안 된다 */
const carry=await ev(`(()=>{
  const m=S.music=S.music||{}; m.cur='yt'; m.yt='https://www.youtube.com/playlist?list=PLtest12345';
  return { now: music.now().id, has: music.has('yt') } })()`);
ok('**옛 저장으로도 안 되살아난다**', carry.now!=='yt' && carry.has===false,
   `지금 곡 ${carry.now} · has(yt) ${carry.has}`);

ok('콘솔 오류 0', errs.length===0, errs.join(' / ').slice(0,160));
const bad=rows.filter(r=>!r.pass).length;
console.log('');
rows.forEach(r=>console.log(` ${r.pass?'OK ':'X  '} ${r.name}${r.note?'   — '+r.note:''}`));
console.log('');
console.log(` ${rows.length-bad}/${rows.length} 통과`);
try{ws.close();}catch(e){}chrome.kill();process.exit(bad?1:0);
})();
