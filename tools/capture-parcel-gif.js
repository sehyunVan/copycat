/* ============================================================
   capture-parcel-gif.js — 「치즈가 상자를 여는」 GIF.

   이 장면은 게임에 이미 있다: 택배 상자를 뜯는 컷신(js/three/parcel.js · js/gacha.js
   gaOpening). 카메라가 방으로 들어와 그 냥이의 책상에 내려앉고, 고양이가 앞발로
   상자를 두드리고, 뚜껑이 젖혀지며 빛이 샌다 — **그 컷을 그대로 찍는다.** 홍보용으로
   따로 그리지 않는 이유는 늘 같다: 따로 그리면 게임과 다른 그림이 되고, 그건 광고가
   아니라 거짓말이다.

   ── 어떻게 프레임을 뽑나 ──
   컷신은 벽시계로 도는데(gaOpening 의 step), 그 시계로 찍으면 헤드리스가 한 프레임
   그리는 동안 장면이 앞질러 가서 프레임 간격이 들쭉날쭉해진다. 그래서 **시간을 우리가
   먹인다**: R3.parcelSeek(t) 로 t 를 한 칸씩 밀고, 그릴 때마다 한 장 찍는다.
   같은 GIF 를 두 번 만들어도 같은 그림이 나온다.

   실행: node tools/capture-parcel-gif.js [--out dist/promo] [--frames 28] [--px 440]
   출력: dist/promo/cheese-box.gif  (+ 첫·중간·끝 장면 PNG)
   ============================================================ */
const fs = require('fs'), path = require('path'), http = require('http');
const { spawn } = require('child_process');
const { decodePNG } = require('./png.js');
const { encodeGIF } = require('./gif.js');

const ROOT = path.join(__dirname, '..') + path.sep;
const argOf = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const OUT = path.join(ROOT, argOf('--out', 'dist/promo')) + path.sep;
const FRAMES = Math.max(8, +argOf('--frames', 28) | 0);
const PORT = 9354, CDP = 9355;
/* ── 틀은 **창**으로 정한다 ──
   컷신의 카메라는 방 안 한 자리를 겨누고 있어서(js/three/parcel.js), 폰처럼 긴 창에서
   찍고 사각형으로 자르면 고양이 얼굴만 남고 상자가 잘려 나간다 — 두 번 그렇게 잘랐다.
   창을 3:4 로 잡으면 카메라가 가로로 더 보여 주고, 그러면 **자를 것이 없다**:
   고양이와 상자가 한 틀에 같이 선다.
   폭은 460px 아래로 둔다 — 그보다 넓으면 폰 배포본이 방을 420px 상자에 담는다
   (js/col.js 의 phonebox). */
