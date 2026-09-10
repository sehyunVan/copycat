/* 시작화면이 뜨나 — 콘솔 오류를 전부 받아 적는다.
   ROOT_DIR 로 어느 판을 볼지 고른다: 소스(copycat/) 또는 배포본(copycat/dist/android/). */
const fs = require('fs'), path = require('path'), http = require('http');
const { spawn } = require('child_process');
const ROOT = process.env.ROOT_DIR || 'c:/Users/sehyu/playground/copycat/';
const PORT = +(process.env.PORT || 9390), CDP = PORT + 1;
const TAG = process.env.TAG || 't';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TYPE = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.gif': 'image/gif', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json' };

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
    '--user-data-dir=' + path.join(process.env.TEMP || '.', 'cdp-title-' + Date.now()), 'about:blank'],
    { stdio: 'ignore' });
  let page;
  for (let i = 0; i < 80 && !page; i++) {
    try { page = (await (await fetch('http://127.0.0.1:' + CDP + '/json/list')).json()).find(t => t.type === 'page'); } catch {}
    if (!page) await sleep(250);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map();
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  const errs = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errs.push('✗ ' + ((d.exception || {}).description || d.text || '').split('\n').slice(0, 2).join(' | '));
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errs.push('· ' + (m.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 160));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 1, mobile: true });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r && r.exceptionDetails) return '**터짐** ' + ((r.exceptionDetails.exception || {}).description || '').split('\n')[0];
    return r.result ? r.result.value : null;
  };

  await send('Page.navigate', { url: 'http://localhost:' + PORT + '/index.html?mobile=1' });
  await sleep(1500);
  await ev('(() => { try { localStorage.clear(); sessionStorage.clear(); return 1; } catch (e){ return 0; } })()');
  errs.length = 0;
  await send('Page.navigate', { url: 'http://localhost:' + PORT + '/index.html?mobile=1' });

  for (const t of [1.5, 3, 6, 10]) {
    await sleep(t === 1.5 ? 1500 : 2000);
    console.log(t + '초  #cctitle ' + await ev("!!document.querySelector('#cctitle')")
      + ' · .go ' + await ev("(() => { const g = document.querySelector('#cctitle .go');"
        + " return g ? (g.offsetHeight ? '보임 「' + (g.textContent||'').trim().slice(0,12) + '」' : '숨김') : '없음'; })()")
      + ' · titleon ' + await ev("document.body.classList.contains('titleon')")
      + ' · vista ' + await ev("(() => { const e = document.querySelector('#cctitle');"
        + " return e ? e.className : '-'; })()"));
  }
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(__dirname + '/' + TAG + '-title.png', Buffer.from(r.data, 'base64'));
  console.log('\n오류 ' + errs.length + '건');
  [...new Set(errs)].slice(0, 14).forEach(x => console.log('  ' + x));
  ws.close(); chrome.kill(); server.close(); process.exit(0);
})();
