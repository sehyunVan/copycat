/* 39번 「고양이 모션」의 **첫 걸음: 잰다.**

   설계에 이렇게 적어 뒀다: *"기본 카메라 배율에서 고양이 하나가 화면에서 몇 픽셀인지,
   발끝이 한 주기에 몇 픽셀 움직이는지. 그 값이 3~4px 이면 만들어 봐야 안 보인다."*

   그래서 모델을 고치기 전에 이것부터 잰다. 재는 방법은 둘:
     · 기하 — R3.project 로 월드 길이를 화면 픽셀로 옮긴다 (정확한 값)
     · 화면 — 걷는 고양이를 두 프레임 찍어 **실제로 달라진 픽셀 수**를 센다
       (움직였다고 코드가 말하는 것과 화면이 달라지는 것은 다른 일이다)

   node spike/serve.js 를 먼저 띄운다.  node spike/measure-motion.js */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9531;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-motion');
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
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); }
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;

  await send('Emulation.setDeviceMetricsOverride', { width:1560, height:900, deviceScaleFactor:1, mobile:false });
  await send('Page.navigate', { url: BASE + '/index.html?3d=1&debug=1' });
  for (let i = 0; i < 200; i++){
    if (await ev(`document.body.classList.contains('r3ready')`)) break;
    await sleep(200);
  }
  await sleep(1500);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1200);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1200);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2200);
  await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click(); })()`);
  await sleep(700);
  await ev(`(() => {
    S.tier = 4; S.anchovy = 999999;
    while (S.cats.length < 5 && deskCount() > S.cats.length){
      const c = newCat('냥' + S.cats.length); c.rec = newRecord(1); S.cats.push(c);
    }
    assignDesks(); renderTiles(); renderRight(); renderTodos();
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e => e.remove());
  })()`);
  await sleep(1500);

  /* ---- 기하: 월드 길이 → 화면 픽셀 ---- */
  const geo = await ev(`(() => {
    /* 카메라 추적을 끄고 **기본 배율**로 돌린다 — 재는 건 기본값에서의 값이다 */
    R3.followOn(false); R3.camReset();
    const c = S.cats[0];
    const P = (dx, dz, up) => R3.project(c.x + dx - 0.5, c.y + dz - 0.5, up);
    const d = (a, b) => a && b ? Math.hypot(a.x-b.x, a.y-b.y) : null;
    /* 고양이 키 0.74. 걸음 진폭은 catsculpt 의 STEP(0.080) × 2 × 몸 배율(H/h≈0.74) */
    const scale = 0.74 / 0.98;
    const stride = 0.080 * 2 * scale;          // 발끝 앞뒤 진폭 (peak-to-peak)
    const lift   = 0.030 * scale;              // 드는 높이
    return {
      배율: +R3.debug().cam.zoom.toFixed(3),
      고양이키px: +d(P(0,0,0), P(0,0,0.74)).toFixed(1),
      발앞뒤px:   +d(P(0,0,0.03), P(0,stride,0.03)).toFixed(2),
      발좌우px:   +d(P(0,0,0.03), P(stride,0,0.03)).toFixed(2),
      발드는px:   +d(P(0,0,0.03), P(0,0,0.03+lift)).toFixed(2),
      꼬리흔들px_예상: +d(P(0,0,0.5), P(0.45*0.6*scale,0,0.5)).toFixed(2),
      stride, lift,
    };
  })()`);
  console.log('\n── 기하 (기본 배율) ──');
  console.log('   ' + JSON.stringify(geo));

  /* 화면이 실제로 달라지는지는 여기서 안 잰다. 한 번 재 봤는데 두 가지를 놓쳤다:
     걷게 시켰다고 걷는 게 아니고(시뮬이 곧장 자리로 돌려보낸다), 카메라가 따라오면
     화면 전체가 달라져서 무엇이 움직였는지 못 가린다. 그 측정은 시뮬을 얼리고
     빈 바닥에 세워야 뜻이 있어서 spike/verify-rug.js 로 옮겼다 —
     여기 남는 것은 **기하**뿐이다: 월드 길이가 화면에서 몇 픽셀인가. */

  const dbg = await ev(`JSON.stringify(R3.catStats())`);
  console.log('\n── 지금 굽고 있는 것 ──\n   ' + dbg);

  ws.close(); chrome.kill(); process.exit(0);
})();