const W = Math.max(240, +argOf('--w', 420) | 0);
const H = Math.max(240, +argOf('--h', 560) | 0);

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
    '--user-data-dir=' + path.join(process.env.TEMP || '.', 'cdp-parcel-' + Date.now()), 'about:blank'],
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
    if (r && r.exceptionDetails) return null;
    return r && r.result ? r.result.value : null;
  };

  const URL = 'http://localhost:' + PORT + '/index.html?mobile=1';
  console.log('새 회사로 시작한다');
  await send('Page.navigate', { url: URL });
  await sleep(2000);
  await ev('(() => { try { localStorage.clear(); sessionStorage.clear(); return 1; } catch (e){ return 0; } })()');
  await send('Page.navigate', { url: URL });

  /* ── 사무실까지 들어가는 길 ──
     여기서 두 번 헛디뎠다. **한 번씩만** 눌러야 하는 걸음을 매초 되풀이했다:
     · #oLetterGo 는 편지 장에 들어가서야 손이 걸리는데(opening.js) 그 전에 눌러 댔고,
     · CCOpen.jump('letter') 는 부를 때마다 그 장을 **다시 시작**해서, 매초 부르면
       영원히 편지 앞에 서 있는다.
     그래서 걸음은 순서대로 한 번, 기다림만 **화면을 보고** 한다. */
  console.log('사무실로 들어간다');
  const vis = sel => "(() => { const e = [...document.querySelectorAll(" + JSON.stringify(sel) + ")]"
    + " .find(x => x && !x.hidden && x.offsetHeight > 0 && getComputedStyle(x).visibility !== 'hidden');"
    + ' return !!e; })()';
  const click = sel => ev("(() => { const e = [...document.querySelectorAll(" + JSON.stringify(sel) + ")]"
    + " .find(x => x && !x.hidden && x.offsetHeight > 0);"
    + ' if (e) { e.click(); return 1; } return 0; })()');
  const until = async (label, expr, ms) => {
    const end = Date.now() + (ms || 40000);
    while (Date.now() < end) {
      if (await ev(expr)) return true;
      await sleep(500);
    }
    console.log('      (' + label + ' — 안 나타났다)');
    return false;
  };

  await until('시작화면', vis('#cctitle .go'), 40000);
  await click('#cctitle .go');
  await sleep(2500);
  /* 프롤로그를 편지 장으로 **한 번** 넘긴다(헤드리스는 초당 두 프레임이라 실시간으로
     기다리면 12초짜리 장이 안 끝난다 — opening.js 의 jump 주석이 그 이야기다). */
  await ev("(() => { try { if (window.CCOpen && CCOpen.playing()) { CCOpen.jump('letter'); return 1; } }"
    + ' catch (e) {} return 0; })()');
  if (await until('편지', vis('#oLetterGo'), 30000)) { await click('#oLetterGo'); }
  if (await until('근로계약서', vis('#cnGo'), 30000)) { await click('#cnGo'); }
  await until('방이 서기', "(() => document.body.classList.contains('r3ready')"
    + " && !document.querySelector('.opening'))()", 60000);
  await sleep(2000);
  await click('.coach [data-tut="skip"]');
  await ev("document.querySelectorAll('.veil,.coach,.coachring,#pwaBar').forEach(e => e.remove())");
  /* 방을 밝힌다 — 저녁에 돌리면 방이 어두워서 GIF 가 검은 사각형이 된다(실측: 4 KB).
     천장등은 게임 안에서도 켜는 것이다. */
  await ev('(() => { try { R3.setCeiling(true); return 1; } catch (e){ return 0; } })()');
  await sleep(800);

  /* 주인공을 고른다. 이름이 치즈인 고양이가 있으면 그 냥이다 — 첫 직원의 이름이고,
     홍보 사진의 얼굴은 늘 같아야 한다. 없으면 첫 직원으로 간다(이름을 찍어 준다). */
  const who = await ev('(() => { try {'
    + " const c = S.cats.find(x => x.name === '치즈') || S.cats[0];"
    + " return c ? c.name : null; } catch (e){ return null; } })()");
  if (!who) { console.error('고양이가 없다'); process.exit(1); }
  console.log('주인공: ' + who);

  /* 컷신을 세운다. **UI 는 게임이 걷는 그 방식으로 걷는다**(body.gacut) —
     우리가 따로 숨기면 어느 날 그 목록이 게임과 달라진다. */
  await ev("document.body.classList.add('gacut')");
  const info = await ev('(() => { try {'
    + " const cat = S.cats.find(x => x.name === '치즈') || S.cats[0];"
    + ' let i = null;'
    + ' for (let k = 0; k < 3 && !i; k++){'
    + '   i = R3.parcelBuild([cat]);'
    + '   if (!i) { try { R3.sync(S.cats, [], 0.016); } catch (e) {} }'
    + ' }'
    + ' return i ? JSON.stringify({ name:i.name, dur:i.dur }) : null;'
    + ' } catch (e){ return null; } })()');
  if (!info) {
    const why = await ev('(() => { try { return R3.parcelWhy ? R3.parcelWhy() : ""; } catch (e){ return ""; } })()');
    console.error('컷신을 못 세웠다: ' + (why || '이유 없음'));
    process.exit(1);
  }
  const { name, dur } = JSON.parse(info);
  console.log('컷신 ' + dur.toFixed(2) + '초 · ' + name);

  /* 방(#viewport) 을 통째로 담는다 — 창을 컷의 비율로 잡았으니 자를 것이 없다 */
  const box = JSON.parse(await ev('JSON.stringify((r => ({ x:r.x, y:r.y, w:r.width, h:r.height }))'
    + "(document.querySelector('#viewport').getBoundingClientRect()))"));
  const cw = Math.round(box.w), ch = Math.round(box.h);
  const clip = { x: Math.round(box.x), y: Math.round(box.y), width: cw, height: ch, scale: 1 };

  console.log('프레임 ' + FRAMES + '장 · ' + cw + 'x' + ch);
  const step = dur / (FRAMES - 1);
  const frames = [];
  for (let i = 0; i < FRAMES; i++) {
    const t = Math.min(dur, i * step);
    await ev('(() => { try { R3.parcelSeek(' + t.toFixed(3) + ', ' + step.toFixed(3) + '); R3.draw(); return 1; }'
      + ' catch (e){ return 0; } })()');
    const r = await send('Page.captureScreenshot', { format: 'png', clip });
    const buf = Buffer.from(r.data, 'base64');
    const img = decodePNG(buf);
    /* GIF 의 한 칸 시간은 **장면의 시간**이다(프레임을 찍는 데 걸린 시간이 아니다) —
       그래야 재생 속도가 게임에서 보는 그 속도가 된다. */
    frames.push({ rgba: img.rgba, w: img.w, h: img.h, delayMs: Math.round(step * 1000) });
    if (i === 0) fs.writeFileSync(OUT + 'cheese-box-first.png', buf);
    if (i === Math.floor(FRAMES / 2)) fs.writeFileSync(OUT + 'cheese-box-mid.png', buf);
    if (i === FRAMES - 1) fs.writeFileSync(OUT + 'cheese-box-last.png', buf);
  }
  /* 마지막 장을 조금 더 붙잡는다 — 뚜껑이 열린 그림이 GIF 의 「표지」다 */
  frames[frames.length - 1].delayMs = 900;

  const gw = frames[0].w, gh = frames[0].h;
  if (frames.some(f => f.w !== gw || f.h !== gh)) throw new Error('프레임 크기가 들쭉날쭉하다');
  const gif = encodeGIF(gw, gh, frames);
  fs.writeFileSync(OUT + 'cheese-box.gif', gif);
  console.log('  cheese-box.gif       ' + (gif.length / 1024).toFixed(0) + ' KB  (' + gw + 'x' + gh + ')');

  /* **만든 GIF 를 다시 열어 본다.** 인코더를 직접 썼으니 「열리는가」까지가 검증이다.
     file:// 로 열었더니 크롬이 이미지를 막아서 「안 열린다」가 나왔다 — 우리 서버로 연다
     (dist 도 ROOT 아래라 그대로 서빙된다). */
  const gurl = 'http://localhost:' + PORT + '/'
    + path.relative(ROOT, OUT + 'cheese-box.gif').split(path.sep).join('/');
  await send('Page.navigate', { url: gurl });
  await sleep(2000);
  const ok = await ev("(() => { const g = document.querySelector('img');"
    + ' return g && g.naturalWidth ? g.naturalWidth + "x" + g.naturalHeight : "안 열린다"; })()');
  console.log('  다시 열어 보니: ' + ok);

  console.log('');
  console.log('나온 곳: ' + OUT);
  ws.close(); chrome.kill(); server.close(); process.exit(0);
})();
