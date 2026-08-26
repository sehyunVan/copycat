/* **안개는 2026-08-26 에 껐다.** 이 검사는 그 결정이 지켜지는지와, 껐을 때 뒤쪽이
   실제로 잘 보이는지를 잰다.  node spike/serve.js 먼저.

   원래 이 파일은 반대 질문이었다 — 「안개를 켰는데 정보가 안 지워지나」. 답은 계속
   아슬아슬했고(뒤쪽 고양이 대비가 안개 없을 때의 절반 언저리), 결국 다른 데서 값을
   치렀다: 34번에서 가구 톤 아홉을 벌릴 때 안개가 절반을 먹었고, 35번에서 문 표시
   네 안을 잴 때 **발광 테두리가 픽셀 단위로 0** 이었다. 분위기 한 겹을 얻고 정보를
   여러 겹 잃고 있었다.

   그래서 질문을 뒤집는다. 재는 것은 그대로다 — 큰 사무실에 고양이를 꽉 채우고
   **맨 뒤 줄의 고양이가 배경과 얼마나 구별되는지**를 픽셀로 센다. 다만 이제는
   안개를 켠 쪽이 기준선이 아니라 **비교 대상**이다: 켜면 얼마나 잃는지가 이 파일이
   남기는 기록이고, 스위치(`R3E.fog`)는 그 비교를 위해 남겨 뒀다.
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
  ok(S1.켜짐 === false, '기본으로 꺼져 있다', JSON.stringify(S1));

  console.log('\n── 뒤쪽 줄의 국부 대비 ──');
  const noFog = await contrast();
  await shot('off');
  /* 켜서 얼마나 잃는지 기록으로 남긴다 — 스위치를 남겨 둔 이유가 이 비교다 */
  await ev(`R3E.fog(true)`);
  await sleep(500);
  const withFog = await contrast();
  await shot('on');
  await ev(`R3E.fog(false)`);
  await sleep(400);

  const ratio = noFog > 0 ? withFog / noFog : 0;
  console.log(`  안개 끔 ${noFog} · 켬 ${withFog} · 켜면 ${(ratio * 100).toFixed(0)}% 로 준다`);
  ok(noFog > 0, '뒤쪽 고양이가 배경과 구별된다', `대비 ${noFog}`);

  /* 시간대가 바뀌어도 뒤쪽이 읽혀야 한다. 안개가 없으므로 이제 이건 **조명**의 검사다 —
     밤이 제일 어렵고, 거기서 무너지면 시간대표의 hemi/lamp 를 봐야 한다. */
  console.log('\n── 시간대별 (안개 없음) ──');
  for (const id of ['morning', 'day', 'evening', 'night']){
    await ev(`setSkyForce('${id}')`);
    await sleep(600);
    const c = await contrast();
    const r = noFog > 0 ? c / noFog : 0;
    ok(c >= 2, `${id}`, `대비 ${c} (낮 대비 ${(r*100).toFixed(0)}%)`);
    await shot(id);
  }
  await ev(`setSkyForce('')`);

  console.log('\n오류: ' + (errs.length ? errs.slice(0,3).join(' | ') : '없음'));
  if (errs.length) fail++;
  console.log('  그림: spike/ui/fog-*.png');
  console.log(fail ? `\n${fail}건 실패` : '\n전부 통과 — 안개 없이 뒤쪽까지 읽힌다');
  ws.close(); chrome.kill(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
