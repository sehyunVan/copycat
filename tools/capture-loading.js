/* ============================================================
   capture-loading.js — 로딩 화면을 홍보용으로 찍는다.

   ── 왜 게임을 띄워서 안 찍나 ──
   로딩 판(#loadgate)은 **보이는 창이 좁다**: 시작화면이 z-index 9999 로 그 위를 덮고
   (로딩 판은 9500), 새 회사로 켜면 프롤로그의 검은 화면이 먼저 오고, 3D 가 캐시에서
   바로 서면 아예 스쳐 지나간다. 실제로 그렇게 찍다가 시작화면·검은 화면·게임 화면을
   차례로 찍었다. 사진 한 장을 얻으려고 타이밍 도박을 할 이유가 없다.

   그래서 **그 화면을 그대로 다시 세운다.** 마크업은 index.html 에서 오려 오고
   (베끼지 않는다 — 베끼면 언젠가 게임과 다른 그림이 된다), 그림과 글꼴은 style.css 가
   물고 있는 그 값이다(LOADCAT 구간의 data URI). 자바스크립트는 한 줄도 안 돌린다.

   실행: node tools/capture-loading.js [--out dist/promo]
   출력: dist/promo/loading-1170x2532.png · loading-1920x1080.png
   ============================================================ */
const fs = require('fs'), path = require('path'), http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..') + path.sep;
const argOf = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const OUT = path.join(ROOT, argOf('--out', 'dist/promo')) + path.sep;
const PORT = 9352, CDP = 9353;

/* 찍을 크기. 세로는 폰(스토어·SNS), 가로는 배너·썸네일 자리다. */
const SIZES = [
  { w: 390, h: 844, dsf: 3, name: 'loading-1170x2532.png' },
  { w: 960, h: 540, dsf: 2, name: 'loading-1920x1080.png' },
];

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
].find(p => p && fs.existsSync(p));
if (!CHROME) { console.error('크롬을 못 찾았다'); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* index.html 에서 #loadgate 덩어리를 그대로 오려 온다. 여기서 다시 그리지 않는 이유:
   스피너 열두 갈래·글자·비율이 저쪽에 있고, 둘이 갈리면 홍보 사진이 게임과 다른 화면이 된다. */
function loadgateHTML() {
  const src = fs.readFileSync(ROOT + 'index.html', 'utf8');
  const a = src.indexOf('<div id="loadgate"');
  if (a < 0) throw new Error('index.html 에 #loadgate 가 없다');
  /* 그 div 가 닫히는 자리까지 — 여는 태그를 세어 찾는다(안에 div 가 여럿 있다) */
  let depth = 0, i = a;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = a;
  let m;
  while ((m = re.exec(src))) {
    if (m[0] === '</div>') { depth--; if (depth === 0) { i = m.index + 6; break; } }
    else depth++;
  }
  if (depth !== 0) throw new Error('#loadgate 의 끝을 못 찾았다');
  return src.slice(a, i);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const gate = loadgateHTML();
  console.log('index.html 에서 로딩 판을 오려 왔다 (' + gate.length + '자)');

  /* 게임의 style.css 를 그대로 물린다. body 에는 아무 클래스도 안 붙인다 —
     body.r3ready 가 붙는 순간 그 판은 걷히도록 되어 있다(그게 게임의 규칙이다). */
  const PAGE = '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<link rel="stylesheet" href="/style.css">'
    + '<style>html,body{margin:0;height:100%;background:#FFF6E9}</style>'
    + '</head><body>' + gate + '</body></html>';

  const TYPE = { '.css': 'text/css;charset=utf-8', '.png': 'image/png',
                 '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
  const server = http.createServer((q, r) => {
    const p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/' || p === '/__loading.html') {
      r.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store' });
      return r.end(PAGE);
    }
    fs.readFile(path.join(ROOT, p), (e, d) => {
      if (e) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'Content-Type': TYPE[path.extname(p).toLowerCase()] || 'application/octet-stream',
                         'Cache-Control': 'no-store' });
      r.end(d);
    });
  }).listen(PORT);

  const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--mute-audio',
    '--remote-debugging-port=' + CDP,
    '--user-data-dir=' + path.join(process.env.TEMP || '.', 'cdp-load-' + Date.now()), 'about:blank'],
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

  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return r && r.result ? r.result.value : null;
  };

  for (const s of SIZES) {
    await send('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h, deviceScaleFactor: s.dsf, mobile: s.w < 600 });
    await send('Page.navigate', { url: 'http://localhost:' + PORT + '/__loading.html' });
    /* 글꼴(도트)과 그림이 다 올 때까지 기다린다 — 안 기다리면 글자가 대체 글꼴로 찍힌다 */
    await ev('document.fonts ? document.fonts.ready.then(() => 1) : 1');
    await sleep(1200);
    /* **스피너를 멈춘다.** 열두 갈래가 돌아가는 중간 프레임은 장마다 다르게 찍혀서
       같은 사진을 두 번 못 얻는다. 홍보 사진은 늘 같은 장이어야 한다. */
    await ev("(() => { const st = document.createElement('style');"
      + " st.textContent = '*{animation:none!important;transition:none!important}';"
      + ' document.head.appendChild(st); return 1; })()');
    await sleep(200);
    const seen = await ev("(() => { const g = document.querySelector('#loadgate');"
      + " const c = g && g.querySelector('.lcat'), w = g && g.querySelector('.lword');"
      + " return [!!g && g.offsetHeight, c ? c.offsetWidth : 0, w ? (w.textContent || '').trim() : ''].join(' · '); })()");
    const r = await send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(r.data, 'base64');
    fs.writeFileSync(OUT + s.name, buf);
    console.log('  ' + s.name.padEnd(26) + (buf.length / 1024).toFixed(0) + ' KB   '
      + (s.w * s.dsf) + 'x' + (s.h * s.dsf) + '   [판 · 그림폭 · 글자: ' + seen + ']');
  }

  console.log('');
  console.log('나온 곳: ' + OUT);
  ws.close(); chrome.kill(); server.close(); process.exit(0);
})();
