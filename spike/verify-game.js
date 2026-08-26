/* 실제 게임(index.html)이 3D 렌더러로 뜨는지 확인한다.
   모듈이라 file:// 로는 못 열고 서버가 필요하다 — serve.js 를 띄운 뒤 이걸 돌린다.
   node spike/serve.js &   node spike/verify-game.js [?3d=1] */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const { decodePNG } = require('../tools/png.js');
const PORT = 9351, W = 1440, H = 900;
/* 인자가 / 로 시작하면 그 경로를 그대로 연다 (스파이크 페이지 확인용).
   아니면 게임 index.html 의 쿼리로 본다. */
const ARG = process.argv[2] || '?3d=1';
/* 다른 서버를 보게 할 수 있다 — 배포 zip 을 풀어 띄운 걸 그대로 검사할 때 쓴다.
   COPYCAT_BASE=http://localhost:8199 node spike/verify-game.js "" */
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const URL_ = BASE + (ARG.startsWith('/') ? ARG : '/index.html' + ARG);
const OUT = path.join(__dirname, 'dist', 'shots');

/* 경로는 슬래시로 쓴다 — 윈도우도 받아주고, 이스케이프 때문에 조용히 깨지지 않는다. */
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe',
].find(p => p && fs.existsSync(p));
if (!CHROME) throw new Error('크롬을 못 찾았다');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'cdp-game-' + PORT),
    'about:blank'], { stdio: 'ignore' });

  let page;
  for (let i = 0; i < 60 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
    if (!page) await sleep(250);
  }
  if (!page) throw new Error('크롬이 안 뜬다');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); const errors = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errors.push('console: ' + m.params.args.map(a => a.value || a.description || '').join(' '));
    if (m.method === 'Runtime.exceptionThrown')
      errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error')
      errors.push(m.params.entry.text + ' ' + (m.params.entry.url || ''));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width:W, height:H, deviceScaleFactor:2, mobile:false });
  await send('Page.navigate', { url: URL_ });
  /* 모듈 14개 + three.js 를 받아 평가하는 데 걸리는 시간이다. 소프트웨어 렌더에 다른 창까지
     떠 있는 기계에서 재 보면 R3.ready 까지 8초를 넘긴다(측정: 클래식 4.6s → 모듈 8.4s).
     6.5초로 잡아 두면 기계가 조금만 바빠도 "R3 없음"이 뜨고, 그건 게임의 문제가 아니라
     이 파일의 문제다 — 없는 회귀를 쫓게 만드는 검사가 제일 나쁘다. */
  await sleep(13000);

  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true })).result?.value;

  /* 큰 사무실로 올려서 본다 — 칸막이(휴게실·회의실)는 등급이 올라야 생기고,
     바닥 구멍은 그 칸막이 자리에서만 나타난다. */
  if (process.env.BIG){
    /* 큰 사무실로 올려서 본다 — 칸막이(휴게실·회의실)는 등급이 올라야 생기고,
       바닥 구멍은 그 칸막이 자리에서만 나타난다. */
    const q = Number(process.env.BIG) || 22;
    console.log('사무실 확대:', await ev(
      "(() => { S.tier = Math.min(TIERS.length - 1, " + q + ");"
      + (process.env.BUYALL ? " SHOP.forEach(it => { if (it.tier <= S.tier) S.shop[it.id] = true; });" : "")
      + " buildWorld(true); renderTiles();"
      + " return W.W + 'x' + W.H + ' · 비품 ' + Object.keys(S.shop).length; })()"));
    await sleep(2500);
  }
  const state = await ev(`JSON.stringify({
    r3: typeof R3 !== 'undefined' && !!R3, ready: typeof R3 !== 'undefined' && !!R3 && !!R3.ready,
    glShown: (document.getElementById('gl')||{}).style?.display !== 'none',
    cats: (typeof S !== 'undefined' && S.cats) ? S.cats.length : -1,
    tier: (typeof W !== 'undefined' && W) ? W.W + 'x' + W.H : '-',
    info: (typeof R3 !== 'undefined' && R3 && R3.info && R3.info()) || null,
  })`);
  /* 상호작용 확인 — 배치 모드를 켜고 가구 한 칸을 집어 본다.
     클릭 좌표는 카메라가 정하므로, 격자 좌표를 화면으로 되투영해서 그 자리를 찍는다. */
  const pick = ARG.startsWith('/') ? '-' : await (async () => {
    const r = await send('Runtime.evaluate', { returnByValue:true, expression:`(() => {
      if (typeof R3 === 'undefined' || !R3.ready || !W) return 'R3 없음';
      // 격자에서 가구 한 칸을 찾는다
      let f = null;
      for (let y = 1; y < W.H - 1 && !f; y++)
        for (let x = 1; x < W.W - 1; x++){
          const t = W.grid[y*W.W + x];
          if (t === TILE.DESK || t === TILE.COOLER || t === TILE.PLANT || t === TILE.SHELF){ f = {x,y,t}; break; }
        }
      if (!f) return '가구 없음';
      const p = R3.project(f.x, f.y, 0);          // 그 칸의 화면 좌표
      if (!p) return '투영 실패';
      const box = document.getElementById('gl').getBoundingClientRect();
      const cx = box.left + p.x, cy = box.top + p.y;
      const back = R3.pickTile(cx, cy);           // 다시 광선을 쏴서 같은 칸이 나오나
      /* 벽에 걸린 것도 집히는가 — 액자 하나를 화면으로 투영해 그 자리를 쏴 본다 */
      let wall = 'wallDecor 없음';
      const wd = (W.wallDecor || [])[0];
      if (wd){
        const wp = R3.project(wd.x, wd.y + 1, 1.5);
        if (wp){
          const t2 = R3.pickTile(box.left + wp.x, box.top + wp.y);
          const u2 = t2 && unitAt(t2.x, t2.y);
          wall = JSON.stringify({ at:[wd.x, wd.y], got:t2, kind:u2 && u2.kind });
        }
      }
      toggleEdit(true);
      const u = unitAt(f.x, f.y);
      if (u){ EDIT.sel = u; editRefresh(); }
      const okMark = !!document.getElementById('gl');
      return JSON.stringify({ tile:[f.x,f.y], roundtrip: back && back.x===f.x && back.y===f.y,
                              picked: !!u, editOn: EDIT.on, wall });
    })()` });
    return r.result?.value;
  })();
  if (!ARG.startsWith('/')) console.log('채용 화면:', await ev(`(() => { try {
    /* 빈 자리가 없으면 채용 창은 뜨지 않는 게 맞다(showHire 가 막는다).
       기본 사무실은 책상 2개라 고양이가 둘이면 이 상태가 정상이다 — 자리를 하나 비우고 본다. */
    S.anchovy = 999999;
    const seats = deskCount() - S.cats.length;
    if (seats <= 0) S.cats.pop();
    showHire();
    /* 앞 단계에서 연 고양이 카드가 아직 떠 있다. 창은 쌓이므로 맨 위(마지막)를 본다 —
       첫 번째를 집으면 채용창이 아니라 카드가 잡혀서 없는 버튼을 누르게 된다. */
    const vs = document.querySelectorAll('.veil');
    const v = vs[vs.length - 1];
    if (!v) return '창이 안 열림';
    const dr = v.querySelector('#hireDraw');
    const out = { draws: (window.CAT_DRAWS||[]).length,
                  mode: dr ? '그림 선택' : '털색/색조',
                  options: dr ? dr.querySelectorAll('.swatch').length : -1 };
    if (dr){ const b = dr.querySelectorAll('.swatch')[2]; if (b) b.click(); }
    out.picked = candidateCat().draw;
    v.querySelector('#hireGo').click();
    out.cats = S.cats.length;
    out.lastDraw = S.cats[S.cats.length-1].draw;
    return JSON.stringify(out);
  } catch(e){ return '오류: ' + (e && e.message || e); } })()`));
  if (!ARG.startsWith('/')) console.log('고양이 대조:', await ev(`JSON.stringify(
    S.cats.map(c => ({ id:c.id, name:c.name, fur:c.fur, hue:c.hue,
                       st:(c.act||{}).s, at:[c.x, c.y] })))`));
  if (!ARG.startsWith('/')) console.log('고양이 진단:', await ev(`JSON.stringify(R3.debug())`));
  if (process.argv[3] === 'nostatic'){
    // 사무실을 숨기고 고양이만 남긴다 — 안 보이는 게 가림 때문인지 렌더 때문인지 가른다
    await ev(`(() => { R3.__hide = true; })()`);
    await ev(`(() => {
      const s = R3.debug(); return s.actors;
    })()`);
    await send('Runtime.evaluate', { expression:"R3.hideStatics && R3.hideStatics(true)" });
    await sleep(900);
  }
  if (!ARG.startsWith('/')) console.log('이름표:', await ev(`JSON.stringify({
    boxes: document.querySelectorAll('#tags3d').length,
    tags: document.querySelectorAll('#tags3d .tag3d').length,
    overStage: [...document.querySelectorAll('body *')].filter(e => {
      if (e.children.length) return false;
      if ((e.textContent||'').trim() !== S.cats[0].name) return false;
      const r = e.getBoundingClientRect(), v = document.getElementById('viewport').getBoundingClientRect();
      return r.left >= v.left && r.right <= v.right && r.top >= v.top && r.bottom <= v.bottom;
    }).map(e => e.tagName + '.' + (e.className||'-') + '@' + (e.parentElement||{}).id),
    texts: [...document.querySelectorAll('#tags3d .tag3d')].map(e => e.textContent),
    cats: S.cats.length, npcs: (typeof NPCS !== 'undefined' ? NPCS.length : -1),
    actorDom: document.querySelectorAll('#actors .actor').length,
  })`));
  if (!ARG.startsWith('/')) console.log('치즈 라벨 전수조사:', await ev(`JSON.stringify(
    [...document.querySelectorAll('*')]
      .filter(e => e.children.length === 0 && (e.textContent||'').trim() === S.cats[0].name)
      .map(e => { const r = e.getBoundingClientRect();
        return { tag:e.tagName, cls:e.className, id:e.id,
                 parent:(e.parentElement||{}).id || (e.parentElement||{}).className,
                 x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width) }; }))`));
  if (!ARG.startsWith('/')) console.log('배치 모드 왕복:', pick);
  // 선택 표시판은 배치 모드의 유일한 시각 피드백이다 — 선택한 *뒤에* 확인해야 한다
  console.log('선택 후 표시판:', await ev(`JSON.stringify((R3.info()||{}).marks || [])`));

  /* 모듈이 안 올라왔으면 왜인지 직접 받아본다.
     배포본(file://)에서는 모듈이 HTML 안에 접혀 들어가 있어서 파일이 아예 없다 —
     거기서는 R3 가 떴는지만 본다. 절대경로로 받아보면 file:///C:/js/... 를 찾다가
     CORS 로 막혀서, 멀쩡한 배포본을 고장난 것처럼 보이게 만든다. */
  const inlined = await ev("!!document.getElementById('__mods')");
  const imp = inlined
    ? (await ev('typeof window.R3') === 'object' ? '접어 넣음 (R3 살아 있음)' : '접어 넣음 — R3 없음')
    : (await send('Runtime.evaluate', { expression:"import('/js/render3d.js').then(()=>'ok',e=>String(e&&e.message||e))", returnByValue:true, awaitPromise:true })).result?.value;
  console.log('module import:', imp);

  if (ARG.startsWith('/')) console.log('컷아웃 진단:', await ev(`JSON.stringify(
    (window.__made||[]).slice(0,4).map(m => {
      const p = m.obj.plane, t = p && p.material && p.material.map;
      return { label:m.label, hasPlane:!!p, visible:p && p.visible,
               tex: t ? [t.image && t.image.width, t.image && t.image.height] : null,
               needsUpdate: t ? t.needsUpdate : null,
               geo: p ? [p.geometry.parameters && p.geometry.parameters.width,
                         p.geometry.parameters && p.geometry.parameters.height] : null };
    }))`));

  if (ARG.startsWith('/')) console.log('캔버스 픽셀:', await ev(`JSON.stringify(
    (window.__made||[]).slice(0,2).map(m => {
      const c = m.obj.plane.material.map.image;
      if (!c || !c.getContext) return { note:'canvas 아님', kind:String(c && c.constructor && c.constructor.name) };
      const g = c.getContext('2d');
      const mid = g.getImageData(Math.floor(c.width/2), Math.floor(c.height/2), 1, 1).data;
      const corner = g.getImageData(1, 1, 1, 1).data;
      let opaque = 0;
      const d = g.getImageData(0,0,c.width,c.height).data;
      for (let i = 3; i < d.length; i += 4*11) if (d[i] > 128) opaque++;
      return { size:[c.width,c.height], mid:[...mid], corner:[...corner], opaqueSamples:opaque };
    }))`));

  if (ARG.startsWith('/') && process.argv[3] === 'noalpha'){
    // 알파를 끄고 그린다 — 판이 사각형으로 보이면 텍스처 알파 문제, 그래도 안 보이면 다른 문제다
    console.log('알파 끔:', await ev(`(() => {
      (window.__made||[]).slice(0,4).forEach(m => {
        const mt = m.obj.plane.material;
        mt.transparent = false; mt.alphaTest = 0; mt.needsUpdate = true;
      });
      return 'ok';
    })()`));
    await sleep(800);
  }

  const r = await send('Page.captureScreenshot', { format:'png', clip:{ x:0, y:0, width:W, height:H, scale:1 } });
  const file = path.join(OUT, ARG.startsWith('/') ? path.basename(ARG).replace(/\.html$/, '') + '.png'
                                          : 'game' + (URL_.includes('3d=1') ? '-3d' : '-2d') + '.png');
  fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  const { rgba } = decodePNG(file);
  const seen = new Set();
  for (let i = 0; i < rgba.length; i += 4 * 37) seen.add((rgba[i]>>3<<10)|(rgba[i+1]>>3<<5)|(rgba[i+2]>>3));

  const st = JSON.parse(state);
  console.log(JSON.stringify(st, null, 1));
  console.log('색', seen.size, '종 · 오류', errors.length);
  errors.slice(0, 8).forEach(e => console.log('  ⚠', String(e).split('\n')[0]));
  console.log('shot →', path.relative(process.cwd(), file));
  ws.close(); chrome.kill();
  process.exit(errors.length || !st.ready ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
