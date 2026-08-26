/* 안개를 기본으로 켠 뒤, **뺐던 이유가 실제로 문제인지** 잰다.  node spike/serve.js 먼저.

   뺀 이유(eerie.js 머리말): 위에서 내려다보는 사무실에 안개를 끼우면 뒤쪽 자리가 사라진다.
   고양이가 20마리까지 늘어나는데 절반이 안 보이면 그건 분위기가 아니라 정보 손실이다.

   그래서 분위기를 재지 않고 **정보 손실**을 잰다: 큰 사무실(냥타워)에 고양이를 꽉 채우고
   **맨 뒤 줄의 고양이가 배경과 얼마나 구별되는지**를 픽셀로 센다. 안개를 켠 화면과 끈
   화면을 같은 프레임에서 번갈아 찍어 비교한다 — 두 판을 따로 부팅하면 조명·시각이 달라진다.

   판정: 뒤쪽 줄의 대비가 안개 없을 때의 **절반 이상**이면 통과. 절반 밑이면 그건
   "약한 안개" 가 아니라 정보 손실이고, 시간대표의 fog 값을 낮춰야 한다.
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9710;
const OUT = path.resolve(__dirname, 'ui') + path.sep;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-fog-' + process.pid);
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

  await send('Emulation.setDeviceMetricsOverride', { width:1400, height:860, deviceScaleFactor:1, mobile:false });
  await send('Page.navigate', { url:'http://localhost:8123/index.html?3d=1&debug=1' });
  await sleep(13000);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1200);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1200);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2400);
  await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
  await sleep(900);

  /* 제일 큰 사무실에 고양이를 꽉 채운다 — 안개가 문제가 되는 건 여기서다 */
  console.log(await ev(`(() => {
    S.tier = 4; S.seed = 4242; S.anchovy = 99999;
    SHOP.forEach(it => { if (it.tier <= S.tier) S.shop[it.id] = 1; });
    buildWorld(true);
    while (S.cats.length < 20 && deskCount() > S.cats.length){
      const c = newCat('냥' + S.cats.length); c.rec = newRecord(1); S.cats.push(c);
    }
    assignDesks(); renderTiles();
    S.cats.forEach(c => { c.needs.energy = 85; c.needs.bladder = 85; c.needs.caffeine = 85; c.needs.fun = 85; });
    document.querySelectorAll('.panel,#topbar,#colTabs,.stagefoot,.clockchip,.foldbtn,.cambtn')
      .forEach(e => e.style.display = 'none');
    const vp = document.getElementById('viewport');
    vp.style.position = 'fixed'; vp.style.inset = '0'; vp.style.zIndex = '9999';
    R3.fit(); R3.camReset(false);
    return JSON.stringify({ 사무실: W.W + '×' + W.H, 고양이: S.cats.length });
  })()`));
  await sleep(6000);

  /* 뒤쪽 줄이 화면에서 어디쯤인지: 격자 z 가 작은(=뒤) 고양이들의 화면 좌표를 투영해서 얻는다 */
  const shot = async (tag) => {
    await ev(`R3.draw()`);
    const p = await send('Page.captureScreenshot', { format:'png', clip:{ x:0, y:0, width:1400, height:860, scale:1 } });
    fs.writeFileSync(OUT + 'fog-' + tag + '.png', Buffer.from(p.data, 'base64'));
  };
  /* 뒤쪽 고양이 주변의 **국부 대비**를 잰다. 고양이가 배경에 녹으면 이 값이 떨어진다. */
  const contrast = async () => ev(`(() => {
    R3.draw();
    const cv = document.getElementById('gl');
    const cats = S.cats.map(c => ({ c, p: R3.project(c.x, c.y, 0.55) })).filter(o => o.p);
    /* 격자 y 가 작은 쪽이 뒤(북쪽 벽 쪽)다. 뒤 1/3 만 본다. */
    const back = cats.sort((a, b) => a.c.y - b.c.y).slice(0, Math.max(3, Math.round(cats.length / 3)));
    const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height;
    const cx = c2.getContext('2d'); cx.drawImage(cv, 0, 0);
    const sx = cv.width / innerWidth, sy = cv.height / innerHeight;
    let sum = 0, n = 0;
    for (const o of back){
      const X = Math.round(o.p.x * sx), Y = Math.round(o.p.y * sy), R = Math.round(22 * sx);
      if (X - R < 0 || Y - R < 0 || X + R >= cv.width || Y + R >= cv.height) continue;
      const d = cx.getImageData(X - R, Y - R, R * 2, R * 2).data;
      let mn = 999, mx = -1;
      for (let i = 0; i < d.length; i += 4){
        const l = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
        if (l < mn) mn = l; if (l > mx) mx = l;
      }
      sum += mx - mn; n++;
    }
    return n ? +(sum / n).toFixed(1) : -1;
  })()`);

  let fail = 0;
  const ok = (c, label, extra) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`); };

  console.log('\n── 안개 상태 ──');
  const st = await ev(`JSON.stringify({ 켜짐: R3E.fog(), 거리: R3.debug().fog })`);
  const S1 = JSON.parse(st);
  ok(S1.켜짐 === true, '기본으로 켜져 있다', JSON.stringify(S1));

  console.log('\n── 뒤쪽 줄의 국부 대비 (정보 손실 판정) ──');
  const withFog = await contrast();
  await shot('on');
  await ev(`R3E.fog(false)`);
  await sleep(500);
  const noFog = await contrast();
  await shot('off');
  await ev(`R3E.fog(true)`);
  await sleep(400);

  const ratio = noFog > 0 ? withFog / noFog : 0;
  console.log(`  안개 켬 ${withFog} · 끔 ${noFog} · 비율 ${(ratio * 100).toFixed(0)}%`);
  ok(ratio >= 0.5, '뒤쪽 고양이가 배경에 안 녹는다 (끈 것의 절반 이상)', `${(ratio*100).toFixed(0)}%`);

  /* 시간대마다 안개 세기가 다르다 — 제일 진한 시간대에서도 버텨야 한다 */
  console.log('\n── 시간대별 ──');
  for (const id of ['morning', 'day', 'evening', 'night']){
    await ev(`setSkyForce('${id}')`);
    await sleep(600);
    const c = await contrast();
    const f = await ev(`JSON.stringify(R3.debug().fog)`);
    const r = noFog > 0 ? c / noFog : 0;
    ok(r >= 0.45, `${id}`, `대비 ${c} (${(r*100).toFixed(0)}%) · 거리 ${f}`);
    await shot(id);
  }
  await ev(`setSkyForce('')`);

  console.log('\n오류: ' + (errs.length ? errs.slice(0,3).join(' | ') : '없음'));
  if (errs.length) fail++;
  console.log('  그림: spike/ui/fog-*.png');
  console.log(fail ? `\n${fail}건 실패` : '\n전부 통과 — 안개가 정보를 지우지 않는다');
  ws.close(); chrome.kill(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
