/* ============================================================
   capture-ending-gif.js — 엔딩 컷신을 GIF 한 장으로 뽑는다.

   엔딩은 **한 저장에 한 번**만 열린다(js/story.js 의 endingSeen). 그래서 손으로
   확인하려면 28분기를 버티거나 저장을 손봐야 하고, 그건 확인이 아니라 노동이다.
   여기서는 새 회사를 세우고 사무실까지 들어간 다음 `playOutro()` 를 직접 부른다 —
   게임이 부르는 그 함수 그대로다(따로 그리면 그건 다른 장면이다).

   ── 시간을 우리가 먹인다 ──
   컷신은 **벽시계**로 돈다(story.js 의 t0/performance.now). 헤드리스는 초당 몇 장밖에
   못 그리니 벽시계로 찍으면 장면이 프레임 사이를 건너뛴다. 그래서 `performance.now` 를
   갈아 끼워 시각을 우리가 밀어 준다. 자막·건너뛰기·로고·축하 문구가 전부 진짜 DOM 이라
   화면에 얹히는 것까지 같이 찍힌다.

   실행: node tools/capture-ending-gif.js [--out dist/promo] [--frames 40] [--w 420] [--h 560]
   출력: <out>/ending.gif  + 장마다 PNG 한 장 (room/grid/watch/logo/done)
   ============================================================ */
const fs = require('fs'), path = require('path'), http = require('http');
const { spawn } = require('child_process');
const { decodePNG } = require('./png.js');
const { encodeGIF } = require('./gif.js');

