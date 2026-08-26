/* 프레임이 왜 버벅이나 — **재고 나서 고친다.**

   요소를 하나도 안 바꾸는 최적화가 목표이므로, 먼저 비용이 어디 있는지를 숫자로 잡는다.
   재는 것 셋:

     1. 프레임 시간 분포 — 평균이 아니라 **p50 · p95 · 최악**. 버벅임은 평균이 아니라
        꼬리에서 온다(가끔 40ms 짜리 한 장이 끼면 그게 「버벅」이다)
     2. 그리는 쪽의 재고 — 드로우콜 · 삼각형 · 지오메트리 · 텍스처 · **셰이더 프로그램 수** ·
        **광원 수**. three 는 광원 수가 바뀌면 셰이더를 다시 컴파일하고, 그 순간이 곧 튀는 프레임이다
     3. **빼 보기** — 그림자 · 문등 · 스탠드 · 천장등 · 이름표를 하나씩 끄고 다시 잰다.
        무엇이 비용인지는 넣어 보는 것보다 빼 보는 게 정확하다

   헤드리스는 swiftshader 라 절대값이 실제 기계와 다르다. 그래서 **비율만 본다** —
   무엇을 껐을 때 몇 % 빨라지는가.

   node spike/serve.js 를 먼저 띄운다.  node spike/perf.js [tier] */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9601;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const TIER = Number(process.argv[2] || 4);
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-perf');
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

  await send('Emulation.setDeviceMetricsOverride', { width:1560, height:900, deviceScaleFactor:1, mobile:false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try { localStorage.clear(); } catch(e){}' });
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
  await sleep(800);
  /* 제일 무거운 상태로 — 큰 사무실 · 고양이 가득 · 비품 전부 */
  const setup = await ev(`(() => {
    S.tier = ${TIER}; S.anchovy = 99999999; S.shop = { binder: 1 };
    buildWorld(true);
    while (S.cats.length < 20 && deskCount() > S.cats.length){
      const c = newCat('냥' + S.cats.length); c.rec = newRecord(1); S.cats.push(c);
    }
    SHOP.forEach(it => { try { buyItem(it.id); } catch(e){} });
    assignDesks(); renderTiles(); renderRight();
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e => e.remove());
    return JSON.stringify({ 방: W.W + 'x' + W.H, 고양이: S.cats.length, 책상: W.desks.length });
  })()`);
  console.log('무대 ' + setup);
  await sleep(2500);

  /* 프레임 시간을 샘플링한다. **평균이 아니라 꼬리를 본다** — 버벅임은 평균이 아니라
     가끔 끼는 한 장에서 온다. p95 와 최악을 같이 찍는 이유다. */
  const sample = async (sec = 6) => JSON.parse(await ev(`(async () => {
    const t = [];
    let last = performance.now();
    await new Promise(done => {
      const step = now => { t.push(now - last); last = now;
        if (now - t0 < ${'${'}sec${'}'} * 1000) requestAnimationFrame(step); else done(); };
      const t0 = performance.now();
      requestAnimationFrame(step);
    });
    t.shift();
    t.sort((a, b) => a - b);
    const at = q => +t[Math.min(t.length - 1, Math.floor(t.length * q))].toFixed(1);
    return JSON.stringify({ 장수: t.length, p50: at(0.5), p95: at(0.95),
                            최악: +t[t.length - 1].toFixed(1) });
  })()`.replace('${sec}', sec)));

  console.log('\n── 지금 재고 ──');
  console.log('   ' + JSON.stringify(await ev(`JSON.stringify(R3.perf())`)));
  const base = await sample();
  console.log('   기준선  ' + JSON.stringify(base));

  /* **빼 보기** — 무엇이 비용인지는 넣어 보는 것보다 빼 보는 게 정확하다 */
  console.log('\n── 하나씩 꺼 본다 ──');

  /* ---- 다시 세워도 광원이 안 쌓이는가 ----
     사무실을 다시 세우는 일은 자주 일어난다 — 가구를 옮길 때마다·러그를 깔 때마다·
     벽지를 갈 때마다 renderTiles 가 돈다. 그때마다 광원이 쌓이면 **만질수록 느려지는**
     게임이 된다. 열 번 세워 보고 수가 그대로인지 본다. */
  const leak = JSON.parse(await ev(`(() => {
    const before = R3.perf().lights;
    for (let i = 0; i < 10; i++) renderTiles();
    return JSON.stringify({ 전: before, 후: R3.perf().lights, 문등: R3.perf().문등, 스탠드: R3.perf().스탠드 });
  })()`));
  console.log('\n── 열 번 다시 세워 본다 ──');
  console.log('   ' + JSON.stringify(leak));
  console.log('   ' + (leak.전 === leak.후 ? '✅ 안 쌓인다' : `❌ ${leak.전} → ${leak.후} 로 늘었다`));

  const off = [
    ['그림자',   "R3.perfToggle('shadow', false)"],
    ['문등 4개', "R3.perfToggle('doorlight', false)"],
    ['스탠드',   "R3.perfToggle('lamplight', false)"],
    ['천장등',   "R3.perfToggle('ceillight', false)"],
    ['이름표',   "R3.perfToggle('tags', false)"],
  ];
  for (const [name, call] of off){
    await ev(call);
    await sleep(900);
    const s = await sample(4);
    const gain = ((base.p50 - s.p50) / base.p50 * 100).toFixed(0);
    console.log(`   ${name.padEnd(9)} p50 ${String(s.p50).padStart(6)}ms  (기준선 ${base.p50}ms · ${gain > 0 ? '-' : '+'}${Math.abs(gain)}%)`);
  }
  console.log('\n※ 헤드리스는 swiftshader 라 절대값이 실제 기계와 다르다 — **비율만** 본다.');
  ws.close(); chrome.kill();
  process.exit(0);
})();
