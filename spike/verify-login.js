/* 로그인 문 — **두 갈래가 같은 층에 서는가.**

   왜 보는가: 구글만 첫 화면에 있고 메일은 설정 안쪽 입력칸에 있었다. 애플은 소셜
   로그인을 제공하면 **동등한 대안**을 요구하는데(심사지침 4.8), 한쪽은 첫 화면
   단추고 한쪽은 설정 속 입력칸이면 그건 동등해 보이지 않는다.

   진짜 구글 창은 여기서 못 연다(남의 사이트로 넘어간다). 그래서 **CLOUD 를 가짜로
   바꿔** 우리 쪽이 무엇을 부르는지, 실패를 어떻게 말하는지를 본다.

     node spike/serve.js      (다른 창에서)
     node spike/verify-login.js
*/
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const CHROME=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',(process.env.LOCALAPPDATA||'')+'/Google/Chrome/Application/chrome.exe'].find(p=>p&&fs.existsSync(p));
const BASE=process.env.COPYCAT_BASE||'http://localhost:8123';
const PORT=9300+(process.pid%90), W=390, H=844;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rows=[];const ok=(n,p,note)=>rows.push({name:n,pass:!!p,note});
(async()=>{
try{ const r=await fetch(BASE+'/index.html'); if(!r.ok) throw new Error('HTTP '+r.status); }
catch(e){ console.log(`\n  ${BASE} 가 안 열린다 — 다른 창에서 node spike/serve.js 먼저.`); process.exit(2); }

const dir=path.join(process.env.TEMP,'cdp-vlogin');try{fs.rmSync(dir,{recursive:true,force:true});}catch(e){}
const chrome=spawn(CHROME,['--headless=new','--hide-scrollbars','--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port='+PORT,'--user-data-dir='+dir,'about:blank'],{stdio:'ignore'});
let page;for(let i=0;i<160&&!page;i++){try{page=(await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t=>t.type==='page');}catch{}if(!page)await sleep(250);}
if(!page){chrome.kill();throw new Error(`크롬이 ${PORT} 에서 안 떴다`);}
const ws=new WebSocket(page.webSocketDebuggerUrl);let id=0;const pend=new Map();const errs=[];
const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);
 if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);return;}
 if(m.method==='Runtime.exceptionThrown')errs.push((m.params.exceptionDetails.exception?.description||'').slice(0,160));});
await new Promise(r=>ws.addEventListener('open',r));await send('Runtime.enable');
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});
 if(r?.exceptionDetails)throw new Error((r.exceptionDetails.exception?.description||'').slice(0,300));return r?.result?.value;};
await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:2,mobile:true});
await send('Page.navigate',{url:BASE+'/index.html?3d=1'});

/* 시작화면은 **안 지운다** — 여기서 보는 것이 그 화면이다. */
let up=null;
for(let i=0;i<60&&!up;i++){ await sleep(700);
  up=await ev(`(()=>{ const t=document.querySelector('#cctitle'); if(!t) return null;
    const b=t.querySelector('.login');
    return { has:!!b, hidden:!!(b&&b.hidden), label:b?b.textContent.trim():'' }; })()`).catch(()=>null);
  if(up && !up.has) up=null;
}
ok('시작 화면에 로그인 단추가 있다', up&&up.has, up?`「${up.label}」`:'못 찾았다');
ok('**구글이라고 안 쓴다** (수단이 둘이므로)', up && !/구글|google/i.test(up.label), up&&up.label);

/* 계정층을 가짜로 바꾼다 — 진짜로 구글에 넘어가면 이 검사가 남의 사이트에서 끝난다.
   **진짜가 먼저 선 뒤에** 바꿔치운다: cloud.js 는 title.js 보다 뒤에 실행되므로,
   시작 단추가 보이자마자 심으면 그 뒤에 진짜가 덮어쓴다(실제로 그랬다). */
for(let i=0;i<60;i++){ if(await ev(`!!window.CLOUD`).catch(()=>false)) break; await sleep(300); }
await ev(`(()=>{
  window.__calls=[];
  window.CLOUD = {
    state:()=>({on:true,why:'',uid:'u1',anon:true,who:''}),
    google:async()=>{ window.__calls.push(['google']); return { error:'시험판이라 안 넘어갑니다' }; },
    apple:async()=>{ window.__calls.push(['apple']); return { error:'시험판이라 안 넘어갑니다' }; },
    email:async a=>{ window.__calls.push(['email',a]); return /@/.test(a)?{ok:true}:{error:'메일 주소 형식이 아닙니다'}; },
    sb:()=>null, push:async()=>{}, restore:async()=>{}, out:()=>{}, erase:async()=>{},
  };
  const b=document.querySelector('#cctitle .login'); if(b){ b.hidden=false; b.disabled=false; }
  return 1 })()`);

