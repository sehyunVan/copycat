/* 고양이가 실제로 그려지는지만 본다.
   ① 있는 그대로 ② 사무실을 숨기고 고양이만 ③ 고양이 위치의 픽셀을 직접 읽는다 */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const { decodePNG } = require('../tools/png.js');
const PORT = 9353, W = 1280, H = 860;
const OUT = path.join(__dirname, 'dist', 'shots');
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe',
].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'cdp-dbg-' + PORT),
    'about:blank'], { stdio:'ignore' });
  let page;
  for (let i = 0; i < 60 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
    if (!page) await sleep(250);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map();
  const send = (m, p={}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({id:i, method:m, params:p})); });
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); } });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width:W, height:H, deviceScaleFactor:1, mobile:false });
  await send('Page.navigate', { url:'http://localhost:8123/index.html?3d=1' });
  await sleep(6000);
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true })).result?.value;

  /* 고양이를 여럿, 여러 상태로 만들어 둔다 — 실제 플레이 상태에 가깝게 */
  console.log('고양이 늘리기:', await ev(`(() => {
    while (S.cats.length < 6){ const c = rollCat(); if (!c) break; S.cats.push(c); }
    buildWorld();
    const states = ['work','walk','sleep','idle','use','stamp'];
    S.cats.forEach((c, i) => { c.act = c.act || {}; c.act.s = states[i % states.length]; });
    renderTiles();
    return S.cats.length;
  })()`));
  await sleep(1500);

  const shot = async name => {
    const r = await send('Page.captureScreenshot', { format:'png', clip:{x:0,y:0,width:W,height:H,scale:1} });
    const f = path.join(OUT, name);
    fs.writeFileSync(f, Buffer.from(r.data,'base64'));
    return f;
  };
  await shot('dbg-1-normal.png');

  console.log('진단:', await ev(`JSON.stringify(R3.debug())`));
  console.log('숨기기 반영:', await ev(`(() => { R3.hideStatics(true); R3.draw(); return R3.debug().statics; })()`));
  await sleep(700);
  const f2 = await shot('dbg-2-catsonly.png');

  /* 고양이만 남은 그림에서 배경이 아닌 픽셀이 몇 개인가 = 실제로 그려졌는가 */
  const { rgba, w, h } = (() => { const i = decodePNG(f2); return { rgba:i.rgba, w:i.w, h:i.h }; })();
  let bg = null, diff = 0;
  const at = (x,y) => { const i = (y*w+x)*4; return [rgba[i],rgba[i+1],rgba[i+2]]; };
  bg = at(Math.floor(w*0.55), Math.floor(h*0.90));
  for (let y = 100; y < h-120; y += 3)
    for (let x = Math.floor(w*0.32); x < Math.floor(w*0.78); x += 3){
      const p = at(x,y);
      if (Math.abs(p[0]-bg[0]) + Math.abs(p[1]-bg[1]) + Math.abs(p[2]-bg[2]) > 40) diff++;
    }
  console.log('고양이만 그린 화면의 비배경 픽셀:', diff, '(배경색', bg.join(','), ')');
  await ev(`R3.hideStatics(false)`);
  ws.close(); chrome.kill();
})();
