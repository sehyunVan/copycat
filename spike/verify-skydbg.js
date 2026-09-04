/* 디버그 풍경 고정.  node spike/serve.js 먼저.

   재는 것:
     1. ?debug=1 없으면 그 줄이 **없다** (플레이어에게 안 나간다)
     2. ?debug=1 이면 줄이 있고, 눌렀을 때 **화면이 실제로 바뀐다**
        (버튼이 켜지는 것만 보면 아무것도 확인한 게 아니다 — 픽셀을 센다)
     3. 「시계」로 되돌리면 시계대로 돌아온다
     4. 새로 고치면 안 남는다 (저장하지 않는다 = 디버그다)
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9700;
const OUT = path.resolve(__dirname, 'ui') + path.sep;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-skydbg-' + process.pid);
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
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;

  const boot = async url => {
    await send('Page.navigate', { url });
    await sleep(13000);
    await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
    await sleep(1200);
    await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
    await sleep(1200);
    await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
    await sleep(2400);
    await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
      document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
    await sleep(1500);
  };
  /* 화면 색을 요약한다 — 버튼이 켜지는 것만 보면 아무것도 확인한 게 아니다 */
  const tone = async () => ev(`(() => {
    R3.draw();
    const cv = document.getElementById('gl');
    const c = document.createElement('canvas'); c.width = 48; c.height = 32;
    c.getContext('2d').drawImage(cv, 0, 0, 48, 32);
    const d = c.getContext('2d').getImageData(0, 0, 48, 32).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4){ r += d[i]; g += d[i+1]; b += d[i+2]; }
    const n = d.length / 4;
    return [Math.round(r/n), Math.round(g/n), Math.round(b/n)].join(',');
  })()`);

  let fail = 0;
  const ok = (c, label, extra) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`); };

  await send('Emulation.setDeviceMetricsOverride', { width:1280, height:760, deviceScaleFactor:1, mobile:false });

  console.log('\n── ?debug 없이 (플레이어가 보는 설정) ──');
  await boot('http://localhost:8123/index.html?3d=1');
  const plain = await ev(`(() => { $('#btnSettings').click();
    const n = document.querySelectorAll('.veil [data-sky]').length;
    const rows = [...document.querySelectorAll('.veil .mbody .card .info > b')].map(b => b.textContent.trim());
    document.querySelector('.veil [data-close]').click();
    return JSON.stringify({ 버튼수:n, 항목:rows }); })()`);
  const P = JSON.parse(plain);
  ok(P.버튼수 === 0, '풍경 줄이 없다', JSON.stringify(P.항목));

  console.log('\n── ?debug=1 ──');
  await boot('http://localhost:8123/index.html?3d=1&debug=1');
  const has = await ev(`(() => { $('#btnSettings').click();
    return JSON.stringify({ 버튼: [...document.querySelectorAll('.veil [data-sky]')].map(b => b.dataset.sky),
      켜진것: [...document.querySelectorAll('.veil [data-sky].on')].map(b => b.dataset.sky),
      표: new Set(SKY_PICKS.map(p => p[0]).filter(Boolean)).size }); })()`);
  const H = JSON.parse(has);
  /* 하늘이 다섯 단계로 늘어나면서(SKY_AT) 고르개도 여섯이 됐다 — 「시계」 + 단계 다섯.
     수를 손으로 적어 두면 표가 늘 때마다 여기가 먼저 거짓말을 하므로 표에서 읽는다. */
  ok(H.버튼.length === H.표 + 1, `버튼 ${H.표 + 1} (시계 + 단계 ${H.표})`, H.버튼.join('/'));
  ok(H.켜진것.join() === '', '처음엔 「시계」가 켜져 있다', JSON.stringify(H.켜진것));

  const seen = {};
  for (const id of ['morning', 'day', 'evening', 'night']){
    await ev(`document.querySelector('.veil [data-sky="${id}"]').click()`);
    await sleep(700);
    const t = await tone();
    const info = await ev(`JSON.stringify({ 고정:skyForced(), 하늘:R3.skyInfo().sky, 등수:R3.skyInfo().등수 })`);
    seen[id] = t;
    const I = JSON.parse(info);
    /* 고정이 걸렸다(skyForced)는 것과 **렌더러가 그 하늘을 그렸다**(skyInfo().sky)는
       다른 말이다. 예전엔 앞만 봤는데 그러면 시뮬레이터만 돌고 화면은 안 따라오는
       경우가 통과한다. 둘을 같이 본다.

       skyInfo().sky 는 표식이라 "a|b|섞임|필름" 이다. 고정은 양 끝이 같은 단계고
       섞임이 0 이므로 앞 두 칸만 본다 — 필름 칸까지 적어 두면 후처리를 껐다 켤 때
       여기가 이유 없이 깨진다. */
    ok(I.고정 === id && I.하늘.startsWith(id + '|' + id + '|0'),
       `${id} — 고정되고 렌더러까지 따라온다`,
       `하늘 ${I.하늘} · 천장등 ${I.등수} · 화면 rgb(${t})`);
    const p = await send('Page.captureScreenshot', { format:'png', clip:{ x:0, y:0, width:1280, height:760, scale:1 } });
    fs.writeFileSync(OUT + 'skydbg-' + id + '.png', Buffer.from(p.data, 'base64'));
  }
  ok(new Set(Object.values(seen)).size === 4, '네 화면이 서로 다르다', JSON.stringify(seen));

  await ev(`document.querySelector('.veil [data-sky=""]').click()`);
  await sleep(600);
  ok(await ev(`skyForced() === null`), '「시계」로 되돌아간다');
  await ev(`document.querySelector('.veil [data-close]').click()`);

  console.log('\n── 새로 고침 (저장 안 됨) ──');
  await boot('http://localhost:8123/index.html?3d=1&debug=1');
  ok(await ev(`skyForced() === null`), '고정은 새로 고치면 사라진다 (설정이 아니다)');

  console.log('\n오류: ' + (errs.length ? errs.slice(0,3).join(' | ') : '없음'));
  if (errs.length) fail++;
  console.log(fail ? `\n${fail}건 실패` : '\n전부 통과');
  ws.close(); chrome.kill(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
