/* 폰 배포본 검증.  node spike/serve.js 먼저, node tools/pack-mobile.js 먼저.

   이 배포본의 주장은 딱 두 개다: **폰에 설치되고, 인터넷 없이 돈다.**
   그래서 그 둘을 실제로 잰다 — manifest 가 있다는 것만 확인하는 건 검증이 아니다.

     1. 폰 크기에서 뜬다 (탭 바 배치 · 오류 0)
     2. 서비스 워커가 등록되고 **페이지를 장악한다**(controller)
     3. **네트워크를 끊고 새로 고쳐도 뜬다** ← 오프라인 주장의 유일한 증거
     4. manifest·아이콘·시작화면이 실제로 200 으로 내려온다
     5. 안전 영역 변수가 배치에 먹는다 (아이폰 홈 인디케이터)
     6. 상태바를 피한다 · 무대 위의 카드가 다른 탭을 안 따라온다
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9600;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'http://localhost:8123/dist/';

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-mob-' + process.pid);
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
  const boot = async url => {
    await send('Page.navigate', { url });
    await sleep(11000);
    /* 시작화면을 먼저 넘긴다(js/title.js). 이걸 안 누르면 게임이 시작되지 않는데,
       화면 뒤에서 #app 은 이미 있으므로 **검사는 통과해 버린다** — 그래서 여기서
       실제로 누른다. 없으면 아무 일도 안 한다. */
    await ev(`(() => { const t = document.getElementById('cctitle'); if (t) t.click(); })()`);
    await sleep(1400);
    await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
    await sleep(1100);
    await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
    await sleep(1100);
    await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
    await sleep(2200);
    await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
      document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
    await sleep(700);
  };

  let fail = 0;
  const ok = (cond, label, extra) => {
    if (!cond) fail++;
    console.log(`  ${cond ? '✅' : '❌'} ${label}${extra ? '  ' + extra : ''}`);
  };

  for (const platform of ['android', 'iphone']){
    console.log(`\n══════ ${platform} ══════`);
    errs = [];
    await send('Network.emulateNetworkConditions', { offline:false, latency:0, downloadThroughput:-1, uploadThroughput:-1 });
    await send('Emulation.setDeviceMetricsOverride', { width:390, height:844, deviceScaleFactor:2, mobile:true });
    await boot(BASE + platform + '/index.html');

    /* 1. 배치 */
    const layout = await ev(`(() => {
      const a = document.getElementById('app');
      const r = s => { const e = document.querySelector(s); if (!e) return null;
        const b = e.getBoundingClientRect(); return [Math.round(b.y), Math.round(b.height)]; };
      return JSON.stringify({ 배치: a.classList.contains('tabbar') ? 'tabbar' : a.className,
        탭바: r('#colTabs'), 무대: r('.stagewrap'),
        앱높이: Math.round(a.getBoundingClientRect().height), 창높이: innerHeight,
        가로오버플로: document.documentElement.scrollWidth - innerWidth });
    })()`);
    const L = JSON.parse(layout);
    ok(L.배치 === 'tabbar', '폰 배치가 살아난다', L.배치);
    ok(L.앱높이 === L.창높이, '100dvh 가 창을 정확히 채운다', L.앱높이 + '/' + L.창높이);
    ok(L.가로오버플로 === 0, '가로 오버플로 없음');

    /* 2. 파일이 내려오나 */
    const files = platform === 'android'
      ? ['manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-512.png','sw.js']
      : ['manifest.webmanifest','apple-touch-icon.png','splash-390x844@3.png','sw.js'];
    const codes = await ev(`Promise.all(${JSON.stringify(files)}.map(f =>
      fetch('./' + f).then(r => f + ':' + r.status).catch(() => f + ':실패'))).then(a => a.join(' '))`);
    ok(!/:(?!200)/.test(codes), '배포 파일이 전부 200', codes);

    /* 3. manifest 내용 */
    const man = await ev(`fetch('./manifest.webmanifest').then(r => r.json()).then(m => JSON.stringify({
      display: m.display, icons: m.icons.length,
      maskable: m.icons.filter(i => i.purpose === 'maskable').length,
      start: m.start_url, theme: m.theme_color }))`);
    const M = JSON.parse(man);
    ok(M.display === 'standalone', 'standalone 으로 뜬다');
    ok(platform === 'android' ? M.maskable === 2 : M.maskable === 0,
       platform === 'android' ? 'maskable 아이콘이 따로 있다' : 'iOS 는 maskable 을 안 넣는다', 'maskable=' + M.maskable);

    /* iOS 전용 머리 태그 */
    if (platform === 'iphone'){
      const ios = await ev(`JSON.stringify({
        touchIcon: !!document.querySelector('link[rel="apple-touch-icon"]'),
        splash: document.querySelectorAll('link[rel="apple-touch-startup-image"]').length,
        capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
        bar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.content })`);
      const I = JSON.parse(ios);
      ok(I.touchIcon, 'apple-touch-icon 이 있다');
      ok(I.splash === 7, '시작 화면 7종', '' + I.splash);
      ok(I.capable === 'yes' && I.bar === 'black-translucent', 'iOS 전체화면 메타');
    }

    /* 4. 서비스 워커가 페이지를 장악하나 */
    const swReg = await ev(`navigator.serviceWorker.getRegistration().then(r =>
      r ? (r.active ? 'active' : r.installing ? 'installing' : 'waiting') : '없음')`);
    ok(swReg === 'active' || swReg === 'installing', '서비스 워커 등록', swReg);
    /* 장악은 두 번째 방문부터다 — 새로 고쳐서 확인한다 */
    await sleep(6000);
    await send('Page.navigate', { url: BASE + platform + '/index.html' });
    await sleep(6000);
    const ctrl = await ev(`!!navigator.serviceWorker.controller`);
    ok(ctrl, '두 번째 방문에서 서비스 워커가 페이지를 장악한다');

    /* 5. 오프라인 — 이 배포본의 유일한 증거 */
    const cached = await ev(`caches.keys().then(k => k.join(',')).catch(() => '없음')`);
    await send('Network.emulateNetworkConditions', { offline:true, latency:0, downloadThroughput:0, uploadThroughput:0 });
    errs = [];
    await send('Page.navigate', { url: BASE + platform + '/index.html' });
    await sleep(9000);
    const off = await ev(`(() => {
      const has = s => !!document.querySelector(s);
      return JSON.stringify({ 앱: has('#app'), 무대: has('.stagewrap'),
        스크립트돎: typeof S !== 'undefined' && !!S,
        고양이: (typeof S !== 'undefined' && S && S.cats) ? S.cats.length : -1,
        렌더: typeof R3 !== 'undefined' && R3 && R3.ready ? '3D' : '2D' });
    })()`);
    const O = JSON.parse(off);
    ok(O.앱 && O.스크립트돎, '네트워크를 끊고 새로 고쳐도 게임이 뜬다', JSON.stringify(O));
    ok(cached.includes('copycat-'), '캐시 이름', cached);

    /* 오프라인에서 3D 모듈까지 오나 — 모듈은 blob 으로 접혀 있어 캐시와 무관해야 한다 */
    ok(O.렌더 === '3D', '오프라인에서도 3D 가 올라온다', O.렌더);
    ok(!errs.length, '오프라인 오류 없음', errs.slice(0, 2).join(' | '));
  }

  /* ── 6. 상태바를 피하는가 · 무대 위의 것이 무대에만 있는가 ──────────────
     둘 다 **실기기에서만 드러났다**(2026-09-08, 아이폰). 브라우저에서는 사파리
     주소창이 위를 밀어 줘서 안 보였고, 열을 바꿔도 카드가 따라오는 건 폰에서
     탭을 눌러 봐야 보인다. */
  {
    /* **네트워크를 되돌린다.** 바로 위 오프라인 검사가 끊어 놓은 채로 두면, 여기서
       재는 것이 배치가 아니라 「캐시에 뭐가 있나」가 된다 — 실제로 한 탭만 어긋났다. */
    await send('Network.emulateNetworkConditions',
      { offline:false, latency:0, downloadThroughput:-1, uploadThroughput:-1 });
    await send('Emulation.setDeviceMetricsOverride',
      { width:390, height:844, deviceScaleFactor:2, mobile:true });
    /* 아이폰 배포본으로 본다 — 상태바에 가려지는 건 iOS 이야기다.
       (스킨 CSS 는 두 배포본이 같은 파일을 쓰므로 한 번만 봐도 된다.) */
    await send('Page.navigate', { url: BASE + 'iphone/index.html' });
    let up = false;
    for (let i = 0; i < 70 && !up; i++){
      await sleep(700);
      up = await ev(`(()=>{const t=document.querySelector('#cctitle');if(t)t.remove();
        document.body.classList.remove('titleon');
        document.querySelectorAll('.veil,.coach,.coachring').forEach(x=>x.remove());
        /* **스킨이 붙을 때까지** 기다린다 — setCol 이 있다고 폰 스킨이 선 것은 아니다.
           cozy.js 가 body.eerie 를 붙이고 .stagestack 을 만들기 전에 재면, 규칙이
           하나도 안 걸린 맨 div 를 보고 「안 숨는다」고 말하게 된다. */
        return typeof setCol==='function' && document.body.classList.contains('eerie')
               && !!document.querySelector('.stagestack')})()`).catch(()=>false);
    }

    /* 안전 영역은 헤드리스에서 **흉내 낼 수 없다**(CDP 에 그 손잡이가 없다).
       그래서 값이 아니라 **규칙**을 본다: 폰 스킨의 topbar 가 padding 을 통째로
       다시 쓰면서 위쪽 안전 영역을 지우고 있었다 — 그 자리에 그 값이 있는지.

       예전에는 `env(safe-area-inset-top)` 이라는 글자를 찾았다. 지금은 그 자리에
       `var(--safet)` 이 있다 — 위쪽 안전영역을 **낼지 말지**가 기기가 아니라 창의
       문제라서 한 곳(:root)으로 모았기 때문이다(2026-09-21 · style.css 의 머리말).
       그래서 찾을 글자가 바뀌었다. **흐르는지**는 여기서 못 보므로
       `spike/verify-safetop.js` 가 따로 본다 — 부어 보고 가는지 막히는지. */
    const rule = await ev(`(()=>{
      let hit = '';
      for (const sh of document.styleSheets){
        let rs; try { rs = sh.cssRules; } catch(e){ continue; }
        for (const r of rs){
          if (r.selectorText && /#app\.tabbar #topbar$/.test(r.selectorText.trim())
              && /eerie/.test(r.selectorText))
            hit = r.style.getPropertyValue('padding') || r.style.getPropertyValue('padding-top');
        }
      }
      return hit })()`);
    ok(/var\(\s*--safet\s*\)/.test(rule || ''),
       '폰 스킨 topbar 가 **상태바를 피한다** (--safet 을 지난다)', rule || '(규칙을 못 찾음)');

    const leak = await ev(`(async()=>{
      setCol('stage'); await new Promise(r=>setTimeout(r,400));
      const onStage = getComputedStyle(document.querySelector('.stagestack')).display;
      setCol('shop');  await new Promise(r=>setTimeout(r,400));
      const el = document.querySelector('#app');
      const shopCol = el.getAttribute('data-col'), shopCls = el.className;
      const n = document.querySelectorAll('.stagestack').length;
      const onShop = getComputedStyle(document.querySelector('.stagestack')).display;
      setCol('inbox'); await new Promise(r=>setTimeout(r,400));
      const onInbox = getComputedStyle(document.querySelector('.stagestack')).display;
      setCol('stage');
      return { onStage, onShop, onInbox, shopCol, shopCls, n } })()`);
    ok(leak.onStage !== 'none', '무대에서는 분기 카드 자리가 있다', leak.onStage);
    /* **위쪽이 서로 안 겹치는가.** 안전 영역은 헤드리스에서 못 만들지만, 「띠 아래에서
       시작한다」는 규칙 자체는 여기서도 잰다 — 숫자를 박아 두면 그 규칙이 깨져도
       조용하다(실기기에서 두 번 겹쳤다: 상태바와, 그다음엔 설정 단추와). */
    const top = await ev(`(async()=>{
      setCol('stage'); await new Promise(r=>setTimeout(r,500));
      const bar = document.querySelector('#topbar').getBoundingClientRect();
      const rail = document.querySelector('.doorrail');
      const chip = document.querySelector('.clockchip');
      const rb = rail ? rail.getBoundingClientRect() : null;
      const cb = chip ? chip.getBoundingClientRect() : null;
      const gear = document.querySelector('#topbar .gearbtn, #topbar #btnMore, #topbar .iconbtn');
      return { barBottom: Math.round(bar.bottom),
               railTop: rb ? Math.round(rb.top) : null,
               chipTop: cb ? Math.round(cb.top) : null,
               gearBottom: gear ? Math.round(gear.getBoundingClientRect().bottom) : null,
               v: getComputedStyle(document.querySelector('#app')).getPropertyValue('--topb').trim() } })()`);
    ok(top.railTop !== null && top.railTop >= top.barBottom,
       '**오른쪽 줄이 상단 띠 아래에서 시작한다**',
       `띠 아래 ${top.barBottom} · 줄 ${top.railTop} · --topb ${top.v}`);
    ok(top.gearBottom === null || top.railTop >= top.gearBottom,
       '설정 단추와 안 겹친다', `설정 아래 ${top.gearBottom} · 줄 ${top.railTop}`);
    ok(top.chipTop !== null && top.chipTop >= top.barBottom - 4,
       '시계 칩도 띠 아래에 있다', `칩 ${top.chipTop}`);

    ok(leak.onShop === 'none' && leak.onInbox === 'none',
       '**다른 탭에는 안 따라온다**',
       `비품 ${leak.onShop} · 결재함 ${leak.onInbox} · data-col ${leak.shopCol} · 겹친 stack ${leak.n} · ${leak.shopCls}`);
  }

  console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과');
  ws.close(); chrome.kill(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
