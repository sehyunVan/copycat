/* 로딩 화면(#loadgate) 검증.  node spike/serve.js 를 먼저 띄운다.

   재는 것:
     1. **첫 페인트에 실제로 떠 있나** — 스크립트가 만드는 판이면 정작 필요한 몇 초를
        못 덮는다. 그래서 「있다」가 아니라 「스크립트가 돌기 전에 화면에 있었나」를 본다
     2. 렌더러가 오면 걷히나 · 그 사이 몇 초였나(20번이 6.3초로 잰 그 구간)
     3. **3D 가 안 오는 갈래에서도 걷히나** — ?3d=0(도트) · file:// 소스 트리(모듈 onerror).
        여기서 안 걷히면 WebGL 없는 기계가 로딩 화면에 갇힌다. 이게 제일 중요한 항목이다
     4. 걷힌 뒤 클릭을 안 삼키나 — 투명해진 채 위에 남아 있으면 게임이 안 눌린다
     5. 이마의 스피너가 **머리 안에** 있나(픽셀로) — 밖으로 나가면 밝은 배경에서 사라진다
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9536;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const OUT = path.resolve(__dirname, 'ui') + path.sep;
const ROOT = path.resolve(__dirname, '..') + path.sep;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const ok = (n, good, d) => { good ? pass++ : fail++;
  console.log(`  ${good ? '✅' : '❌'} ${n}${d === undefined ? '' : '   ' + d}`); };

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-load-v');
  fs.rmSync(dir, { recursive:true, force:true });
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
      errs.push(m.params.args.map(a => a.value ?? '').join(' '));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');

  /* 판이 **언제 떴다가 언제 걷혔나**를 페이지 안에서 잰다.
     밖에서 폴링하면 CDP 왕복과 sleep 이 그대로 오차가 되고, 첫 회차에 실제로
     「판이 11.5초 떠 있었다」는 거짓 숫자가 나왔다(진짜로는 400ms 였다).
     어떤 스크립트보다 먼저 심어야 첫 페인트를 놓치지 않는다. */
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__gate = { shown:-1, hidden:-1, 판없던프레임:0 };
    const mark = () => {
      const g = document.getElementById('loadgate');
      /* 판이 없던 프레임을 센다. 0 이 아니면 그 프레임에 **판 없이 뭔가 그려졌다**는
         뜻이고, 그게 이 화면이 없애려던 깜빡임이다(판을 body 첫 아이로 둔 이유). */
      if (!g){ window.__gate.판없던프레임++; return false; }
      const cs = getComputedStyle(g);
      const on = cs.visibility !== 'hidden' && +cs.opacity > 0.02;
      if (on && window.__gate.shown < 0) window.__gate.shown = performance.now();
      if (!on && window.__gate.shown >= 0 && window.__gate.hidden < 0)
        window.__gate.hidden = performance.now();
      return true;
    };
    const tick = () => { mark(); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  `});
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;

  /* 판이 화면에 있나. getBoundingClientRect 가 아니라 **보이는지**를 본다 —
     visibility:hidden 은 자리를 지키므로 상자 크기만 보면 늘 있다고 나온다. */
  const GATE = `(() => {
    const g = document.getElementById('loadgate');
    if (!g) return { 없다:true };
    const cs = getComputedStyle(g);
    const r = g.getBoundingClientRect();
    const cat = g.querySelector('.lcat'), sp = g.querySelector('.lspin');
    const cr = cat && cat.getBoundingClientRect(), sr = sp && sp.getBoundingClientRect();
    return {
      보임: cs.visibility !== 'hidden' && +cs.opacity > 0.02,
      opacity: +cs.opacity, visibility: cs.visibility,
      덮음: Math.round(r.width) >= innerWidth - 1 && Math.round(r.height) >= innerHeight - 1,
      그림: !!(cat && /data:image\\/png/.test(getComputedStyle(cat).backgroundImage)),
      고양이: cr ? { w:Math.round(cr.width), h:Math.round(cr.height) } : null,
      /* 스피너가 고양이 상자 안에 완전히 들어가 있나 — 상자 밖이면 배경 위다 */
      스피너안: !!(cr && sr && sr.left >= cr.left && sr.right <= cr.right
                   && sr.top >= cr.top && sr.bottom <= cr.bottom),
      글: (g.querySelector('.lword') || {}).textContent,
      ready: document.body.classList.contains('r3ready'),
      r3: !!(window.R3 && R3.ready),
    };
  })()`;

  /* ---------------- 1. 보통 방문 ---------------- */
  console.log('\n── 보통 방문(3D) ──');
  errs = [];
  await send('Emulation.setDeviceMetricsOverride', { width:1200, height:800, deviceScaleFactor:1, mobile:false });
  const t0 = Date.now();
  await send('Page.navigate', { url: BASE + '/index.html?3d=1' });

  /* 스크립트가 돌기 전을 잡는다 — 클래식 스크립트가 다 돌면 boot 이 시작된다.
     그 전에 판이 화면에 있어야 이 항목이 성립한다. */
  let first = null, firstAt = -1;
  for (let i = 0; i < 60 && !first; i++){
    const g = await ev(GATE);
    if (g && g.보임){ first = g; firstAt = Date.now() - t0; }
    else await sleep(50);
  }
  console.log(`   처음 「보임」이 된 시각 ${firstAt}ms · ` + JSON.stringify(first));
  /* 여기서 「덮는가」를 묻지 않는다 — 스타일시트가 붙기 전에는 맨 div 라 position:fixed
     가 없고 화면을 덮을 수가 없다(그 시점을 재서 두 번 실패했다). 이 구간에 깜빡임이
     없다는 것은 아래 「판 없이 그려진 프레임」 0 이 증명하고, 덮는지는 CSS 붙은 뒤에 본다. */
  ok('판이 있다', !!first && !first.없다);

  /* 모양은 **CSS 가 붙은 뒤에** 본다. 스타일시트 전에도 판은 「보이는」 상태이고
     (맨 div 의 기본값이 그렇다), 그 순간을 재면 그림이 없다고 나온다 —
     첫 회차가 그래서 실패했다. 브라우저는 렌더를 막는 스타일시트 전에는 아무것도
     안 그리므로 그 창에 깜빡임은 없다. 틀린 것은 재는 시점이었다. */
  for (let i = 0; i < 120; i++){
    if (await ev(`getComputedStyle(document.getElementById('loadgate')||document.body).zIndex === '9500'`)) break;
    await sleep(80);
  }
  const styled = await ev(GATE);
  console.log('   CSS 붙은 뒤: ' + JSON.stringify(styled));
  ok('판이 화면을 덮는다', !!styled && styled.덮음 === true);
  ok('고양이 그림이 CSS 안에 박혀 있다 (요청 없음)', !!styled && styled.그림 === true);
  ok('스피너가 머리 상자 안에 있다', !!styled && styled.스피너안 === true);
  ok('글은 thimkning...', !!styled && (styled.글 || '').trim() === 'thimkning...');

  /* 걷히는 순간까지 — 시각은 페이지가 기록한 것을 읽는다 */
  /* **판이 있는지를 먼저 본다.** 처음엔 `!g.보임` 만 봤는데, 판이 아직 파싱되기 전에는
     GATE 가 { 없다:true } 를 돌려주고 `!undefined` 가 참이라 그걸 「걷혔다」로 셌다 —
     그래서 file:// 갈래가 786ms 에 걷혔다는 거짓 숫자가 나왔다. */
  let gone = null;
  for (let i = 0; i < 200; i++){
    const g = await ev(GATE);
    if (g && !g.없다 && !g.보임){ gone = g; break; }
    await sleep(120);
  }
  const log = await ev(`JSON.stringify(window.__gate)`);
  const gl = JSON.parse(log || '{}');
  console.log('   ' + JSON.stringify(gone) + '  ' + log);
  ok('렌더러가 오면 판이 걷힌다', !!gone,
     gl.hidden > 0 ? `판이 떠 있던 시간 ${Math.round(gl.hidden - gl.shown)}ms` : '안 걷혔다');
  ok('걷힐 때 r3ready 가 걸려 있다', !!gone && gone.ready === true && gone.r3 === true);
  /* ms 로 재면 CSS 가 렌더를 막는 시간까지 섞여서 판정이 안 된다. **판 없이 지나간
     프레임이 있었나**를 본다 — 0 이면 그려진 모든 프레임에 판이 있었다는 뜻이다. */
  ok('판 없이 그려진 프레임이 없다', gl.판없던프레임 === 0,
     `판없던프레임 ${gl.판없던프레임} · 처음 보인 시각 ${Math.round(gl.shown)}ms`);

  /* 걷힌 뒤 클릭을 삼키지 않나 — 무대 한가운데를 짚어서 무엇이 잡히는지 본다 */
  const hit = await ev(`(() => { const e = document.elementFromPoint(innerWidth/2, innerHeight/2);
    return e ? (e.id || e.className || e.tagName) : null; })()`);
  ok('걷힌 뒤 클릭을 안 삼킨다', !/loadgate|lcat|lword|lspin/.test(String(hit)), '가운데에서 잡히는 것: ' + hit);
  ok('보통 방문 · 콘솔 오류 0', errs.length === 0, errs.slice(0, 3).join(' | '));

  /* ---------------- 1-b. 그림: 판이 떠 있는 실제 화면 ----------------
     보통 속도로는 판이 몇백 ms 만 떠 있어서(로컬 서버라 모듈이 금방 온다) 찍기 전에
     걷힌다 — 첫 회차의 그림이 실제로 프롤로그였다. **CPU 를 눌러** 그 구간을 늘린다.
     느리게 만든 것이지 다른 화면을 만든 것이 아니다. */
  console.log('\n── 판이 떠 있는 화면 (CPU 8배 감속) ──');
  await send('Emulation.setCPUThrottlingRate', { rate: 8 });
  await send('Page.navigate', { url: BASE + '/index.html?3d=1' });
  /* **CSS 가 붙기를 기다린다.** 700ms 로 고정해 뒀더니 스타일시트 전이라
     .lcat 이 폭 1184px 짜리 맨 블록이었고(그림도 없다), 그 그림은 아무것도 안 보여준다.
     z-index 가 9500 이면 이 절이 적용된 것이다. */
  for (let i = 0; i < 120; i++){
    if (await ev(`getComputedStyle(document.getElementById('loadgate')||document.body).zIndex === '9500'`)) break;
    await sleep(100);
  }
  const up = await ev(GATE);
  const shot = await send('Page.captureScreenshot', { format:'png', clip:{x:0,y:0,width:1200,height:800,scale:1} });
  fs.writeFileSync(OUT + 'load-live.png', Buffer.from(shot.data, 'base64'));
  await send('Emulation.setCPUThrottlingRate', { rate: 1 });
  console.log('   ' + JSON.stringify(up));
  ok('감속해도 판이 화면을 덮고 있다', !!up && up.보임 === true && up.덮음 === true);

  /* ---------------- 2. 도트 폴백(?3d=0) ---------------- */
  console.log('\n── ?3d=0 (도트) ──');
  errs = [];
  await send('Page.navigate', { url: BASE + '/index.html?3d=0' });
  let dot = null;
  for (let i = 0; i < 100; i++){
    const g = JSON.parse(await ev(`JSON.stringify(window.__gate||{})`) || '{}');
    if (g.hidden > 0){ dot = g; break; }
    await sleep(150);
  }
  ok('도트에서도 판이 걷힌다', !!dot,
     dot ? `판이 떠 있던 시간 ${Math.round(dot.hidden - dot.shown)}ms` : '갇혔다');
  ok('도트 · 콘솔 오류 0', errs.length === 0, errs.slice(0, 3).join(' | '));

  /* ---------------- 3. 모듈을 못 불러오는 자리 ----------------
     file:// 로 소스 트리를 열면 모듈이 CORS 로 막혀 index.html 의 onerror 가 뜬다.
     20번이 「포기한다」 경로로 만들어 둔 그 갈래이고, **여기서 안 걷히면 갇힌다.** */
  console.log('\n── file:// 소스 트리 (모듈 onerror) ──');
  errs = [];
  await send('Page.navigate', { url: 'file:///' + ROOT.replace(/\\/g, '/') + 'index.html' });
  let fileG = null;
  for (let i = 0; i < 120; i++){
    const g = JSON.parse(await ev(`JSON.stringify(window.__gate||{})`) || '{}');
    if (g.hidden > 0){ fileG = g; break; }
    await sleep(200);
  }
  const fstate = await ev(`(() => { const n = document.querySelector('.nogl');
    return { r3fail: !!window.__r3fail, 안내판: !!n,
             글: n ? (n.textContent||'').trim().slice(0, 40) : null }; })()`);
  console.log('   ' + JSON.stringify(fstate));
  ok('모듈을 못 불러와도 판이 걷힌다', !!fileG,
     fileG ? `판이 떠 있던 시간 ${Math.round(fileG.hidden - fileG.shown)}ms` : '갇혔다');
  /* 예전에는 「도트로 떨어져 있다」를 쟀다. 48번에서 도트판을 지우면서 떨어질 데가
     없어졌고, 대신 **왜 못 그렸는지 말하는 판**(ui.js stageFail)이 들어왔다.
     빈 화면은 사고로 읽히고 문장 하나는 사고 보고로 읽힌다 — 그걸 잰다. */
  ok('그때 왜 못 그렸는지 말해 준다 (빈 화면이 아니다)', fstate.안내판 === true,
     fstate.글 ? `「${fstate.글}」` : '판이 없다');

  /* ---------------- 4. 배포본 ---------------- */
  console.log('\n── 배포본에 실렸나 ──');
  const idx = fs.readFileSync(ROOT + 'index.html', 'utf8');
  ok('index.html 에 판이 마크업으로 있다', /id="loadgate"/.test(idx));
  const css = fs.readFileSync(ROOT + 'style.css', 'utf8');
  ok('style.css 의 LOADCAT 구간에 그림이 박혀 있다',
     /LOADCAT:BEGIN[\s\S]*data:image\/png[\s\S]*LOADCAT:END/.test(css));
  for (const f of ['dist/copycat.html', 'dist/android/index.html', 'dist/iphone/index.html']){
    if (!fs.existsSync(ROOT + f)){ console.log(`  ·  ${f} 없음 — 다시 말면 확인된다`); continue; }
    const h = fs.readFileSync(ROOT + f, 'utf8');
    ok(`${f} 에 실렸다`, h.includes('id="loadgate"'));
  }

  /* ---------------- 5. 폰 배포본 ----------------
     여기가 이 화면의 본론이다. 설치해 두고 켜는 물건이라 **켤 때마다** 이 판을 보고,
     그때 실행 사슬은 스플래시 → 로딩 판 → 프롤로그다. 색이 어긋나면 가운데가 번쩍인다. */
  console.log('\n── 폰 배포본 (390×780) ──');
  for (const p of ['android', 'iphone']){
    if (!fs.existsSync(ROOT + 'dist/' + p + '/index.html')){ console.log('  ·  dist/' + p + ' 없음'); continue; }
    errs = [];
    await send('Emulation.setDeviceMetricsOverride', { width:390, height:780, deviceScaleFactor:2, mobile:true });
    await send('Emulation.setCPUThrottlingRate', { rate: 6 });
    await send('Page.navigate', { url: BASE + '/dist/' + p + '/index.html' });
    for (let i = 0; i < 150; i++){
      if (await ev("getComputedStyle(document.getElementById('loadgate')||document.body).zIndex === '9500'")) break;
      await sleep(100);
    }
    const g = await ev(GATE);
    const extra = await ev(`(() => {
      const gg = document.getElementById('loadgate');
      const cs = getComputedStyle(gg);
      const cat = gg.querySelector('.lcat').getBoundingClientRect();
      return { 판색: cs.backgroundColor, 고양이폭: Math.round(cat.width),
        가로오버플로: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    })()`);
    console.log('   ' + p + ': ' + JSON.stringify(g) + ' ' + JSON.stringify(extra));
    ok(p + ' 폰 폭에서 판이 화면을 덮는다', !!g && g.보임 === true && g.덮음 === true);
    ok(p + ' 고양이가 폰 치수(190px)로 앉는다', extra.고양이폭 === 190, extra.고양이폭 + 'px');
    ok(p + ' 스피너가 머리 안에 있다', !!g && g.스피너안 === true);
    ok(p + ' 가로 오버플로 0', extra.가로오버플로 === 0);
    ok(p + ' 판 색이 크림이다', extra.판색 === 'rgb(255, 246, 233)', extra.판색);
    ok(p + ' 콘솔 오류 0', errs.length === 0, errs.slice(0, 2).join(' | '));
    await send('Emulation.setCPUThrottlingRate', { rate: 1 });

    /* ---- 그림: **스크립트를 막고** 찍는다 ----
     그냥 찍으면 늦는다. 판이 걷히는 전이가 0.3초라 「보임」을 읽은 뒤 찍는 사이에
     이미 프롤로그의 검은 화면이 되어 있었다(실제로 두 번 그랬다).
     낱개 스크립트를 막으면 boot 이 안 돌아서 판이 걷힐 수 없다 —
     그리고 이건 **판이 JS 없이 HTML+CSS 만으로 뜬다**는 증거이기도 하다. */
    await send('Network.enable');
    await send('Network.setBlockedURLs', { urls: ['*/js/*.js*'] });
    await send('Page.navigate', { url: BASE + '/dist/' + p + '/index.html?shot=1' });
    for (let i = 0; i < 150; i++){
      if (await ev("getComputedStyle(document.getElementById('loadgate')||document.body).zIndex === '9500'")) break;
      await sleep(100);
    }
    await sleep(600);
    const still = await ev(GATE);
    ok(p + ' 스크립트가 없어도 판이 뜬다 (HTML+CSS 만)',
       !!still && still.보임 === true && still.덮음 === true && still.그림 === true);
    /* 설치 안내(#pwaBar · iOS 안내 띠)가 판 위로 올라오면 로딩 화면이 가려진다.
       그 띠는 인라인 스크립트가 만들므로 js/*.js 를 막아도 살아 있다 —
       그래서 여기서 잡을 수 있다. r3ready 뒤로 미뤘으니 지금은 없어야 한다. */
    const bar = await ev(`(() => {
      const on = [...document.querySelectorAll('body > *')].filter(e => {
        if (e.id === 'loadgate' || e.id === 'app') return false;
        const cs = getComputedStyle(e);
        return cs.position === 'fixed' && cs.visibility !== 'hidden' && +cs.opacity > 0.02
               && e.getBoundingClientRect().height > 0;
      }).map(e => e.id || e.tagName);
      return JSON.stringify(on);
    })()`);
    ok(p + ' 로딩 중에 설치 안내가 안 올라온다', bar === '[]', bar);
    const sh = await send('Page.captureScreenshot', { format:'png', clip:{x:0,y:0,width:390,height:780,scale:1} });
    fs.writeFileSync(OUT + 'load-dist-' + p + '.png', Buffer.from(sh.data, 'base64'));
    await send('Network.setBlockedURLs', { urls: [] });
  }

  /* 켤 때의 바탕이 판과 같은 색인가 — 다르면 스플래시에서 로딩으로 넘어갈 때 번쩍인다 */
  const mf = ROOT + 'dist/android/manifest.webmanifest';
  if (fs.existsSync(mf)){
    const j = JSON.parse(fs.readFileSync(mf, 'utf8'));
    ok('안드로이드 켤 때 바탕이 판과 같은 크림', j.background_color === '#FFF6E9', j.background_color);
  }
  /* 아이폰 스플래시 — 실제 픽셀을 읽는다. 구석이 크림이고 가운데 위쪽에 고양이가 있어야 한다. */
  const sp = ROOT + 'dist/iphone/splash-390x844@3.png';
  if (fs.existsSync(sp)){
    const { decodePNG } = require(ROOT + 'tools/png.js');
    const { w, h, rgba } = decodePNG(sp);
    const at = (x, y) => { const i = (y * w + x) * 4; return [rgba[i], rgba[i+1], rgba[i+2]]; };
    const corner = at(4, 4);
    let dark = 0;
    for (let y = Math.round(h * 0.34); y < Math.round(h * 0.46); y++)
      for (let x = Math.round(w * 0.35); x < Math.round(w * 0.65); x++){
        const c = at(x, y); if (c[0] < 120 && c[1] < 120) dark++;
      }
    console.log('   스플래시 ' + w + '×' + h + ' 구석 rgb(' + corner.join(',') + ') · 어두운 칸 ' + dark);
    ok('아이폰 스플래시 바탕이 크림이다',
       corner[0] === 255 && corner[1] === 246 && corner[2] === 233, 'rgb(' + corner.join(',') + ')');
    ok('아이폰 스플래시에 고양이가 있다', dark > 2000, '어두운 칸 ' + dark);
  }


  console.log(`\n${fail ? '❌' : '✅'} ${pass}/${pass + fail} 통과${fail ? ` · ${fail} 실패` : ''}`);
  console.log('그림: spike/ui/load-live.png');
  ws.close(); chrome.kill();
  process.exit(fail ? 1 : 0);
})();