await ev(`document.querySelector('#cctitle .login').click()`);
await sleep(900);
const win=await ev(`(()=>{ const v=document.querySelector('.veil'); if(!v) return null;
  return { google:!!v.querySelector('#lgGoogle'), mail:!!v.querySelector('#lgMail'),
           sendBtn:!!v.querySelector('#lgSend'),
           gLabel:(v.querySelector('#lgGoogle')||{}).textContent||'',
           head:(v.querySelector('.mhead h3')||{}).textContent||'',
           /* 시작화면(9999) 위에 떠야 한다 */
           z:getComputedStyle(v).zIndex }; })()`);
ok('누르면 창이 뜬다', !!win, win?win.head:'안 떴다');
ok('**두 갈래가 한 창에 같이 있다**', win&&win.google&&win.mail&&win.sendBtn,
   win?`구글 ${win.google} · 메일칸 ${win.mail}`:'-');
ok('시작 화면 위에 뜬다', win && (+win.z)>=10000, win?('z '+win.z):'-');

/* 배치와 생김새 — 눈으로만 보이던 것을 못 박는다. 다음에 누가 뒤집어도 여기서 걸린다. */
const look0 = await ev(`(()=>{ const v=document.querySelector('.veil');
  const g=v.querySelector('#lgGoogle'), m=v.querySelector('#lgMail');
  const gb=g.getBoundingClientRect(), mb=m.getBoundingClientRect();
  const cs=getComputedStyle(g);
  const rgb=(cs.backgroundColor.match(/[0-9]+/g)||[]).slice(0,3).map(Number);
  const lum= rgb.length===3 ? Math.round(rgb[0]*0.299+rgb[1]*0.587+rgb[2]*0.114) : -1;
  return { below: gb.top > mb.top, svg: !!g.querySelector('.gmark svg'),
           colors: [...g.querySelectorAll('.gmark svg path')].map(p=>p.getAttribute('fill')),
           inner: (g.querySelector('.gmark')||{}).innerHTML ? (g.querySelector('.gmark').innerHTML).slice(0,80) : '(없음)',
           bg: cs.backgroundColor, lum,
           markBg: getComputedStyle(g.querySelector('.gmark')).backgroundColor }; })()`);
ok('구글이 메일칸 **아래**에 있다', look0.below, look0.below?'그렇다':'위에 있다');
ok('구글 로고가 붙어 있다', look0.svg && look0.colors.length === 4,
   `svg ${look0.svg} · 색 ${look0.colors.length} [${look0.colors.join(' ')}] · 안쪽 ${look0.inner}`);
ok('로고는 흰 바탕 위에 (브랜드 규정)', /255, 255, 255/.test(look0.markBg), look0.markBg);
/* **재기는 재야 한다.** 밝기가 -1(못 읽음)이거나 0(계산이 깨짐)이면 통과가 아니라
   실패다 — 그러지 않으면 어떤 색이든 통과하는 검사가 된다. */
ok('단추 배경이 진하다 (유도)', look0.lum > 0 && look0.lum < 110,
   `${look0.bg} · 밝기 ${look0.lum}`);

/* 구글 — 실패하면 그 자리에서 이유를 말한다(창을 안 닫는다) */
await ev(`document.querySelector('#lgGoogle').click()`);
await sleep(600);
const g=await ev(`(()=>{ const v=document.querySelector('.veil');
  return { called:(window.__calls[0]||[])[0], open:!!v,
           note:(v&&v.querySelector('#lgNote')||{}).textContent||'',
           btn:(v&&v.querySelector('#lgGoogle')||{}).textContent||'' }; })()`);
ok('구글 갈래가 구글을 부른다', g.called==='google', String(g.called));
ok('실패해도 창이 안 닫힌다 · 이유를 적는다', g.open && /안 넘어갑니다/.test(g.note), g.note);
ok('다시 누를 수 있게 되돌린다', /다시/.test(g.btn), g.btn);
/* 눌렀다고 로고가 사라지면 안 된다 — 글자를 갈아 끼우면서 안에 든 것까지 지우기 쉽다. */
const stay = await ev(`!!document.querySelector('#lgGoogle .gmark svg')`);
ok('누른 뒤에도 로고가 남는다', stay, String(stay));

/* ── 애플 (심사지침 4.8) ──
   구글만 있고 메일은 입력칸이던 때가 **반려 사유였다.** 애플 로그인을 들인 뒤로는
   「둘이 같은 무게로 서 있는가」가 이 파일의 본론이다 — 크기가 갈리면 "equivalent
   option" 이 아니다. 그래서 눈으로 보지 말고 px 로 잰다. */
