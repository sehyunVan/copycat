/* ============================================================
   shot.js — 스파이크 한 장을 헤드리스로 열어서 찍는다.

   조형은 눈으로만 판정되는 종류라서 고칠 때마다 봐야 한다.
   verify-open.js 와 같은 CDP 배선인데, 여기서는 페이지 하나만 본다.

     node spike/serve.js &
     node spike/shot.js m1-sculpt                      # → dist/shots/m1-sculpt.png
     node spike/shot.js m1-sculpt res26 "M1.set('res',26)"
   ============================================================ */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
/* 크기를 밖에서 준다 — 위젯 모드(380px)는 큰 화면에서 못 본다.
   SHOT_W=380 SHOT_H=560 node spike/shot.js ... */
const PORT = 9361, W = Number(process.env.SHOT_W) || 1500, H = Number(process.env.SHOT_H) || 900;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const PAGE = process.argv[2] || 'm1-sculpt';
const TAG  = process.argv[3] || '';
const EVAL = process.argv[4] || '';
const OUT = path.join(__dirname, 'dist', 'shots');

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe',
].find(p => p && fs.existsSync(p));
if (!CHROME) throw new Error('크롬을 못 찾았다');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  /* 프로필을 고정한다 — 게임을 볼 때 프롤로그를 매번 다시 보지 않으려면 저장이 남아야 한다 */
  const profile = path.join(process.env.TEMP || '/tmp', 'cdp-shot');
  const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--mute-audio',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, 'about:blank'], { stdio:'ignore' });

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
  await send('Emulation.setDeviceMetricsOverride', { width:W, height:H, deviceScaleFactor:1.5, mobile:false });

  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true })).result;
  /* PAGE 가 / 로 시작하면 그 경로를 그대로 연다 — 게임(index.html) 을 볼 때 쓴다 */
  const URL_ = PAGE.startsWith('/') ? BASE + PAGE : `${BASE}/spike/${PAGE}.html`;
  await send('Page.navigate', { url: URL_ });
  await sleep(Number(process.env.BOOT_MS) || 3500);

  /* 식을 넣고 나서 기다리는 시간. 컷신처럼 '몇 초 뒤의 한 장' 을 봐야 할 때 늘린다 */
  if (EVAL){ console.log('  eval:', JSON.stringify((await ev(EVAL)).value)); await sleep(Number(process.env.SHOT_WAIT) || 1200); }

  const stats = await ev('JSON.stringify(window.M1 ? M1.stats() : {})');
  console.log('  ' + (stats.value || '{}'));

  const name = (PAGE.replace(/\.html.*$/, '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'page')
                 + (TAG ? '-' + TAG : '');
  const r = await send('Page.captureScreenshot', { format:'png' });
  if (r && r.data){
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64'));
    console.log('  →', path.join('spike/dist/shots', name + '.png'));
  }
  if (errors.length){ console.log('\n에러:'); errors.forEach(e => console.log('  ' + e)); }
  else console.log('  에러 없음');

  ws.close(); chrome.kill();
  process.exit(errors.length ? 1 : 0);
})();
