/* 49(러그) · 34 뒷절반(가구 톤) · 39(꼬리·귀·방향)을 **눈으로** 보는 사진 넷.
   검사는 verify-rug.js 가 하고, 여기는 그 결과가 실제로 어떻게 보이는지를 남긴다.
   node spike/serve.js 를 먼저 띄운다.  node spike/shot-rug.js */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9541;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const OUT = path.resolve(__dirname, 'ui') + path.sep;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-shotrug');
  fs.rmSync(dir, { recursive:true, force:true });
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
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
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;
  const shot = async f => { fs.writeFileSync(OUT + f,
    Buffer.from((await send('Page.captureScreenshot', { format:'png' })).data, 'base64'));
    console.log('   → spike/ui/' + f); };

  await send('Emulation.setDeviceMetricsOverride', { width:1280, height:820, deviceScaleFactor:1, mobile:false });
  await send('Page.navigate', { url: BASE + '/index.html?3d=1&debug=1' });
  for (let i = 0; i < 200; i++){
    if (await ev(`document.body.classList.contains('r3ready')`)) break;
    await sleep(200);
  }
  await sleep(1500);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1100);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1100);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2200);
  await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click(); })()`);
  await sleep(700);
  await ev(`(() => {
    S.tier = 3; S.anchovy = 999999; S.shop.binder = 1;
    while (S.cats.length < 6 && deskCount() > S.cats.length){
      const c = newCat('냥' + S.cats.length); c.rec = newRecord(1); S.cats.push(c);
    }
    buildWorld(); assignDesks();
    ['rugpersian','rugstripe','ruground','rugpaw','rugshag','rugmat'].forEach(x => { decorBuy(x); decorPick(x); });
    R3.followOn(false); R3.camReset(); renderTiles(); renderRight();
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e => e.remove());
  })()`);
  await sleep(2200);
  console.log('\n러그 여섯 장 · 사무용 톤');
  await shot('rug-1-std.png');

  /* 러그 하나를 가까이 */
  await ev(`(() => {
    const r = decorState().rugs.find(x => x.id === 'rugpersian') || decorState().rugs[0];
    const s = DECOR.rugSize(r);
    R3.camSet({ at: { x: r.x + s.w/2 - 0.5, y: r.y + s.h/2 - 0.5, up: 0.3 }, zoom: 0.26, el: 0.72 });
  })()`);
  await sleep(1400);
  console.log('페르시안 러그 클로즈업');
  await shot('rug-2-close.png');

  /* 가구 톤 넷 */
  for (const [id, name] of [['tone_steel','철제'],['tone_wood','우드톤'],['tone_white','흰색']]){
    await ev(`(() => { decorBuy('${id}'); decorPick('${id}'); R3.camReset(); })()`);
    await sleep(2000);
    console.log('가구 톤 — ' + name);
    await shot('rug-3-' + id + '.png');
  }

  /* 가구를 바라보는 고양이 — 정수기·화분 앞 */
  await ev(`(() => {
    decorPick('tone_std');
    const c = S.cats[0];
    const f = pickUse(W, 'social', c);
    if (f){ c.x = f.spot.x; c.y = f.spot.y; c.act = { s:'use', t:0, use: f.target };
      R3.camSet({ at: { x: f.target.x, y: f.target.y, up: 0.5 }, zoom: 0.36, el: 0.66 }); }
    window.__realTick = window.simTick; window.simTick = () => {};
  })()`);
  await sleep(2400);
  console.log('가구를 바라보는 고양이 — 지금 팔레트 ' + JSON.stringify(await ev('JSON.stringify(R3.debug().pal)')));
  await shot('rug-4-facing.png');
  await ev(`(() => { window.simTick = window.__realTick; })()`);

  ws.close(); chrome.kill(); process.exit(0);
})();
