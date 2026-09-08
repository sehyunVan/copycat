/* 로그인하고 **돌아왔을 때 말해 주는가.**

   구글로 넘어갔다 오면 페이지가 처음부터 다시 뜬다 — 시작 화면도 그대로 다시 뜨므로
   **눌렀던 그 자리로 돌아온 것처럼 보인다.** 됐는지 안 됐는지를 말해 주지 않으면
   사람은 한 번 더 누른다.

   세 경우를 갈라야 한다. 셋 다 「돌아왔다」는 표시가 주소에 붙어 있다:
     · 묶였다        → 묶었다고 말한다
     · 거절·오류      → 왜 안 됐는지 말한다
     · 돌아왔는데 익명 → **묶었다고 말하면 거짓말이다**

   ── 여기서 못 재는 것 ──
   **진짜 구글 왕복은 못 만든다.** 그래서 「묶였을 때의 문구」는 이 검사가 안 거친다 —
   가짜 코드를 들고 돌아오면 계정은 익명 그대로이고, 그건 실패 갈래로 떨어진다.
   그게 맞는 동작이라 여기서는 **거짓말을 안 하는지**를 본다: 돌아왔다는 표시가
   있어도 익명이면 「묶었습니다」라고 하면 안 된다.
   성공 문구는 실기기에서 한 번 눈으로 봐야 한다.

     node spike/serve.js      (다른 창에서)
     node spike/verify-back.js
*/
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const CHROME=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',(process.env.LOCALAPPDATA||'')+'/Google/Chrome/Application/chrome.exe'].find(p=>p&&fs.existsSync(p));
const BASE=process.env.COPYCAT_BASE||'http://localhost:8123';
const PORT=9700+(process.pid%80), sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rows=[];const ok=(n,p,note)=>rows.push({name:n,pass:!!p,note});
(async()=>{
try{const r=await fetch(BASE+'/index.html');if(!r.ok)throw 0;}catch(e){console.log(`\n  ${BASE} 가 안 열린다 — node spike/serve.js 먼저.`);process.exit(2);}
const dir=path.join(process.env.TEMP,'cdp-vback');try{fs.rmSync(dir,{recursive:true,force:true});}catch(e){}
const chrome=spawn(CHROME,['--headless=new','--hide-scrollbars','--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port='+PORT,'--user-data-dir='+dir,'about:blank'],{stdio:'ignore'});
let page;for(let i=0;i<160&&!page;i++){try{page=(await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t=>t.type==='page');}catch{}if(!page)await sleep(250);}
if(!page){chrome.kill();throw new Error('크롬이 안 떴다');}
const ws=new WebSocket(page.webSocketDebuggerUrl);let id=0;const pend=new Map();const errs=[];
const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);
 if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);return;}
 if(m.method==='Runtime.exceptionThrown')errs.push((m.params.exceptionDetails.exception?.description||'').slice(0,150));});
await new Promise(r=>ws.addEventListener('open',r));await send('Runtime.enable');await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});
 if(r?.exceptionDetails)throw new Error((r.exceptionDetails.exception?.description||'').slice(0,300));return r?.result?.value;};

/* 세 판을 각각 새로 연다. 주소에 실려 오는 표시가 이 기능의 입력이다. */
/* 심은 스크립트는 **쓰고 걷어낸다.** 안 걷으면 다음 판에도 계속 돌아서, 「한 번만
   쓰고 지운다」를 재려는 순간 그 스크립트가 다시 심어 놓는다 — 제품이 아니라 검사가
   만든 상황을 재게 된다. */
let planted = null;
async function run(url, stub){
  if (planted){ await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:planted}); planted=null; }
  if (stub){ planted = (await send('Page.addScriptToEvaluateOnNewDocument',{source:stub})).identifier; }
  await send('Page.navigate',{url});
  let r=null;
  for(let i=0;i<70&&!r;i++){
    await sleep(600);
    r=await ev(`(()=>{
      const v=[...document.querySelectorAll('.veil')].filter(x=>/ACCOUNT/.test(x.textContent));
      if(!v.length) return null;
      const t=v[v.length-1].textContent.replace(/\s+/g,' ').trim();
      return { said:t, url: location.search + location.hash } })()`).catch(()=>null);
  }
  return r;
}

/* 진짜 구글에는 못 간다. **돌아온 판**만 흉내 낸다 — 계정층이 무엇을 보고 판단하는지가
   이 검사가 재려는 것이다. */
const stubOK = `window.__forceAnon = false;`;
const okCase = await run(BASE + '/index.html?code=fake-return-code', stubOK);
ok('돌아오면 **무언가 말한다** (그 자리로 되돌아오지 않는다)', !!okCase, okCase ? okCase.said.slice(0,40) : '안 떴다');
ok('주소에서 표시를 지운다', okCase && !/code=/.test(okCase.url),
   okCase ? ('주소 ' + (okCase.url || '(비었다)')) : '-');

const failCase = await run(BASE + '/index.html#error=access_denied&error_description=사용자가+취소했습니다', '');
ok('거절당하면 **왜인지 말한다**',
   failCase && /못했습니다|취소/.test(failCase.said), failCase ? failCase.said.slice(0,50) : '안 떴다');
ok('거절인데 「묶었습니다」라고 안 한다',
   failCase && !/묶었습니다/.test(failCase.said), failCase ? '안 한다' : '-');

/* ── 앱 경로 ──────────────────────────────────────────────────────────
   **앱에서는 주소에 흔적이 안 남는다.** 우리가 우리 주소로 다시 여는 것이라
   `?code=` 같은 게 없다 — 웹만 보고 만들었더니 아이폰에서는 조용히 지나갔다.
   그래서 새로고침 너머로 표시를 넘긴다(sessionStorage). 그 자리를 여기서 본다. */
const appCase = await run(BASE + '/index.html',
  `try{ sessionStorage.setItem('copycat.justlinked','1'); }catch(e){}`);
ok('**앱에서 돌아와도 말한다** (주소에 흔적이 없어도)', !!appCase,
   appCase ? appCase.said.slice(0,40) : '안 떴다');

/* 표시는 한 번만 쓴다 — 새로 고칠 때마다 같은 창이 또 뜨면 안 된다. */
if (planted){ await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:planted}); planted=null; }
await send('Page.navigate',{url: BASE + '/index.html'});
await sleep(9000);
const again = await ev(`(()=>{
  const v=[...document.querySelectorAll('.veil')].filter(x=>/ACCOUNT/.test(x.textContent));
  let left=null; try{ left = sessionStorage.getItem('copycat.justlinked'); }catch(e){}
  return { n:v.length, left } })()`);
ok('표시는 한 번 쓰고 지운다', again.n === 0 && !again.left,
   `창 ${again.n} · 남은 표시 ${again.left}`);

ok('콘솔 오류 0', errs.length===0, errs.join(' / ').slice(0,150));
const bad=rows.filter(r=>!r.pass).length;
console.log('');
rows.forEach(r=>console.log(` ${r.pass?'OK ':'X  '} ${r.name}${r.note?'   — '+r.note:''}`));
console.log('');
console.log(` ${rows.length-bad}/${rows.length} 통과`);
try{ws.close();}catch(e){}chrome.kill();process.exit(bad?1:0);
})();
