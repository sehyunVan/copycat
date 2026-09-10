/* 상단 줄이 멸치 자릿수에 따라 어떻게 되나 — 칸마다 좌표를 재고 겹침을 센다. */
const fs = require('fs'), path = require('path'), http = require('http');
const { spawn } = require('child_process');
const ROOT = process.env.ROOT_DIR || 'c:/Users/sehyu/playground/copycat/';
const PORT = +(process.env.PORT || 9396), CDP = PORT + 1;
const TAG = process.env.TAG || 'hud';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TYPE = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.gif': 'image/gif', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json' };

(async () => {
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
    '--user-data-dir=' + path.join(process.env.TEMP || '.', 'cdp-hud-' + Date.now()), 'about:blank'],
    { stdio: 'ignore' });
  let page;
  for (let i = 0; i < 80 && !page; i++) {
    try { page = (await (await fetch('http://127.0.0.1:' + CDP + '/json/list')).json()).find(t => t.type === 'page'); } catch {}
    if (!page) await sleep(250);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map();
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const WID = +(process.env.WID || 412);
  await send('Emulation.setDeviceMetricsOverride', { width: WID, height: 915, deviceScaleFactor: 1, mobile: true });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r && r.exceptionDetails) return '**터짐** ' + ((r.exceptionDetails.exception || {}).description || '').split('\n')[0];
    return r.result ? r.result.value : null;
  };
  const shot = async n => { const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(__dirname + '/' + n + '.png', Buffer.from(r.data, 'base64')); };

  const URL = 'http://localhost:' + PORT + '/index.html?mobile=1';
  await send('Page.navigate', { url: URL }); await sleep(1800);
  await ev('(() => { try { localStorage.clear(); sessionStorage.clear(); return 1; } catch (e){ return 0; } })()');
  await send('Page.navigate', { url: URL });
  const vis = sel => "(() => !![...document.querySelectorAll(" + JSON.stringify(sel) + ")].find(x => x && !x.hidden && x.offsetHeight > 0))()";
  const click = sel => ev("(() => { const e = [...document.querySelectorAll(" + JSON.stringify(sel) + ")].find(x => x && !x.hidden && x.offsetHeight > 0); if (e) { e.click(); return 1; } return 0; })()");
  const until = async (l, e, ms) => { const end = Date.now() + (ms || 40000);
    while (Date.now() < end) { if (await ev(e)) return true; await sleep(500); } console.log('  (' + l + ' 안 나옴)'); return false; };

  await until('시작', vis('#cctitle .go'), 40000);
  await click('#cctitle .go'); await sleep(2500);
  await ev("(() => { try { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); } catch (e) {} })()");
  if (await until('편지', vis('#oLetterGo'), 30000)) await click('#oLetterGo');
  if (await until('계약서', vis('#cnGo'), 30000)) await click('#cnGo');
  await until('방', "(() => document.body.classList.contains('r3ready') && !document.querySelector('.opening'))()", 60000);
  await sleep(1800);
  await click('.coach [data-tut="skip"]');
  await ev("document.querySelectorAll('.veil,.coach,.coachring,#pwaBar,.opening').forEach(e => e.remove())");
  await ev("document.body.classList.remove('titleon')");
  await sleep(700);

  const MEASURE = `(() => {
    const r = e => { if (!e) return null; const b = e.getBoundingClientRect();
      return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), t: Math.round(b.top) }; };
    const tb = document.querySelector('#topbar');
    const out = { win: innerWidth, topbar: r(tb),
      scrollW: tb ? Math.round(tb.scrollWidth) : 0, clientW: tb ? Math.round(tb.clientWidth) : 0,
      logo: r(document.querySelector('.brand .logo')), brand: r(document.querySelector('.brand')),
      stats: [...document.querySelectorAll('#topbar .stat')].map(x =>
        ({ txt: (x.textContent||'').replace(/\\s+/g,' ').trim(), ...r(x) })),
      tools: r(document.querySelector('#topbar #tools')) || r(document.querySelector('#btnSettings')),
      h1: (() => { const e = document.querySelector('.brand h1'); if (!e) return '없음';
        const cs = getComputedStyle(e); return cs.display + '/' + Math.round(e.getBoundingClientRect().width); })(),
      brandCS: (() => { const e = document.querySelector('.brand'); if (!e) return '-';
        const cs = getComputedStyle(e); return 'flex ' + cs.flexGrow + ' ' + cs.flexShrink + ' ' + cs.flexBasis + ' · minW ' + cs.minWidth; })(),
      mq400: matchMedia('(max-width: 400px)').matches,
      lbl: (() => { const e = document.querySelector('#lblCats'); if (!e) return '없음';
        return getComputedStyle(e).display + ' w' + Math.round(e.getBoundingClientRect().width); })(),
      body: document.body.className.split(' ').filter(x=>x).join('.'),
      appcls: (document.querySelector('#app')||{}).className,
      wrap: tb ? getComputedStyle(tb).flexWrap : '-',
      just: tb ? getComputedStyle(tb).justifyContent : '-' };
    return JSON.stringify(out);
  })()`;

  /* 실제 판을 흉내 낸다: 멸치가 M 이면 초당 수입도 크다 — 칸의 폭을 정하는 것은
     그 둘의 **합**이다. 그래서 두 글자를 같이 박는다. */
  const CASES = [
    [38, 0.5], [12345, 123.4], [999900, 999.9],
    [2345678, 2340], [987654321, 12300], [12345678901, 123400],
  ];
  for (const [av, rv] of CASES) {
    const a = String(av);
    /* **상태를 바꾼다** — DOM 글자를 직접 박으면 다음 틱의 renderTop 이 덮는다(한 번 그랬다). */
    await ev('(() => { S.anchovy = ' + av + '; window.totalRate = () => ' + rv + ';'
      + ' try { renderTop(); } catch (e) {} return 1; })()');
    const n = await ev("(() => { const q = s => (document.querySelector(s)||{}).textContent || '';"
      + " return q('#sAnchovy') + ' ' + q('#sRate'); })()");
    await sleep(400);
    const m = JSON.parse(await ev(MEASURE));
    const s = m.stats.map(x => x.txt + ' [' + x.l + '~' + x.r + ']').join('  ');
    console.log('멸치 ' + String(n).padEnd(20) + '  창 ' + m.win
      + ' · topbar ' + m.clientW + '(내용 ' + m.scrollW + ')'
      + (m.scrollW > m.clientW + 1 ? '  ← **넘친다 ' + (m.scrollW - m.clientW) + 'px**' : ''));
    console.log('             로고 [' + m.logo.l + '~' + m.logo.r + ']  브랜드 [' + m.brand.l + '~' + m.brand.r + ' w' + m.brand.w + ']  ' + s);
    if (m.h1) console.log('             mq400 ' + m.mq400 + ' · 냥라벨 ' + m.lbl + ' · body ' + m.body + ' · app ' + m.appcls);
    const first = m.stats[0];
    if (first && first.l < m.logo.r) console.log('             ↑ 로고와 겹친다 ' + (m.logo.r - first.l) + 'px');
    if (m.tools && first && m.stats[m.stats.length-1].r > m.tools.l)
      console.log('             ↑ 도구와 겹친다 ' + (m.stats[m.stats.length-1].r - m.tools.l) + 'px');
    await shot(TAG + '-' + a.replace('.','p'));
  }
  console.log('flex-wrap ' + JSON.parse(await ev(MEASURE)).wrap + ' · justify ' + JSON.parse(await ev(MEASURE)).just);
  ws.close(); chrome.kill(); server.close(); process.exit(0);
})();
