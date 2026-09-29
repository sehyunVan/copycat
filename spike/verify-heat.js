/* 열 — 사무실 화면을 켜 두면 폰이 뜨거워지던 것.  node spike/serve.js 먼저.

     node spike/verify-heat.js                                          소스 트리
     COPYCAT_BASE=http://localhost:8123/dist/iphone  node spike/verify-heat.js
     COPYCAT_BASE=http://localhost:8123/dist/android node spike/verify-heat.js

   **구운 배포본에도 대 본다.** 고침이 소스에 있다는 것과 폰에 내려가는 파일에
   있다는 것은 다른 말이고, 후자만 사람이 손에 쥔다(pack-mobile 이 3D 를 index.html
   안으로 접으므로 파일 모양도 다르다).

   두 기기에서 「사무실 탭에 2분 있으면 뜨겁다」가 왔다(2026-09-21 제보). 원인은
   기능이 아니라 **빈도**였다: 시뮬레이션은 20Hz 로 도는데 그리기는 rAF 가 부르는
   대로 초당 60장이었고, 한 장의 절반이 2048² 그림자 맵을 다시 굽는 값이었다.

   그래서 폰에서만 둘을 줄였다 — 30장(js/col.js DRAW_GAP · js/main.js frame)과
   1024 그림자(js/render3d.js shadowFit). 이 검사는 **그게 실제로 줄었는지**와,
   더 중요하게 **줄이면서 사무실이 느려지지 않았는지**를 본다.

   재는 것 다섯:
     1  폰 배치에서 rAF 가 부르는 것의 **절반만** 그린다
     2  폰에서 그림자 맵이 1024 다
     3  **빗장(DRAW_GAP)만 풀면 두 배로 그리고, 사무실 틱은 그대로다** (이게 본론)
     4  소스 트리: 창을 넓히면(데스크톱 배치) 전부 그리고 그림자도 2048 로 돌아온다
        폰 배포본: 창을 넓혀도 **폰인 채로 남는다** (도장이 폭을 이긴다 — js/col.js PHONE_DIST)
     5  콘솔 오류 없음
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
/* 포트·프로필은 실행마다 다르게. 윈도의 pid 는 4의 배수라 `pid % n` 이 자주 겹치고,
   겹치면 앞 실행이 남긴 자리에 부딪혀 「크롬이 안 떴다」로 끝난다(실제로 그랬다). */
