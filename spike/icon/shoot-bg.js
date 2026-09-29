/* ============================================================
   shoot-bg.js — 아이콘 배경용 **사무실 사진**을 게임에서 찍는다.

   아이콘의 고양이는 게임이 구운 것(assets/logo-cat.png)이고, 그 뒤에 깔 사무실도
   그림을 그리지 않고 게임 렌더러가 찍는다 — 그림체를 바꾸면 아이콘도 따라오게.

   시간대 × 카메라 격자로 여러 장을 찍어 두고, studio.html 이 그중 골라 합성한다.
   게임 파일은 한 줄도 안 건드린다(spike 규칙).

     node spike/serve.js            먼저
     node spike/icon/shoot-bg.js    →  spike/icon/bg/<sky>-<cam>.png (정사각, 2x)
   ============================================================ */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9677;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const OUT = path.join(__dirname, 'bg');
const VP = 1000;                              // 뷰포트 한 변(css px). DSF 2 → 2000px
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SKIES = ['day', 'afternoon', 'evening', 'night'];
/* el 은 올려다보는 각(작을수록 눈높이), zoom 은 작을수록 가깝다(camSet 하한 0.16). */
const CAMS = [
  { id:'low',  el:0.22, az:0.72, zoom:0.30 },
  { id:'mid',  el:0.38, az:0.72, zoom:0.34 },
  { id:'turn', el:0.38, az:1.20, zoom:0.34 },
  { id:'high', el:0.56, az:0.72, zoom:0.48 },
  { id:'wide', el:0.40, az:0.72, zoom:0.70 },
];

(async () => {
  fs.mkdirSync(OUT, { recursive:true });
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-iconbg-' + process.pid);
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page; for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  if (!page) throw new Error('크롬이 안 뜬다');
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
  const click = sel => ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (b){ b.click(); return true; } return false; })()`);

  await send('Emulation.setDeviceMetricsOverride', { width:VP, height:VP, deviceScaleFactor:2, mobile:true });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try { localStorage.clear(); } catch(e){}' });
  await send('Page.navigate', { url:`${BASE}/index.html?3d=1&mobile=1` });
  for (let i = 0; i < 200; i++){ if (await ev(`document.body.classList.contains('r3ready')`)) break; await sleep(200); }
  await sleep(1500);
  /* 시작화면 → 프롤로그 건너뛰기 → 계약서 → 튜토리얼 건너뛰기. 순서가 중요하다(copycat-dot-skin 메모). */
  await click('#cctitle .go'); await sleep(900);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`); await sleep(1000);
  await click('#oLetterGo'); await sleep(1000);
  await click('#cnGo'); await sleep(2200);
  await click('.coach [data-tut="skip"]'); await sleep(700);

  const info = await ev(`(() => {
    S.seed = 20260927; S.tier = 3; S.anchovy = 9999999;
    S.shop = { binder:1, f_floorlamp:2, f_plantL:2, f_plantS:2, f_candle:1, f_lantern:1 };
    buildWorld(true); assignDesks();
    const st = document.createElement('style');
    st.textContent = 'body *{visibility:hidden !important} #gl{visibility:visible !important}';
    document.head.appendChild(st);
    document.querySelectorAll('.veil,.coach,.coachring,.bubble,.toast').forEach(e => e.remove());
    R3.followOn(false); R3.clearTags();
    return JSON.stringify({ desks: W.desks.map(d => d.desk), cats: S.cats.length, W: W.W, H: W.H });
  })()`);
  const world = JSON.parse(info);
  console.log('사무실', world.W + '×' + world.H, '책상', world.desks.length, '고양이', world.cats);
  /* 가운데쯤의 책상을 본다 — 구석 책상은 벽이 화면 절반을 먹는다 */
  const desks = world.desks.slice().sort((a, b) =>
    Math.hypot(a.x - world.W / 2, a.y - world.H / 2) - Math.hypot(b.x - world.W / 2, b.y - world.H / 2));
  const target = desks[0];
  console.log('과녁 책상', target);

  const rect = JSON.parse(await ev(`(() => { const r = document.getElementById('gl').getBoundingClientRect(); return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height}); })()`));
  const side = Math.min(rect.w, rect.h);
  const clip = { x: rect.x + (rect.w - side) / 2, y: rect.y + (rect.h - side) / 2, width: side, height: side, scale: 2 };
  console.log('캔버스', rect, '→ 정사각', side, '×2');

  for (const sky of SKIES){
    await ev(`(() => { setSkyForce(${JSON.stringify(sky)}); renderTiles(); renderNight(); })()`);
    await sleep(1200);
    for (const c of CAMS){
      await ev(`R3.camSet({ at:{ x:${target.x}, y:${target.y}, up:0.75 }, el:${c.el}, az:${c.az}, zoom:${c.zoom}, follow:false })`);
      await sleep(900);
      const r = await send('Page.captureScreenshot', { format:'png', clip });
      const name = `${sky}-${c.id}.png`;
      fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'));
      console.log('  ' + name.padEnd(22) + JSON.stringify(await ev('R3.debug().cam')));
    }
  }
  if (errs.length) console.log('페이지 오류', errs.slice(0, 5));
  ws.close(); chrome.kill();
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  console.log('→ ' + path.relative(process.cwd(), OUT));
  process.exit(0);
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
