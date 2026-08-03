/* ============================================================
   capture-store.js — 스토어 페이지에 올릴 스크린샷과 커버 GIF를 뽑는다.

   itch.io 페이지에서 제일 많은 일을 하는 건 움직이는 그림 한 장이다. 이 게임의
   한 문장은 "할 일을 체크하면 고양이가 서류를 물고 간다"이므로, 커버 GIF는
   그 장면이어야 한다. 설명을 읽게 만들면 이미 진 것이다.

   헤드리스 크롬을 CDP로 몰아 실제 게임을 찍는다. 목업이 아니라 진짜 화면이라
   게임이 바뀌면 다시 돌리기만 하면 된다.

   실행: node tools/capture-store.js [--url <파일 URL>]
   출력: dist/store/*.png · dist/store/cover.gif
   ============================================================ */
const fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
const { decodePNG } = require('./png.js');
const { encodeGIF } = require('./gif.js');

const ROOT = path.join(__dirname, '..') + path.sep;
const OUT = ROOT + 'dist' + path.sep + 'store' + path.sep;
const PORT = 9345;
const W = 1440, H = 900;
const GIF_W = 630, GIF_H = 500, GIF_FRAMES = 40, GIF_MS = 100;

const argUrl = process.argv.indexOf('--url');
const URL = argUrl > -1 ? process.argv[argUrl + 1]
  : 'file:///' + (ROOT + 'index.html').replace(/\\/g, '/');

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
].find(p => fs.existsSync(p));
if (!CHROME){ console.error('크롬을 못 찾았다'); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(process.env.TEMP || '.', 'cdp-store-' + PORT),
    '--allow-file-access-from-files', 'about:blank',
  ], { stdio: 'ignore' });

  let page;
  for (let i = 0; i < 60 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
    if (!page) await sleep(250);
  }
  if (!page) throw new Error('크롬이 안 뜬다');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const errors = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)){ pending.get(m.id)(m.result); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown')
      errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error')
      errors.push(m.params.entry.text + ' ' + (m.params.entry.url || ''));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

  const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
  const shot = async (name, clip) => {
    const r = await send('Page.captureScreenshot', { format: 'png', clip: { ...(clip || { x:0, y:0, width:W, height:H }), scale: 1 } });
    const buf = Buffer.from(r.data, 'base64');
    fs.writeFileSync(OUT + name, buf);
    console.log('  ' + name.padEnd(20) + (buf.length / 1024).toFixed(0) + ' KB');
    return buf;
  };

  /* 저장을 비우고 새 회사로 시작한다 — 스크린샷은 늘 같은 출발점이어야 한다. */
  await send('Page.navigate', { url: URL });
  await sleep(1500);
  await ev(`localStorage.clear()`);
  await send('Page.navigate', { url: URL });
  await sleep(2600);
  await ev(`document.querySelectorAll('.modal [data-close], .modal .okbtn').forEach(b=>b.click())`);
  await sleep(400);

  console.log('스크린샷');
  /* 1) 아무것도 안 한 사무실 — 첫인상 */
  await shot('01-office.png');

  /* 2) 할 일을 넣고 체크 → 서류가 결재함에 떨어지고 고양이가 가지러 간다.
        이 게임의 한 문장이 그거라 커버 GIF도 같은 장면에서 찍는다. */
  const TASKS = [
    { t: '분기 보고서 정리', s: 's' }, { t: '거래처 회신', s: 's' },
    { t: '창고 재고 확인', s: 's' }, { t: '신규 라인 검토', s: 'l' },
  ];
  for (const k of TASKS){
    await ev(`(()=>{document.querySelector('.size[data-size="${k.s}"]').click();
      const i=document.querySelector('#todoInput'); i.value=${JSON.stringify(k.t)};
      i.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#btnAdd').click();})()`);
    await sleep(250);
  }
  await ev(`document.querySelectorAll('#todoList .todo .chk').forEach((b,i)=>{ if(i<3) b.click(); })`);
  await sleep(1600);
  await shot('02-inbox.png');

  /* 3) 인사 기록 — 처음 켠 회사의 기록부는 전부 "기록 없음"이라 스토어에 쓸 게 없다.
        그래서 실제로 굴린다. 게임 시계가 진짜 시계라 서류 한 장에 35초씩 걸리므로
        기다리는 수밖에 없다 — 대신 화면에 찍히는 숫자는 전부 시뮬레이션이 만든 진짜다. */
  await ev(`S.cats.forEach(c=>{ c.needs.fun = 8; c.needs.bladder = 8; })`);   // 시설로 보내는 것만 앞당긴다
  const deadline = Date.now() + 240000;
  let st = null;
  while (Date.now() < deadline){
    st = JSON.parse(await ev(`(()=>{const r=(S.cats[0]&&S.cats[0].rec)||{docs:{}},d=r.docs||{};
      return JSON.stringify({docs:(d.s||0)+(d.m||0)+(d.l||0), fac:Object.keys(r.fac||{}).length, first:!!r.first});})()`));
    if (st.docs >= 2 && st.fac >= 1) break;
    await sleep(2500);
  }
  console.log(`  (기록 쌓임: 서류 ${st.docs}건 · 시설 ${st.fac}종)`);
  await ev(`showCat(S.cats[0].id)`);
  await sleep(500);
  await shot('03-record.png');
  await ev(`document.querySelectorAll('.modal [data-close], .modal .okbtn').forEach(b=>b.click())`);
  await sleep(300);

  /* 4) 배치 모드 — 초록/빨강 판정이 보이는 화면 */
  await ev(`document.querySelector('#btnEdit').click()`);
  await sleep(600);
  await shot('04-decorate.png');
  await ev(`document.querySelector('#btnEdit').click()`);
  await sleep(400);

  /* 5) 사보 — 이 회사가 무슨 회사인지가 여기서 드러난다 */
  await ev(`document.querySelector('.tab[data-tab="log"]').click()`);
  await sleep(500);
  await shot('05-news.png');
  await ev(`document.querySelector('.tab[data-tab="staff"]').click()`);
  await sleep(300);

  /* ---------- 커버 GIF ---------- */
  /* 사무실 한가운데를 잘라 낸다. 2배로 그려진 도트라 원본 배율로 찍어야 선명하다. */
  const box = JSON.parse(await ev(
    `JSON.stringify((r=>({x:r.x,y:r.y,w:r.width,h:r.height}))(document.querySelector('#viewport').getBoundingClientRect()))`));
  const clip = {
    x: Math.round(box.x + Math.max(0, (box.w - GIF_W) / 2)),
    y: Math.round(box.y + Math.max(0, (box.h - GIF_H) / 2)),
    width: Math.min(GIF_W, Math.round(box.w)), height: Math.min(GIF_H, Math.round(box.h)),
  };
  console.log(`커버 GIF ${clip.width}x${clip.height} · ${GIF_FRAMES}프레임`);

  // 서류를 계속 흘려 넣어 프레임마다 뭔가 움직이게 한다
  await ev(`(()=>{const i=document.querySelector('#todoInput');
    ['서류 정리','전표 확인','반려 처리'].forEach(t=>{ i.value=t;
      i.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#btnAdd').click(); });
    document.querySelectorAll('#todoList .todo .chk').forEach(b=>b.click());})()`);
  await sleep(300);

  const frames = [];
  for (let i = 0; i < GIF_FRAMES; i++){
    const r = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } });
    const img = decodePNG(Buffer.from(r.data, 'base64'));
    frames.push({ rgba: img.rgba, delayMs: GIF_MS, w: img.w, h: img.h });
    await sleep(GIF_MS);
  }
  const gw = frames[0].w, gh = frames[0].h;
  if (frames.some(f => f.w !== gw || f.h !== gh)) throw new Error('프레임 크기가 들쭉날쭉하다');
  const gif = encodeGIF(gw, gh, frames);
  fs.writeFileSync(OUT + 'cover.gif', gif);
  console.log(`  cover.gif           ${(gif.length / 1024).toFixed(0)} KB  (${gw}x${gh})`);

  /* 만든 GIF를 크롬에 다시 물려 본다 — 인코더를 직접 썼으니 "열리는가"까지가 검증이다. */
  const check = 'file:///' + (OUT + '_check.html').replace(/\\/g, '/');
  fs.writeFileSync(OUT + '_check.html',
    `<body style="margin:0;background:#222"><img id="g" src="cover.gif"></body>`);
  await send('Page.navigate', { url: check });
  await sleep(1200);
  const ok = JSON.parse(await ev(`JSON.stringify((g=>({w:g.naturalWidth,h:g.naturalHeight,ok:g.complete}))(document.getElementById('g')))`));
  fs.unlinkSync(OUT + '_check.html');
  console.log(`  GIF 디코드 확인: ${ok.w}x${ok.h} ${ok.ok && ok.w === gw ? '✓' : '✗ 깨졌다'}`);
  if (!ok.ok || ok.w !== gw) process.exitCode = 1;

  if (errors.length){
    console.log('\n콘솔 오류 ' + errors.length + '건');
    errors.slice(0, 10).forEach(e => console.log('   ' + e.slice(0, 160)));
    process.exitCode = 1;
  } else console.log('\n콘솔 오류 없음');

  console.log('\n' + OUT);
  ws.close(); chrome.kill();
  process.exit(process.exitCode || 0);
})();