const look1 = await ev(`(()=>{ const v=document.querySelector('.veil');
  const g=v.querySelector('#lgGoogle'), a=v.querySelector('#lgApple');
  if(!a) return { missing:true };
  const gb=g.getBoundingClientRect(), ab=a.getBoundingClientRect();
  const svg=a.querySelector('.amark svg');
  return { below: ab.top > gb.top, sameW: Math.abs(ab.width-gb.width) < 1,
           sameH: Math.abs(ab.height-gb.height) < 1,
           w:Math.round(ab.width), h:Math.round(ab.height),
           svg: !!svg, keep: svg ? svg.getAttribute('data-dot') : '',
           fill: svg ? getComputedStyle(svg).fill : '' }; })()`);
ok('애플이 구글 **아래**에 있다', look1.below, look1.below?'그렇다':'아니다');
ok('애플 단추가 구글과 **같은 크기**다 (4.8 의 equivalent)', look1.sameW && look1.sameH,
   `${look1.w}×${look1.h}`);
ok('애플 로고가 붙어 있다', look1.svg, String(look1.svg));
/* 도트 변환에서 빼 두지 않으면 js/dot.js 가 로고를 다시 그린다 — 남의 상표를
   우리 마음대로 그린 것이 된다. 구글 마크와 같은 이유로 못 박는다. */
ok('로고를 도트로 안 바꾼다 (data-dot=keep)', look1.keep==='keep', String(look1.keep));
/* 애플 규정이 허락하는 색은 검정과 흰색 둘뿐이다. 어두운 단추 위이므로 흰색이어야 한다. */
ok('로고가 흰색이다 (브랜드 규정)', /255, 255, 255/.test(look1.fill), look1.fill);

await ev(`document.querySelector('#lgApple').click()`);
await sleep(600);
const ap=await ev(`(()=>{ const v=document.querySelector('.veil');
  return { called:(window.__calls[1]||[])[0], open:!!v,
           logo:!!(v&&v.querySelector('#lgApple .amark svg')),
           btn:(v&&v.querySelector('#lgApple')||{}).textContent||'' }; })()`);
ok('애플 갈래가 애플을 부른다', ap.called==='apple', String(ap.called));
ok('애플도 실패하면 되돌아온다 · 로고가 남는다', ap.open && /다시/.test(ap.btn) && ap.logo,
   `${ap.btn.trim().slice(0,20)} · 로고 ${ap.logo}`);

/* 메일 — 형식이 틀리면 그 자리에서 말하고, 맞으면 보냈다고 한다 */
await ev(`(()=>{ const i=document.querySelector('#lgMail'); i.value='그냥글자';
  document.querySelector('#lgSend').click(); return 1 })()`);
await sleep(600);
const bad=await ev(`(document.querySelector('#lgNote')||{}).textContent||''`);
ok('틀린 주소는 보내기 전에 걸러진다', /형식/.test(bad), bad);

await ev(`(()=>{ const i=document.querySelector('#lgMail'); i.value='a@b.co';
  document.querySelector('#lgSend').click(); return 1 })()`);
await sleep(600);
const good=await ev(`(()=>{ const v=document.querySelector('.veil');
  const c=window.__calls.filter(x=>x[0]==='email').pop()||[];
  return { arg:c[1], open:!!v, note:(v&&v.querySelector('#lgNote')||{}).textContent||'',
           still:!!(v&&v.querySelector('#lgMail')) }; })()`);
ok('메일 갈래가 그 주소로 보낸다', good.arg==='a@b.co', String(good.arg));
ok('보낸 뒤에도 **창이 남는다** (주소를 다시 칠 수 있다)', good.open&&good.still, String(good.open));
ok('보냈다고 말한다', /보냈습니다/.test(good.note), good.note);

/* 주소가 **친 대로** 보이는가. `.codebox` 는 여덟 글자 지점 코드를 읽어 주려고
   대문자로 바꾸는데, 그게 메일칸에 걸리면 `A@B.CO` 로 보인다 — 오타인지 아닌지를
   알 수 없게 된다. 눈에 보이는 값을 잰다. */
const look = await ev(`(()=>{ const i=document.querySelector('#lgMail');
  const cs=getComputedStyle(i);
  return { tr:cs.textTransform, ls:cs.letterSpacing, val:i.value }; })()`);
ok('메일 주소를 대문자로 안 바꾼다', look.tr === 'none',
   `text-transform ${look.tr} · 자간 ${look.ls} · 값 ${look.val}`);

ok('콘솔 오류 0', errs.length===0, errs.join(' / ').slice(0,160));

await send('Page.captureScreenshot',{format:'png'}).then(sh=>{
  const out=path.join(__dirname,'dist','shots');fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'login.png'),Buffer.from(sh.data,'base64'));
});
const bad2=rows.filter(r=>!r.pass).length;
console.log('');
rows.forEach(r=>console.log(` ${r.pass?'OK ':'X  '} ${r.name}${r.note?'   — '+r.note:''}`));
console.log(`\n ${rows.length-bad2}/${rows.length} 통과\n사진 → spike/dist/shots/login.png`);
try{ws.close();}catch(e){}chrome.kill();process.exit(bad2?1:0);
})();