const ROOT = path.join(__dirname, '..') + path.sep;
const argOf = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const OUT = path.join(ROOT, argOf('--out', 'dist/promo')) + path.sep;
const FRAMES = Math.max(8, +argOf('--frames', 40) | 0);
const W = Math.max(240, +argOf('--w', 420) | 0);
const H = Math.max(240, +argOf('--h', 560) | 0);
const PORT = 9356, CDP = 9357;

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
].find(p => p && fs.existsSync(p));
if (!CHROME) { console.error('크롬을 못 찾았다'); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const TYPE = {
  '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.gif': 'image/gif',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json',
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    fs.readFile(path.join(ROOT, p), (e, d) => {
      if (e) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'Content-Type': TYPE[path.extname(p).toLowerCase()] || 'application/octet-stream',
                         'Cache-Control': 'no-store' });
      r.end(d);
    });
  }).listen(PORT);

  const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--mute-audio',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + CDP,
    '--user-data-dir=' + path.join(process.env.TEMP || '.', 'cdp-end-' + Date.now()), 'about:blank'],
    { stdio: 'ignore' });

  let page;
  for (let i = 0; i < 80 && !page; i++) {
    try { page = (await (await fetch('http://127.0.0.1:' + CDP + '/json/list')).json()).find(t => t.type === 'page'); } catch {}
    if (!page) await sleep(250);
  }
  if (!page) { console.error('크롬이 안 뜬다'); process.exit(1); }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map();
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: true });

  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r && r.exceptionDetails) return '**터짐** ' + ((r.exceptionDetails.exception || {}).description || '');
    return r && r.result ? r.result.value : null;
  };
  const shot = async name => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(r.data, 'base64');
    fs.writeFileSync(OUT + name + '.png', buf);
    return buf;
  };

  const URL = 'http://localhost:' + PORT + '/index.html?mobile=1';
  await send('Page.navigate', { url: URL });
  await sleep(2000);
  await ev('(() => { try { localStorage.clear(); sessionStorage.clear(); return 1; } catch (e){ return 0; } })()');
  await send('Page.navigate', { url: URL });

  const vis = sel => "(() => { const e = [...document.querySelectorAll(" + JSON.stringify(sel) + ")]"
    + " .find(x => x && !x.hidden && x.offsetHeight > 0 && getComputedStyle(x).visibility !== 'hidden');"
    + ' return !!e; })()';
  const click = sel => ev("(() => { const e = [...document.querySelectorAll(" + JSON.stringify(sel) + ")]"
    + " .find(x => x && !x.hidden && x.offsetHeight > 0); if (e) { e.click(); return 1; } return 0; })()");
  const until = async (label, expr, ms) => {
    const end = Date.now() + (ms || 40000);
    while (Date.now() < end) { if (await ev(expr)) return true; await sleep(500); }
    console.log('      (' + label + ' — 안 나타났다)');
    return false;
  };

  console.log('사무실로 들어간다');
  await until('시작화면', vis('#cctitle .go'), 40000);
  await click('#cctitle .go');
  await sleep(2500);
  await ev("(() => { try { if (window.CCOpen && CCOpen.playing()) { CCOpen.jump('letter'); return 1; } } catch (e) {} return 0; })()");
  if (await until('편지', vis('#oLetterGo'), 30000)) await click('#oLetterGo');
  if (await until('근로계약서', vis('#cnGo'), 30000)) await click('#cnGo');
  await until('방이 서기', "(() => document.body.classList.contains('r3ready') && !document.querySelector('.opening'))()", 60000);
  await sleep(2000);
  await click('.coach [data-tut="skip"]');
  await ev("document.querySelectorAll('.veil,.coach,.coachring,#pwaBar').forEach(e => e.remove())");
  await sleep(800);

  /* ── 시각은 **진짜 벽시계**다 ──
     한 번 `performance.now` 를 갈아 끼워 시각을 먹여 봤다(결정적인 프레임 간격을 얻으려고).
     컷신이 그 자리에서 끝나 버렸다 — 이 파일만 그 시계를 쓰는 게 아니라 render3d 의
     고리도 같은 시계를 읽고, 그 고리가 멈추면 `outroSeek` 이 null 을 돌려주고,
     story.js 는 그걸 「끝났다」로 읽는다(그 줄: `if (!st) showLogo()`).
     그래서 시계는 그대로 두고 **찍은 시각을 적는다.** GIF 의 칸 시간은 그 간격이라
     재생 속도가 실제로 보는 속도와 같아진다. 헤드리스가 느려도 장면은 안 건너뛴다. */
  const dur = await ev('(() => { try { const ok = playOutro();'
    + ' return ok ? (R3.outroInfo().dur || 0) : -1; } catch (e){ return "터짐 " + e.message; } })()');
  if (!dur || !(+dur > 0)) { console.error('컷신을 못 열었다 (' + dur + ')'); process.exit(1); }
  console.log('컷신 ' + (+dur).toFixed(1) + '초 · 벽시계로 찍는다');

  const t0 = Date.now();
  const raw = [];                                   // { buf, t }
  const marks = { room: 2.0, grid: 11.0, face: 18.5, turn: 21.5, watch: dur - 4.0 };
  let logoShot = false, doneShot = false;
  while (true) {
    const t = (Date.now() - t0) / 1000;
    /* 상태 셋을 **한 번에** 묻는다 — 헤드리스에서는 CDP 왕복 하나가 0.4초쯤이라,
       세 번 물으면 프레임 간격이 1.8초가 된다(실측). 그러면 GIF 가 슬라이드가 된다. */
    const st = String(await ev("(() => { const e = document.querySelector('.outro');"
      + " return (e ? '1' : '0') + (e && e.classList.contains('logoon') ? '1' : '0')"
      + " + (e && e.classList.contains('doneon') ? '1' : '0'); })()"));
    const alive = st[0] === '1', logoOn = st[1] === '1', doneOn = st[2] === '1';
    if (!alive || t > dur + 24) break;
    const r = await send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(r.data, 'base64');
    raw.push({ buf, t });
    for (const k of Object.keys(marks))
      if (marks[k] !== null && t >= marks[k]) { fs.writeFileSync(OUT + 'ending-' + k + '.png', buf); marks[k] = null; }
    if (logoOn && !logoShot) { fs.writeFileSync(OUT + 'ending-logo.png', buf); logoShot = true; }
    /* 축하 문구는 **0.9초 걸려 나타난다**(story.js 의 transition). 붙자마자 찍으면
       투명한 상태를 찍는다 — 한 번 그렇게 새까만 장을 얻었다. 한 박자 기다렸다 찍는다. */
    if (doneOn && !doneShot) { await sleep(1300); await shot('ending-done'); doneShot = true;
      console.log('축하 문구 : ' + (await ev("(() => { const e = document.querySelector('.outro .odone');"
        + " return e ? (e.textContent||'').replace(/\s+/g,' ').trim().slice(0,60) : '없다'; })()"))); }
    process.stdout.write('.');
  }
  console.log('찍은 장 ' + raw.length + ' · ' + ((Date.now() - t0) / 1000).toFixed(1) + '초');
  if (doneShot) { const last = raw[raw.length - 1]; for (let i = 0; i < 6; i++) raw.push({ buf: last.buf, t: last.t + 0.4 * (i + 1) }); }

  /* 너무 많으면 솎는다 — GIF 한 장에 백 장은 안 들어간다 */
  const KEEP = Math.min(raw.length, FRAMES);
  const pick = [];
  for (let i = 0; i < KEEP; i++) pick.push(raw[Math.round(i * (raw.length - 1) / Math.max(1, KEEP - 1))]);
  const frames = pick.map((f, i) => {
    const img = decodePNG(f.buf);
    const nxt = pick[i + 1];
    const d = nxt ? Math.max(60, Math.min(1400, Math.round((nxt.t - f.t) * 1000))) : 2400;
    return { rgba: img.rgba, w: img.w, h: img.h, delayMs: d };
  });

  const gif = encodeGIF(frames[0].w, frames[0].h, frames);
  fs.writeFileSync(OUT + 'ending.gif', gif);
  console.log('→ ' + OUT + 'ending.gif  (' + Math.round(gif.length / 1024) + ' KB · ' + frames.length + '장)');
  ws.close(); chrome.kill(); server.close(); process.exit(0);
})();
