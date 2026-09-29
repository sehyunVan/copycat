/* ============================================================
   shoot-furn.js — 게임의 가구 초상(R3.furnPortrait)을 큰 크기로 굽는다.

   아이콘에 책상·스탠드를 세우고 싶은데 손으로 그리면 게임의 물건과 안 닮는다.
   비품 목록이 쓰는 그 함수로 굽는다 — 배경은 투명(clearAlpha 0).

     node spike/serve.js             먼저
     node spike/icon/shoot-furn.js   →  spike/icon/furn/<이름>.png
   ============================================================ */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9679;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const OUT = path.join(__dirname, 'furn');
const SIZE = 1024;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive:true });
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-iconfurn-' + process.pid);
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page; for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl); let id = 0; const pend = new Map();
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); } });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r?.result?.value;
  };
  await send('Emulation.setDeviceMetricsOverride', { width:1280, height:900, deviceScaleFactor:1, mobile:false });
  await send('Page.navigate', { url:`${BASE}/index.html?3d=1` });
  for (let i = 0; i < 200; i++){ if (await ev(`!!(window.R3 && R3.ready && R3.furnPortrait)`)) break; await sleep(200); }
  await sleep(1500);

  const tiles = JSON.parse(await ev(`JSON.stringify(Object.fromEntries(Object.entries(TILE).filter(([k,v]) => typeof v === 'number')))`));
  console.log('타일', Object.keys(tiles).length + '종:', Object.keys(tiles).join(' '));
  const WANT = ['DESK', 'DESK_R', 'FLOORLAMP', 'PLANT_L', 'PLANT_S', 'CANDLE', 'LANTERN', 'PENHOLDER', 'SHELF', 'BOOKSHELF', 'COOLER', 'WATER', 'MONITOR', 'CHAIR', 'SOFA', 'LAMP', 'DESKLAMP', 'CACTUS', 'MUG'];
  for (const k of Object.keys(tiles)){
    if (!WANT.includes(k)) continue;
    const url = await ev(`R3.furnPortrait(${tiles[k]}, ${SIZE})`);
    if (!url || !url.startsWith('data:image/png')){ console.log('  ' + k.padEnd(12) + '(못 구움)'); continue; }
    const buf = Buffer.from(url.split(',')[1], 'base64');
    fs.writeFileSync(path.join(OUT, k.toLowerCase() + '.png'), buf);
    console.log('  ' + k.padEnd(12) + (buf.length / 1024).toFixed(0) + 'KB');
  }
  ws.close(); chrome.kill();
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  process.exit(0);
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
