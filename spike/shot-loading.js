/* 로딩 화면 후보 그림. node spike/serve.js 먼저.
   후보 셋을 데스크톱·폰 두 크기에서 찍는다 — 로딩 화면은 폰에서 더 자주 보게 되는
   화면이라(설치해 두고 켜는 물건이다) 두 크기를 같이 봐야 판단이 된다. */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9530;
const OUT = path.resolve(__dirname, 'ui') + path.sep;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CASES = [
  { n:'wide',  url:'', w:1200, h:800 },
  { n:'phone', url:'', w:390, h:780, mobile:true },
  { n:'small', url:'', w:820, h:560 },
];

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-load');
  fs.rmSync(dir, { recursive:true, force:true });
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page; for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl); let id = 0; const pend = new Map();
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => { const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); } });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable');

  for (const c of CASES){
    await send('Emulation.setDeviceMetricsOverride',
      { width:c.w, height:c.h, deviceScaleFactor:2, mobile:!!c.mobile });
    await send('Page.navigate', { url:'http://localhost:8123/spike/loading-mock.html' + c.url });
    await sleep(1400);
    const s = await send('Page.captureScreenshot', { format:'png',
      clip:{ x:0, y:0, width:c.w, height:c.h, scale:1 } });
    fs.writeFileSync(OUT + 'load-' + c.n + '.png', Buffer.from(s.data, 'base64'));
    console.log('  load-' + c.n + '.png');
  }
  ws.close(); chrome.kill();
  process.exit(0);
})();
