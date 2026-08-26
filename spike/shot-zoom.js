/* 35번 — 표시가 **정말 화면에 그려지나**. 눈이 아니라 픽셀로 답한다.

   앞선 판 넷이 「차이가 안 보인다」로 끝났는데, 그게 표시가 없어서인지 작아서인지
   내가 못 본 것인지를 가르지 못했다. 그건 실측이 아니라 눈싸움이다.

   그래서 **표시가 붙은 정확한 화면 좌표**(R3.markInfo)를 받아서 그 자리를 120×120 으로
   잘라 4배로 확대한다. 네 판을 같은 좌표에서 자르므로, 차이가 있으면 반드시 보이고
   없으면 「없다」가 확정된다. 그 자리의 평균 rgb 도 같이 찍는다 — 그림이 애매해도
   숫자는 안 애매하다.

   node spike/serve.js 를 먼저 띄운다.  node spike/shot-zoom.js
   나오는 것: spike/ui/mark-zoom.png */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9591;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const OUT = path.resolve(__dirname, 'ui') + path.sep;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MODES = [
  { id:'off', n:'표시 없음 (전)' },
  { id:'on',  n:'문에 불 (후)' },
];
const CROP = 120, ZOOM = 4;

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-zoom');
  fs.rmSync(dir, { recursive:true, force:true });
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page; for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  if (!page){ console.log('크롬을 못 띄웠다'); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl); let id = 0; const pend = new Map();
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => { const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); } });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;
  await send('Emulation.setDeviceMetricsOverride', { width:1200, height:820, deviceScaleFactor:1, mobile:false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try { localStorage.clear(); } catch(e){}' });

  const SETUP = [
    "S.seed = 20260825; S.tier = 3; S.anchovy = 9999999; S.shop = { binder: 1 };",
    "buildWorld(true); assignDesks();",
    "const st = document.createElement('style');",
    "st.textContent = '#topbar,#panelInbox,#panelBiz,#colTabs,#ticker,.clockchip,.cambtn,.foldbtn,#btnFoldL,#btnFoldR,#btnCam,#clock,.edithint,#tags3d,#fx3d,.toast{visibility:hidden !important}';",
    "document.head.appendChild(st);",
    "R3.followOn(false); setSkyForce('day');",
    "renderTiles(); renderNight(); R3.clearTags();",
    "document.querySelectorAll('.veil,.coach,.coachring,.bubble').forEach(e => e.remove());",
    /* 달력을 아주 가까이 — 표시가 붙은 자리를 크게 본다 */
    "const D = R3.debug().mark.pts;",
    "R3.camSet({ at:{ x: D[1][0], y: D[1][2], up: D[1][1] }, zoom:0.13, el:0.40 });",
    "return JSON.stringify({ pts: D });",
  ].join('\n');

  async function boot(mode){
    await send('Page.navigate', { url: `${BASE}/index.html?3d=1&debug=1${mode === 'off' ? '&mark=off' : ''}` });
    for (let i = 0; i < 200; i++){
      if (await ev(`document.body.classList.contains('r3ready')`)) break;
      await sleep(200);
    }
    await sleep(1400);
    await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
    await sleep(1000);
    await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
    await sleep(1000);
    await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
    await sleep(2100);
    await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click(); })()`);
    await sleep(700);
    const r = await ev('(() => {\n' + SETUP + '\n})()');
    await sleep(1400);
    return JSON.parse(r);
  }

  /* 자를 자리 — **표시가 붙은 그 좌표**를 쓴다. 표시 없는 판(off)도 같은 좌표로 자른다.
     tag 판에서 한 번 받아 두고 넷에 그대로 쓴다: 같은 방·같은 카메라라 좌표가 같다. */
  await boot('tag');
  const spot = JSON.parse(await ev(`(() => {
    const info = R3.markInfo();
    const on = info.list.filter(q => q.화면안);
    const vp = document.querySelector('#viewport').getBoundingClientRect();
    /* 화면 안에 든 표시 중 가운데 것 — 달력에 붙은 것이다 */
    const q = on[Math.floor(on.length/2)] || null;
    return JSON.stringify({ 표시수: info.메시, 화면안: info.화면안,
      s: q ? { x: Math.round(q.s[0] + vp.x), y: Math.round(q.s[1] + vp.y) } : null,
      list: info.list });
  })()`));
  console.log('표시 메시 ' + spot.표시수 + '개 · 화면 안 ' + spot.화면안 + '개');
  if (!spot.s){ console.log('화면 안에 든 표시가 없다 — 카메라부터 틀렸다'); process.exit(1); }
  console.log('자를 자리 ' + JSON.stringify(spot.s));

  {
    const full = (await send('Page.captureScreenshot', { format:'png' })).data;
    fs.writeFileSync(OUT + 'mark-full.png', Buffer.from(full, 'base64'));
    console.log('통짜 한 장 → spike/ui/mark-full.png');
  }
  const clip = { x: Math.max(0, spot.s.x - CROP/2), y: Math.max(0, spot.s.y - CROP/2),
                 width: CROP, height: CROP };
  const shots = {}, rgb = {};
  for (const m of MODES){
    await boot(m.id);
    shots[m.id] = (await send('Page.captureScreenshot', { format:'png', clip: { ...clip, scale:1 } })).data;
    rgb[m.id] = JSON.parse(await ev(`(async () => {
      const img = await new Promise(r => { const im = new Image(); im.onload = () => r(im);
        im.src = 'data:image/png;base64,${shots[m.id]}'; });
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently:true });
      g.drawImage(img, 0, 0);
      /* 가운데 24×24 — 표시가 있다면 거기다 */
      const d = g.getImageData(img.width/2 - 12, img.height/2 - 12, 24, 24).data;
      let r0=0,g0=0,b0=0; for (let i=0;i<d.length;i+=4){ r0+=d[i]; g0+=d[i+1]; b0+=d[i+2]; }
      const n = d.length/4;
      return JSON.stringify([Math.round(r0/n), Math.round(g0/n), Math.round(b0/n)]);
    })()`));
    console.log(`  ${m.n.padEnd(10)} 가운데 24×24 평균 rgb(${rgb[m.id].join(',')})`);
  }

  /* 넷을 4배로 확대해 나란히 */
  const b64 = await ev(`(async () => {
    const Z = ${ZOOM}, C = ${CROP}, P = 8, HH = 22;
    const cv = document.createElement('canvas');
    cv.width = (C*Z + P) * ${MODES.length} + P; cv.height = HH + C*Z + P*2;
    const g = cv.getContext('2d');
    g.fillStyle = '#151515'; g.fillRect(0,0,cv.width,cv.height);
    g.imageSmoothingEnabled = false;
    const names = ${JSON.stringify(MODES.map(m => m.n))};
    const srcs = ${JSON.stringify(MODES.map(m => m.id))}.map(k => ({
      off: 'data:image/png;base64,${shots.off || ''}',
      on: 'data:image/png;base64,${shots.on || ''}',
    })[k]);
    for (let i = 0; i < srcs.length; i++){
      const img = await new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = srcs[i]; });
      const x = P + i * (C*Z + P);
      g.fillStyle = '#E8E8E4'; g.font = '700 13px system-ui,"Malgun Gothic",sans-serif';
      g.fillText(names[i], x, 16);
      g.drawImage(img, 0, 0, img.width, img.height, x, HH, C*Z, C*Z);
      g.strokeStyle = '#333'; g.strokeRect(x + 0.5, HH + 0.5, C*Z - 1, C*Z - 1);
    }
    return cv.toDataURL('image/png').slice(22);
  })()`);
  fs.writeFileSync(OUT + 'mark-zoom.png', Buffer.from(b64, 'base64'));
  console.log('→ spike/ui/mark-zoom.png  (표시 자리를 120px 잘라 4배)');
  ws.close(); chrome.kill();
  process.exit(0);
})();
