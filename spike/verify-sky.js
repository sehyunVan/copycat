/* 시간대 검증.  node spike/serve.js 먼저.

   두 가지를 잰다:
     1. **풍경이 근무표와 무관한가** — 근무를 09–18 / 22–06 두 벌로 두고 같은 시각에
        같은 빛이 나오는지. 예전에는 근무를 옮기면 새벽 3시가 대낮이 됐다.
     2. **시각이 화면에 드러나는가** — 창에서 들어오는 빛 자락을 재던 항목이었다.
        그 빛은 2026-08-25 에 없앴으므로(블라인드를 다 내렸다) 지금은 창 개수와 천장등만 본다.
        시각이 다르면 화면 평균색이 달라야 한다는 아래 판정이 이 항목의 본체다,
        그리고 화면 색이 실제로 달라지는지(픽셀을 세어 비교한다).

   S.clock 은 실제 데스크톱 시계를 따라가므로 그냥 대입하면 다음 틱에 되돌아간다.
   여기서는 renderNight 을 **직접** 부르면서 시각을 넣는다 — 빛만 재는 데는 그게 맞다. */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9570;
const OUT = path.resolve(__dirname, 'ui') + path.sep;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const HOURS = [3, 6.5, 9, 12, 17, 18.5, 20, 22];

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-sky-' + process.pid);
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page; for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl); let id = 0; const pend = new Map();
  const errs = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errs.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;

  await send('Emulation.setDeviceMetricsOverride', { width:1200, height:760, deviceScaleFactor:1, mobile:false });
  await send('Page.navigate', { url:'http://localhost:8123/index.html?3d=1' });
  await sleep(12000);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1200);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1200);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2400);
  await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
  await sleep(800);
  await ev(`(() => {
    S.tier = 3; S.anchovy = 9999;
    while (S.cats.length < 5 && deskCount() > S.cats.length){
      const c = newCat('냥' + S.cats.length); c.rec = newRecord(1); S.cats.push(c); }
    assignDesks(); renderTiles();
    /* 패널을 걷고 사무실만 남긴다 — 창과 바닥을 봐야 한다 */
    document.querySelectorAll('.panel,#topbar,#colTabs,.stagefoot,.clockchip,.foldbtn,.cambtn')
      .forEach(e => e.style.display = 'none');
    const vp = document.getElementById('viewport');
    vp.style.position = 'fixed'; vp.style.inset = '0'; vp.style.zIndex = '9999';
    R3.fit(); R3.camReset(false);
    for (let i = 0; i < 4; i++) document.dispatchEvent(new KeyboardEvent('keydown',{key:'+',bubbles:true}));
  })()`);
  await sleep(4000);

  console.log('\n══ 1. 풍경이 근무표와 무관한가 ══');
  console.log('  시각   09–18근무           22–06근무           같은가');
  let same = true;
  for (const h of HOURS){
    const r = await ev(`(() => {
      const out = [];
      for (const sh of [[9,18],[22,6]]){
        S.shift = { start: sh[0], end: sh[1] };
        const m = skyMix(${h} * 60);
        out.push({ 풍경: m.a + '→' + m.b + '@' + m.t.toFixed(2),
                   근무단계: phaseOf(${h} * 60) });
      }
      return JSON.stringify(out);
    })()`);
    const [A, B] = JSON.parse(r);
    const ok = A.풍경 === B.풍경;
    if (!ok) same = false;
    console.log(`  ${String(h).padStart(4)}  ${A.풍경.padEnd(20)}${B.풍경.padEnd(20)}${ok ? '✅' : '❌'}`
      + `   (근무단계: ${A.근무단계} / ${B.근무단계})`);
  }
  console.log(same ? '  ✅ 근무표를 옮겨도 풍경이 그대로다' : '  ❌ 아직 근무표에 딸려 있다');

  console.log('\n══ 2. 창에서 들어오는 빛 ══');
  await ev(`S.shift = { start:9, end:18 }`);
  const shots = [];
  let prev = null; const seen = new Set();
  for (const h of HOURS){
    const info = await ev(`(async () => {
      /* S.clock 에 밀어 넣는 것으로는 안 된다 — rAF 를 기다리는 동안 게임 루프가
         돌면서 실제 데스크톱 시계로 되돌려 놓는다(첫 측정이 그래서 여덟 번 같은 값이었다).
         그래서 **skyMix 를 고정한다**: renderNight 부터 아래는 실제 경로 그대로 돈다. */
      /* 원본을 한 번만 보관한다 — 안 그러면 두 번째 회차가 **덮어 둔 것**을 불러
         첫 시각이 여덟 번 나온다(실제로 그랬다). */
      if (!window.__skyMix0) window.__skyMix0 = skyMix;
      const m0 = window.__skyMix0(${h} * 60);
      skyMix = () => m0;
      renderNight();
      R3.draw();
      await new Promise(r => requestAnimationFrame(r));
      R3.draw();
      const cv = document.getElementById('gl');
      /* 화면 색을 요약한다 — 시각이 실제로 픽셀을 바꾸는지 보려면 이게 제일 정직하다 */
      const c2 = document.createElement('canvas'); c2.width = 60; c2.height = 40;
      const cx = c2.getContext('2d'); cx.drawImage(cv, 0, 0, 60, 40);
      const d = cx.getImageData(0, 0, 60, 40).data;
      let r = 0, g2 = 0, b = 0;
      for (let i = 0; i < d.length; i += 4){ r += d[i]; g2 += d[i+1]; b += d[i+2]; }
      const n = d.length / 4;
      const dbg = R3.debug ? R3.debug() : {};
      return JSON.stringify({ 평균색: [Math.round(r/n), Math.round(g2/n), Math.round(b/n)],
                              빛: R3.skyInfo ? R3.skyInfo() : '-' });
    })()`);
    const o = JSON.parse(info);
    /* 인접한 두 시각이 같은지를 보면 안 된다 — 3시와 22시는 둘 다 밤이라 **같아야** 맞다.
       판정은 "서로 다른 화면 색이 몇 가지 나오나" 다. */
    seen.add(o.평균색.join(','));
    prev = o.평균색;
    console.log(`  ${String(h).padStart(4)}시  평균색 rgb(${o.평균색.join(',')})   빛 ${JSON.stringify(o.빛)}`);
    const shot = await send('Page.captureScreenshot', { format:'png', clip:{x:0,y:0,width:1200,height:760,scale:1} });
    const f = 'sky-' + String(h).replace('.', 'h') + '.png';
    fs.writeFileSync(OUT + f, Buffer.from(shot.data, 'base64'));
    shots.push(f);
  }
  const okSky = seen.size >= 5;
  console.log(`  ${okSky ? '✅' : '❌'} 여덟 시각에서 서로 다른 화면 색 ${seen.size}가지 (밤 둘은 같아야 맞다)`);
  console.log('  그림: spike/ui/' + shots.join(', '));

  console.log('\n══ 오류 ══');
  console.log(errs.length ? '  ' + errs.slice(0, 6).join('\n  ') : '  없음');
  ws.close(); chrome.kill(); process.exit(errs.length || !same || !okSky ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
