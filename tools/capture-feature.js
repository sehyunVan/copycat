/* ============================================================
   capture-feature.js — Play 의 **그래픽 이미지**(1024×500) 한 장.

   Play 스토어 목록 맨 위에 뜨는 가로 그림이다. App Store 에는 없고 Play 만 요구한다.

   ── 그리지 않고 찍는다 ──
   포토샵으로 만들면 게임이 바뀔 때 이 한 장만 옛날 화면으로 남는다. 스크린샷과 같은
   규칙으로 **진짜 게임을 찍고**, 그 위에 도트 워드마크와 한 줄을 얹는다. 글꼴도 게임이
   쓰는 그 파일(assets/font/Galmuri11.woff2)이라 로고와 글씨가 한 벌이다.

   ── UI 를 걷고 방만 남긴다 ──
   가로 그림에 폰 UI 가 들어가면 「폰 화면을 늘린 것」으로 보인다. 3D 방(#gl)만 남기고
   나머지는 감춘다 — 이 게임의 첫인상은 사무실 그 자체다.

     node tools/pack-mobile.js       먼저 굽는다
     node tools/serve-mobile.js      다른 창에서 띄운다 (8188)
     node tools/capture-feature.js
   출력: dist/store/feature-1024x500.png
   ============================================================ */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'store');
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8188';
const W = 1024, H = 500;
const PORT = 9380 + (process.pid % 50);
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  try { const r = await fetch(BASE + '/index.html'); if (!r.ok) throw new Error('HTTP ' + r.status); }
  catch (e){ console.log('먼저 띄운다: node tools/serve-mobile.js   (' + BASE + ')'); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });

  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-feat-' + process.pid);
  const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--mute-audio',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio: 'ignore' });
  let page;
  for (let i = 0; i < 80 && !page; i++) {
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
    if (!page) await sleep(250);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map();
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r?.exceptionDetails) throw new Error((r.exceptionDetails.exception?.description || '').slice(0, 300));
    return r?.result?.value;
  };
  /* **배율 1.** Play 가 받는 크기가 정확히 1024×500 이다. 2배로 찍어 줄이면 도트가 흐려진다. */
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE + '/index.html' });

  let up = false;
  for (let i = 0; i < 80 && !up; i++){
    await sleep(700);
    up = await ev(`(()=>{const t=document.querySelector('#cctitle'); if(t) t.remove();
      document.body.classList.remove('titleon');
      return typeof S!=='undefined' && !!S && !!document.querySelector('#gl')})()`).catch(()=>false);
  }
  if (!up){ console.log('게임이 안 섰다'); chrome.kill(); process.exit(1); }
  await sleep(2500);

  /* 방이 잘 보이는 자리로. 카메라는 게임이 원래 가진 손잡이만 쓴다(따라다니기 · 거리). */
  await ev(`(()=>{ try { if (window.R3 && R3.followOn) { R3.followOn(true);
      if (R3.followZoom) R3.followZoom(0.30); } } catch(e){} return 1 })()`).catch(()=>{});
  await sleep(1800);

  /* UI 를 걷는다 — 3D 판(#gl)과 그 부모만 남기고 전부 숨긴다. 지우지 않고 숨기는 이유:
     게임이 계속 돌고 있고, 지우면 다시 그리려다 오류를 낸다.

     ── 왜 인라인 스타일이 아니라 **규칙**인가 ──
     처음엔 `el.style.display='none'` 로 하나씩 숨겼는데 사진기 단추(#btnCam)가 계속
     왼쪽 아래에 까만 네모로 찍혔다. 게임이 배치를 다시 그릴 때 그 단추의 `style.display`
     를 자기가 다시 쓰기 때문이다(중요도 없는 값이라 우리 것을 덮는다).
     그래서 남길 것에 표를 붙이고 **스타일시트 한 장**으로 뒤집는다 — 시트의 !important 는
     게임이 나중에 쓰는 인라인 값보다 세다. */
  await ev(`(()=>{
    const keep = document.querySelector('#gl');
    for (let n = keep; n && n !== document.documentElement; n = n.parentElement) n.dataset.featkeep = '1';
    const css = document.createElement('style');
    css.id = 'featcss';
    /* **숨기는 규칙만 쓴다.** 남길 것에 display:block 을 같이 걸었더니 방이 통째로
       까맣게 나왔다 — 3D 판의 부모들이 flex 로 크기를 잡고 있어서, block 으로 덮는 순간
       캔버스가 0 이 된다. 안 건드리는 것이 남기는 것이다. */
    css.textContent =
      'body *:not([data-featkeep]):not(#feat):not(#featveil):not(#feat *){display:none !important}';
    document.head.appendChild(css);
    document.body.style.background = '#171310';
    return 1 })()`);
  await sleep(600);

  /* 얹는 것: 도트 워드마크 + 한 줄. 글꼴은 게임이 쓰는 그 파일이다.
     왼쪽에 몰아 둔다 — Play 는 기기·자리에 따라 **가장자리를 잘라** 쓴다. */
  /* 워드마크는 **저장소 파일에서 실어 보낸다.** 배포본에는 이 PNG 가 없다 —
     시작화면이 쓰는 워드마크는 js/title.js 안에 data URI 로 박혀 있어서(부팅 첫 프레임에
     떠야 한다) 낱개 파일을 안 담는다. 그걸 모르고 경로로 불렀다가 깨진 네모가 찍혔다. */
  const wordmark = 'data:image/png;base64,' +
    fs.readFileSync(path.join(ROOT, 'assets', 'logo-word-dot.png')).toString('base64');
  await ev(`(()=>{
    const f = new FontFace('Galmuri11', 'url(assets/font/Galmuri11.woff2)');
    document.fonts.add(f); f.load();
    const box = document.createElement('div');
    box.id = 'feat';
    box.innerHTML =
      '<img src="${wordmark}" alt="">' +
      '<b>할 일을 체크하면 고양이가 서류를 물고 갑니다</b>' +
      '<i>당신의 진짜 시계로 도는 사무실</i>';
    const css = document.createElement('style');
    css.textContent = \`
      #feat{position:fixed;left:56px;top:0;height:100%;z-index:99999;
            display:flex;flex-direction:column;justify-content:center;gap:14px;
            font-family:'Galmuri11',monospace;-webkit-font-smoothing:none;
            text-shadow:0 2px 0 rgba(20,14,8,.55), 0 6px 18px rgba(20,14,8,.55)}
      /* 워드마크 원본은 **검정**이다(밝은 시작화면용). 어두운 방 위에서는 안 보이므로
         밝기 0 으로 눌러 실루엣만 남기고 뒤집어 크림으로 만든다. */
      #feat img{width:333px;height:auto;image-rendering:pixelated;display:block;
        filter:brightness(0) invert(1) sepia(.28) saturate(1.4) drop-shadow(0 3px 0 rgba(20,14,8,.5))}
      #feat b{font-size:22px;color:#F3E7D2;font-weight:400;letter-spacing:0}
      #feat i{font-size:11px;color:#E2A25C;font-style:normal;letter-spacing:2px}
      /* 왼쪽 글이 방과 겹쳐 안 읽히지 않게, 왼쪽만 살짝 어둡게 깐다 */
      #featveil{position:fixed;inset:0;z-index:99998;pointer-events:none;
        background:linear-gradient(90deg, rgba(23,19,16,.78) 0%, rgba(23,19,16,.55) 42%, rgba(23,19,16,0) 72%)}\`;
    document.head.appendChild(css);
    const veil = document.createElement('div'); veil.id = 'featveil';
    document.body.appendChild(veil);
    document.body.appendChild(box);
    return 1 })()`);
  await sleep(1200);

  const corner = await ev(`(()=>{ const el = document.elementFromPoint(20, ${H - 20});
    return el ? el.tagName + '.' + (el.className || '') + '#' + (el.id || '') : '(없음)'; })()`).catch(()=>'?');
  console.log('  왼쪽 아래 모서리에 있는 것: ' + corner);

  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const buf = Buffer.from(r.data, 'base64');
  const file = path.join(OUT, 'feature-1024x500.png');
  fs.writeFileSync(file, buf);
  console.log('  feature-1024x500.png  ' + (buf.length / 1024).toFixed(0) + ' KB');
  console.log('→ ' + file);
  ws.close(); chrome.kill(); process.exit(0);
})();