const TAG = process.pid + '-' + Math.floor(Math.random() * 1e6);
const PORT = 9400 + Math.floor(Math.random() * 300);
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
if (!CHROME) throw new Error('크롬을 못 찾았다');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let bad = 0;
const ok = (t, pass, note) => { if (!pass) bad++;
  console.log(`${pass ? '✅' : '❌'} ${t}${note ? '   ' + note : ''}`); };

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-heat-' + TAG);
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page; for (let i = 0; i < 160 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  if (!page) throw new Error(`크롬이 ${PORT} 에서 안 떴다 — 남은 크롬을 닫고 다시`);
  const ws = new WebSocket(page.webSocketDebuggerUrl); let id = 0; const pend = new Map();
  const errs = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text);
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;

  /* 서버는 막는다 — 재는 것이 통신이 아니라 프레임이고, 전송이 샘플 구간에 끼면
     그 한 장만 길어져서 간격이 흔들린다. */
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*supabase*', '*jsdelivr*'] });
  await send('Emulation.setDeviceMetricsOverride', { width:390, height:844, deviceScaleFactor:2, mobile:true });
  await send('Page.addScriptToEvaluateOnNewDocument', { source:'try { localStorage.clear(); } catch(e){}' });
  await send('Page.navigate', { url: BASE + '/index.html' });
  await sleep(11000);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1200);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1200);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2400);
  await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
    const t=document.querySelector('#cctitle'); if (t) t.remove();
    document.body.classList.remove('titleon');
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove());
    /* 사무실 탭 — 제보가 온 화면이 여기다. 다른 탭에서는 무대가 덮여서
       애초에 안 그린다(js/col.js stageCovered). */
    if (typeof setCol === 'function') setCol('stage'); })()`);
  await sleep(2000);

  /* 폰용 배포본인가 — 그 도장이 있으면 배치가 **폭을 안 본다**(js/col.js PHONE_DIST).
     아이폰·안드로이드 배포본에서 이 검사가 무엇을 기대해야 하는지가 여기서 갈린다. */
  const DIST = await ev(`(() => { const m = document.querySelector('meta[name="copycat-dist"]');
    return (m && m.content) || ''; })()`);
  const BUILD = DIST ? await ev(`(document.querySelector('meta[name="copycat-build"]')||{}).content || '?'`) : '';
  const lay = await ev(`$('#app').dataset.col + '/' + ($('#app').classList.contains('tabbar') ? 'm4' : 'wide')`);
  console.log('배치 ' + lay + (DIST ? `  ·  배포본 "${DIST}" · ${BUILD}` : '  ·  소스 트리'));

  /* ── 어떻게 재나 ──
     **진짜로 그리게 두고 세면 안 된다.** 헤드리스는 swiftshader(소프트웨어 래스터)라
     한 장에 300ms 가 걸리고, 그러면 rAF 자체가 초당 3장으로 떨어져서 30과 60을
     구분할 수 없다 — 기계가 느린 것과 우리가 끊은 것이 같은 숫자로 보인다.

     그래서 그리는 자리(syncActors)를 **세기만 하는 것으로 바꿔 놓고** 잰다. rAF 는
     제 속도로 돌고, 묻는 것은 하나다: rAF 가 부른 만큼 그리라고 하는가, 그 절반만
     하는가. 그게 DRAW_GAP 이 실제로 하는 일의 전부다.

     simTick 은 감싸되 **원래대로 부른다** — 이쪽은 세는 김에 「덜 그려도 사무실은
     20Hz 로 돈다」를 같이 보는 자리라 진짜로 돌아야 한다. */
  const beat = async (ms, quiet) => JSON.parse(await ev(`(async () => {
    const drawn = window.syncActors, ticked = window.simTick;
    const top = window.renderTop, nite = window.renderNight;
    let d = 0, t = 0, f = 0, stop = false;
    window.syncActors = function(){ d++; };
    window.simTick = function(){ t++; return ticked.apply(this, arguments); };
    /* 그리는 자리 옆에 있는 둘도 같이 세운다. **한 장이 1/31 초보다 길어지면 이
       검사는 아무것도 못 잰다** — 빗장이 매 장 열려서 몫이 1 이 되고, 그건 빗장이
       고장 난 것이 아니라 기계가 30장도 못 그린다는 뜻이다(헤드리스가 그렇다).
       느린 기계와 우리가 끊은 것을 같은 숫자로 읽지 않으려고 둘 다 세운다. */
    if (${quiet ? 'true' : 'false'}){ window.renderTop = function(){}; window.renderNight = function(){}; }
    const tick = () => { f++; if (!stop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const t0 = performance.now();
    await new Promise(r => setTimeout(r, ${ms}));
    const el = (performance.now() - t0) / 1000;
    stop = true; window.syncActors = drawn; window.simTick = ticked;
    window.renderTop = top; window.renderNight = nite;
    return JSON.stringify({ raf:+(f/el).toFixed(1), draw:+(d/el).toFixed(1),
                            sim:+(t/el).toFixed(1), 몫:+(d/Math.max(1,f)).toFixed(2) });
  })()`));

  console.log('\n── 폰 ──');
  await beat(1500, true);          // 예열 — 첫 샘플은 아직 뜨는 중이라 rAF 가 느리다
  const m = await beat(3000, true);
  console.log('   ' + JSON.stringify(m));
  ok('rAF 가 부르는 것의 **절반만** 그린다', m.몫 > 0.35 && m.몫 < 0.65,
     `rAF ${m.raf}장 → 그리기 ${m.draw}장 (몫 ${m.몫})`);
  ok('그림자 맵이 1024 다', await ev(`R3.perf().그림자.map`) === 1024);

  /* ── 여기가 본론 ──
     덜 그리는 것은 값이 싸야 하지, **사무실이 느려지는 값을 치르면 안 된다.**

     그래서 「20Hz 가 나오나」를 묻지 않는다 — 헤드리스는 소프트웨어 래스터라
     한 장이 길어지고, 한 장이 0.25초를 넘으면 그 위는 잘린다(main.js frame 의
     dt 상한). 그건 이 기계가 느린 것이지 우리가 끊은 탓이 아닌데, 숫자만 보면
     구분이 안 간다.

     묻는 것은 **빗장을 풀면 달라지나**다. 같은 화면에서 DRAW_GAP 만 0 으로 두고
     한 번 더 재서, 그리는 횟수는 두 배가 되고 **사무실 틱은 그대로**인지를 본다.
     그게 「그리기와 시뮬레이션은 다른 일이다」의 정확한 뜻이다.

     **번갈아 세 번씩 재고 중앙값을 본다.** 한 번씩만 재면 기계가 데워지는 것과
     섞여서 앞의 것이 느리고 뒤의 것이 빠르게 나온다(실제로 rAF 가 7 → 53 으로
     뛰었다). 그 차이를 빗장 탓으로 읽으면 안 된다. */
  const raw = await ev(`DRAW_GAP`);
  const med = a => { a = a.slice().sort((x, y) => x - y); return a[a.length >> 1]; };
  const A = [], B = [];
  for (let i = 0; i < 3; i++){
    await ev(`DRAW_GAP = ${raw}`); A.push(await beat(2000, true));
    await ev(`DRAW_GAP = 0`);      B.push(await beat(2000, true));
  }
  await ev(`DRAW_GAP = ${raw}`);
  const q = med(A.map(x => x.몫)), q0 = med(B.map(x => x.몫));
  const t = med(A.map(x => x.sim)), t0 = med(B.map(x => x.sim));
  console.log(`   빗장 건 채 몫 ${q} · 틱 ${t}   /   풀고 몫 ${q0} · 틱 ${t0}`);
  ok('빗장을 풀면 두 배로 그린다 (끊은 게 빗장이 맞다)', q < 0.65 && q0 > 0.85, `몫 ${q} → ${q0}`);
  const drift = Math.abs(t0 - t) / Math.max(1, t0);
  ok('그래도 사무실 틱은 그대로다 — 덜 그려도 속도는 안 변한다', drift < 0.15,
     `초당 ${t}틱 → ${t0}틱 (차이 ${(drift*100).toFixed(0)}%)`);

  /* 상단 바 한 번이 얼마나 드나. 큰 값은 아니지만 **20Hz 로 도는 값을 60번 다시
     쓰는 것**이라 시뮬레이션과 같은 빈도로 줄였다(js/main.js frame). 여기 찍어
     두는 이유는 그게 얼마짜리 절약인지 나중에 다시 안 재 보려는 것이다. */
  const topMs = +(await ev(`(() => { const t0=performance.now();
    for (let i=0;i<60;i++) renderTop(); return ((performance.now()-t0)/60).toFixed(2); })()`));
  console.log('   상단 바 한 번 ' + topMs + 'ms — 60번이면 ' + (topMs*60).toFixed(0)
    + 'ms/s, 20번이면 ' + (topMs*20).toFixed(0) + 'ms/s');

  console.log('\n── 창을 넓히면 (데스크톱 배치) ──');
  await send('Emulation.setDeviceMetricsOverride', { width:1400, height:900, deviceScaleFactor:1, mobile:false });
  await ev(`dispatchEvent(new Event('resize'))`);
  await sleep(1500);
  const m2 = await beat(2500, true);
  const map2 = await ev(`R3.perf().그림자.map`);
  console.log('   ' + JSON.stringify(m2) + ' · 그림자 ' + map2);
  if (DIST === 'mobile'){
    /* **폰 배포본은 폭을 안 본다.** 아이폰에 깔린 게임은 가로로 돌려도, PC 브라우저로
       열어도 폰이다 — 그러니 아낀 것도 그대로 남아야 한다. 여기가 「아이폰에서도
       고쳐진 게 맞나」의 답이 서는 자리다. */
    ok('창을 넓혀도 절반만 그린다 (도장이 폭을 이긴다)', m2.몫 > 0.35 && m2.몫 < 0.65, `몫 ${m2.몫}`);
    ok('그림자도 1024 로 남는다', map2 === 1024, String(map2));
  } else {
    ok('rAF 가 부르는 대로 전부 그린다', m2.몫 > 0.85, `몫 ${m2.몫}`);
    ok('그림자도 2048 로 돌아온다', map2 === 2048, String(map2));
  }

  ok('콘솔 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | ') || '0');
  console.log('\n' + (bad ? `${bad}건 실패` : '전부 통과'));
  ws.close(); chrome.kill();
  process.exit(bad ? 1 : 0);
})();
