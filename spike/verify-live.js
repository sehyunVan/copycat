/* 배포된 **실제 주소**에 폰 크기로 붙어 확인한다.  node spike/verify-live.js [주소]

   spike/verify-mobile.js 는 localhost 를 봤다. localhost 는 브라우저가 특별 취급하는
   보안 출처라서, 서비스 워커가 거기서 돌았다는 것이 진짜 HTTPS 에서 돈다는 증거가 아니다.
   여기서는 인증서·MIME·리다이렉트까지 전부 실물이다.

   재는 것:
     1. HTTPS 로 뜬다 (인증서 · 리다이렉트)
     2. manifest 가 Chrome 이 설치 프롬프트를 띄울 조건을 만족한다
     3. 서비스 워커가 페이지를 장악한다
     4. **네트워크를 끊고 새로 고쳐도 3D 까지 뜬다**
     5. 첫 화면(안내 페이지)이 기기에 맞는 쪽을 위에 놓는다
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9610;
const BASE = (process.argv[2] || fs.readFileSync(
  path.join(__dirname, '..', 'dist', 'DEPLOY-URL.txt'), 'utf8')).trim().replace(/\/$/, '');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-live-' + process.pid);
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page; for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl); let id = 0; const pend = new Map();
  let errs = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errs.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 140));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;

  let fail = 0;
  const ok = (c, label, extra) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`); };

  console.log('주소: ' + BASE + '\n');
  await send('Emulation.setDeviceMetricsOverride', { width:390, height:844, deviceScaleFactor:2, mobile:true });
  /* 첫 화면은 UA 로 기기를 가린다. 화면 크기만 흉내 내고 아이폰이라고 기대하면
     그건 제품이 아니라 테스트가 틀린 것이다 — 처음에 실제로 그렇게 틀렸다. */
  await send('Emulation.setUserAgentOverride', { userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 '
    + '(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });

  /* ── 첫 화면 ──
     고르는 판을 없앴다(2026-09-01). 이제 여기서 재는 것은 「두 카드가 있나」가 아니라
     **「고르게 하지 않고 바로 넘어가나」** 다 — 그게 이 화면의 주장 전부다. */
  await send('Page.navigate', { url: BASE + '/' });
  await sleep(5000);
    /* 시작화면을 먼저 넘긴다(js/title.js). 이걸 안 누르면 게임이 시작되지 않는데,
       화면 뒤에서 #app 은 이미 있으므로 **검사는 통과해 버린다** — 그래서 실제로 누른다. */
    await ev(`(() => { const t = document.getElementById('cctitle'); if (t) t.click(); })()`);
    await sleep(1400);
  const land = await ev(`JSON.stringify({
    https: location.protocol, 주소: location.pathname,
    고르는칸: document.querySelectorAll('a.card').length,
    앱: !!document.getElementById('app') })`);
  const LD = JSON.parse(land);
  console.log('── 첫 화면 ──');
  ok(LD.https === 'https:', 'HTTPS 로 뜬다', LD.https);
  ok(LD.고르는칸 === 0, '고르는 판이 없다');
  ok(/\/iphone\/index\.html$/.test(LD.주소), '기기에 맞는 쪽으로 바로 넘어간다 (지금은 iOS 로 흉내)', LD.주소);
  ok(LD.앱, '넘어간 자리에 게임이 있다');

  /* 게임 화면은 안드로이드 UA 로 본다 — 게임 자체는 UA 를 안 보지만,
     설치 프롬프트 조건(beforeinstallprompt)은 크롬에서만 뜬다. */
  await send('Emulation.setUserAgentOverride', { userAgent:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) '
    + 'Chrome/140.0.0.0 Mobile Safari/537.36' });

  for (const p of ['android', 'iphone']){
    console.log(`\n── ${p} ──`);
    errs = [];
    await send('Network.emulateNetworkConditions', { offline:false, latency:0, downloadThroughput:-1, uploadThroughput:-1 });
    await send('Page.navigate', { url: `${BASE}/${p}/index.html` });
    await sleep(14000);
    await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
    await sleep(1200);
    await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
    await sleep(1200);
    await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
    await sleep(2200);
    await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
      document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
    await sleep(900);

    const st = await ev(`(() => {
      const a = document.getElementById('app');
      return JSON.stringify({ 배치: a.classList.contains('tabbar') ? 'tabbar' : a.className,
        앱높이: Math.round(a.getBoundingClientRect().height), 창높이: innerHeight,
        렌더: (typeof R3 !== 'undefined' && R3 && R3.ready) ? '3D' : '2D',
        고양이: (typeof S !== 'undefined' && S && S.cats) ? S.cats.length : -1 });
    })()`);
    const S1 = JSON.parse(st);
    ok(S1.배치 === 'tabbar', '폰 배치', S1.배치);
    ok(S1.앱높이 === S1.창높이, '100dvh', S1.앱높이 + '/' + S1.창높이);
    ok(S1.렌더 === '3D', '3D 가 올라온다');

    /* manifest — Chrome 이 설치 프롬프트를 띄우는 조건 */
    const man = await ev(`fetch('./manifest.webmanifest').then(r =>
      r.json().then(m => JSON.stringify({ ct: r.headers.get('content-type'),
        display: m.display, name: !!m.name, icons: m.icons.length,
        big: m.icons.some(i => i.sizes === '512x512'),
        maskable: m.icons.filter(i => i.purpose === 'maskable').length })))`);
    const M = JSON.parse(man);
    ok(/manifest\+json/.test(M.ct || ''), 'manifest MIME', M.ct);
    ok(M.display === 'standalone' && M.name && M.big, '설치 조건(standalone·이름·512 아이콘)');
    if (p === 'android') ok(M.maskable === 2, 'maskable 아이콘 2장');

    /* 서비스 워커 장악 — 두 번째 방문부터 */
    await sleep(7000);
    await send('Page.navigate', { url: `${BASE}/${p}/index.html` });
    await sleep(7000);
    ok(await ev(`!!navigator.serviceWorker.controller`), '서비스 워커가 페이지를 장악한다');

    /* 오프라인 — 실물 HTTPS 출처에서 */
    await send('Network.emulateNetworkConditions', { offline:true, latency:0, downloadThroughput:0, uploadThroughput:0 });
    errs = [];
    await send('Page.navigate', { url: `${BASE}/${p}/index.html` });
    await sleep(10000);
    const off = await ev(`JSON.stringify({ 앱: !!document.getElementById('app'),
      돎: typeof S !== 'undefined' && !!S,
      렌더: (typeof R3 !== 'undefined' && R3 && R3.ready) ? '3D' : '2D' })`);
    const O = JSON.parse(off);
    ok(O.앱 && O.돎, '네트워크를 끊고 새로 고쳐도 뜬다', JSON.stringify(O));
    ok(O.렌더 === '3D', '오프라인에서도 3D');
    ok(!errs.length, '오프라인 오류 없음', errs.slice(0, 2).join(' | '));
  }

  console.log(fail ? `\n${fail}건 실패` : '\n전부 통과');
  ws.close(); chrome.kill(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
