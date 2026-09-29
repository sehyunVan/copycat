/* ============================================================
   render.js — studio.html 을 헤드리스로 열어 안마다 1024 PNG 와 대조표를 저장한다.

     node spike/serve.js               먼저
     node spike/icon/shoot-bg.js       배경이 없으면 먼저
     node spike/icon/render.js         →  spike/icon/out/<id>-1024.png · sheet.png
   ============================================================ */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9678;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const OUT = path.join(__dirname, 'out');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive:true });
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-iconout-' + process.pid);
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page; for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl); let id = 0; const pend = new Map(); const errs = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => { const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r?.result?.value;
  };
  await send('Emulation.setDeviceMetricsOverride', { width:1700, height:1200, deviceScaleFactor:1, mobile:false });
  await send('Page.navigate', { url:`${BASE}/spike/icon/studio.html?t=${Date.now()}` });
  let st = null;
  for (let i = 0; i < 100; i++){ st = await ev(`window.ICON_STUDIO ? JSON.stringify({ ready: ICON_STUDIO.ready, error: ICON_STUDIO.error || null }) : null`); if (st) break; await sleep(300); }
  if (!st) throw new Error('스튜디오가 안 올라왔다');
  st = JSON.parse(st);
  if (!st.ready) throw new Error('스튜디오 오류: ' + st.error);

  const ids = await ev('ICON_STUDIO.list()');
  for (const i of ids){
    const url = await ev(`ICON_STUDIO.png(${JSON.stringify(i)})`);
    const buf = Buffer.from(url.split(',')[1], 'base64');
    fs.writeFileSync(path.join(OUT, i + '-1024.png'), buf);
    console.log('  ' + (i + '-1024.png').padEnd(26) + (buf.length / 1024).toFixed(0) + 'KB');
  }
  const sheet = await ev('ICON_STUDIO.sheet()');
  fs.writeFileSync(path.join(OUT, 'sheet.png'), Buffer.from(sheet.split(',')[1], 'base64'));
  console.log('  sheet.png');
  console.log('  고양이 측정', JSON.stringify(await ev('ICON_STUDIO.meta')));
  if (errs.length) console.log('페이지 오류', errs.slice(0, 5));
  ws.close(); chrome.kill();
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  console.log('→ ' + path.relative(process.cwd(), OUT));
  process.exit(0);
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
