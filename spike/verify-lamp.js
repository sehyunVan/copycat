/* 등불 반경을 5.5 → 3.2 로 줄인 게 **정보 손실이 아닌지** 잰다.  node spike/serve.js 먼저.

   왜 재는가: 안개 때 똑같은 데서 걸렸다(eerie.js 머리말 · verify-fog.js). 위에서
   내려다보는 사무실이라 분위기를 위해 어둡게 하면 **뒤쪽·통로의 고양이가 사라진다.**
   고양이가 20마리까지 늘어나는 게임에서 절반이 안 보이면 그건 톤앤매너가 아니라 버그다.

   그래서 예쁨을 재지 않고 **고양이가 배경에서 얼마나 떨어져 보이는지**를 픽셀로 센다.
   제일 큰 사무실(냥타워)에 고양이를 꽉 채우고, 등불 반경만 바꿔 같은 프레임을 두 번 찍는다
   (?lr=5.5 가 예전 값이다). 밤이 최악이라 밤만 본다.

   판정: 고양이 하나하나의 국부 대비를 재서 **중앙값이 예전의 80% 이상**이고,
   "거의 안 보이는" 고양이(대비 6 미만)가 **예전보다 늘지 않으면** 통과.
   중앙값만 보면 밝은 웅덩이 안의 고양이가 평균을 끌어올려 통로의 실종을 가린다.
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9714;
const OUT = 'C:/tmp/copycat-tone/';
const W = 1400, H = 860;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-lamp-' + process.pid);
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page; for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); const errs = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text);
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width:W, height:H, deviceScaleFactor:1, mobile:false });
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;

  /* 고양이 하나하나의 국부 대비. 고양이 자리의 밝기와 그 둘레(배경) 밝기의 차다.
     빌보드라 화면에서 위쪽이 몸통이므로 살짝 올려서 잰다. */
  /* **가장 어두운 통로에 고양이를 세우고, 바닥과의 대비를 잰다.**

   지표를 두 번 갈아엎었다. 그 과정을 적어 둔다 — 다음 사람이 같은 순서로 헤맨다.

     1판) 고양이 하나하나의 국부 대비. 버렸다: 중앙값이 19→55→41→15 로 튀었다.
          고양이가 걸어다녀서다. 웅덩이 안에 몇 마리가 서 있느냐가 조명 설정보다
          크게 나오면 그건 조명 지표가 아니다.
     2판) 통로 바닥의 절대 밝기. 결정적이라 좋았는데, **밤 그레이드가 들어오면서
          무너졌다.** 「딥 블루 나이트」는 화면 대부분을 일부러 어둡게 만든다 —
          그러면 이 지표는 「의도한 어둠」과 「정보 손실」을 구별하지 못하고,
          룩을 어둡게 할 때마다 실패한다. 문턱을 올리면 그건 지표를 고친 게 아니라
          답을 고친 것이다.
     3판) 지금. **고양이를 제일 어두운 통로 칸에 직접 세우고** 그 자리에서
          고양이와 바닥의 밝기 차를 잰다. 결정적이고(자리를 내가 정한다),
          어둠 자체가 아니라 **어둠 속에서 안 보이는지**를 잰다.

   판정 기준은 후처리의 색 단계에서 온다: 화면이 22단계로 눌려 담기므로(eerie uLevels)
   한 단계가 밝기 100 중 약 4.5 다. 고양이와 바닥이 같은 단계에 들어가면 고양이는
   사라진다. 그래서 **대비 4.5 미만이면 실종**, 그 두 배(9)를 안전선으로 본다. */
  const CATVIS = `(() => {
    const cv = document.getElementById('gl');
    const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height;
    const cx = c2.getContext('2d');
    const sx = cv.width / innerWidth, sy = cv.height / innerHeight;
    const grab = () => { cx.drawImage(cv, 0, 0); };
    const lum = (px, py, r) => {
      const x = Math.round(px * sx - r), y = Math.round(py * sy - r), s = r * 2;
      if (x < 0 || y < 0 || x + s >= c2.width || y + s >= c2.height) return null;
      const d = cx.getImageData(x, y, s, s).data;
      let a = 0, n = 0;
      for (let i = 0; i < d.length; i += 4){ a += 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]; n++; }
      return a / n / 2.55;                      // 0~100 으로
    };
    /* 한 칸이 화면에서 몇 px 인지 — 재는 크기를 화면 배율에 묶으면 안 된다.
       방이 커지면 카메라가 물러나고, 그때 고정 px 는 고양이가 아니라 책상을 덮는다. */
    const a0 = R3.project(2, 2, 0), a1 = R3.project(3, 2, 0);
    const tile = (a0 && a1) ? Math.max(6, Math.hypot(a1.x - a0.x, a1.y - a0.y)) : 24;

    /* 1) 걸을 수 있는 칸의 바닥 밝기 — 고양이를 치운 상태에서 잰다 */
    const parked = S.cats.map(c => ({ c, x:c.x, y:c.y }));
    S.cats.forEach(c => { c.x = -50; c.y = -50; });
    R3.sync(S.cats, [], 0); R3.draw(); grab();
    const cells = [];
    for (let z = 0; z < W.H; z++) for (let x = 0; x < W.W; x++){
      if (!WALKABLE.has(W.grid[z * W.W + x])) continue;
      const p = R3.project(x + 0.5, z + 0.5, 0.02); if (!p) continue;
      const v = lum(p.x, p.y, Math.max(2, tile * 0.18 * sx)); if (v == null) continue;
      cells.push({ x, z, floor:v, p });
    }
    cells.sort((m, n) => m.floor - n.floor);

    /* 2) 제일 어두운 칸부터 고양이를 세운다 — 최악의 경우를 만든다 */
    const K = Math.min(S.cats.length, 10, cells.length);
    const spots = cells.slice(0, K);
    for (let i = 0; i < K; i++){ S.cats[i].x = spots[i].x + 0.5; S.cats[i].y = spots[i].z + 0.5; }
    R3.sync(S.cats, [], 0); R3.draw(); grab();

    /* 3) 그 자리에서 고양이와 바닥의 밝기 차 */
    const out = [];
    for (let i = 0; i < K; i++){
      const p = R3.project(spots[i].x + 0.5, spots[i].z + 0.5, 0.55);
      if (!p) continue;
      const body = lum(p.x, p.y - tile * 0.12, Math.max(2, tile * 0.20 * sx));
      if (body == null) continue;
      out.push({ 칸:[spots[i].x, spots[i].z], 바닥:+spots[i].floor.toFixed(1),
                 고양이:+body.toFixed(1), 대비:+Math.abs(body - spots[i].floor).toFixed(1) });
    }
    parked.forEach(o => { o.c.x = o.x; o.c.y = o.y; });
    R3.sync(S.cats, [], 0);
    return JSON.stringify({ 통로:cells.length, 잰것:out });
  })()`;

  const run = async (lr) => {
    const q = lr ? '&lr=' + lr : '';
    await send('Page.navigate', { url:`http://localhost:8123/index.html?3d=1&debug=1${q}` });
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
    const info = await ev(`(() => {
      S.tier = 4; S.seed = 4242; S.anchovy = 999999;
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
      vp.style.position='fixed'; vp.style.inset='0'; vp.style.zIndex='9999';
      R3.camReset(false); R3.fit();
      setSkyForce('night');
      return JSON.stringify({ 사무실: W.W+'×'+W.H, 고양이: S.cats.length, tone: (window.R3E && R3E.TONE) || '기본' });
    })()`);
    await sleep(6000);
    const cs = JSON.parse(await ev(CATVIS));
    const p = await send('Page.captureScreenshot', { format:'png', clip:{ x:0,y:0,width:W,height:H,scale:1 } });
    fs.writeFileSync(OUT + 'tower-lr' + (lr || 'def') + '.png', Buffer.from(p.data,'base64'));
    return { info, cs };
  };

  const RADII = (process.argv[2] || '5.5,4.5,4,3.2').split(',').map(Number);
  const rows = [];
  for (const lr of RADII) rows.push([lr, await run(lr)]);

  const med = a => { const s=[...a].sort((x,y)=>x-y); return s.length ? s[Math.floor(s.length/2)] : 0; };
  const LEVEL = 4.5;                 // 후처리 색 단계 하나 (100 / 22)

  console.log(String.fromCharCode(10) + rows[0][1].info + `  · 통로 ${rows[0][1].cs.통로}칸`);
  console.log(String.fromCharCode(10) + '등불 반경'.padEnd(10) + '가장 어두운 칸의 대비'.padStart(22) + '중앙값'.padStart(10) + '실종'.padStart(8));
  for (const [lr, r] of rows){
    const cs = r.cs.잰것.map(o => o.대비);
    const worst = cs.length ? Math.min(...cs) : 0;
    const lost = cs.filter(v => v < LEVEL).length;
    console.log(`${(lr + '칸').padEnd(10)}${worst.toFixed(1).padStart(22)}${med(cs).toFixed(1).padStart(10)}${(lost + '/' + cs.length).padStart(8)}`);
  }

  /* 판정: 제일 어두운 통로 칸에 세운 고양이가 **색 단계 하나 이상** 떠 있어야 한다.
     그 밑이면 바닥과 같은 색으로 눌려 담겨서 화면에서 사라진다.
     어둠 자체는 재지 않는다 — 어두운 방은 이 그림체의 값어치고, 안 보이는 방이 고장이다. */
  const last = rows[rows.length - 1][1].cs.잰것.map(o => o.대비);
  const worst = last.length ? Math.min(...last) : 0;
  const ok = worst >= LEVEL;
  console.log(String.fromCharCode(10) + `최악 ${worst.toFixed(1)} (색 단계 ${LEVEL})  →  ${ok ? '통과' : '실패 — 이 어둠에서는 고양이가 바닥에 녹는다'}`);
  if (!ok) console.log('  ' + JSON.stringify(rows[rows.length-1][1].cs.잰것.slice(0, 4)));
  if (errs.length) console.log('에러:', [...new Set(errs)].slice(0,5));
  ws.close(); chrome.kill(); process.exit(ok ? 0 : 1);
})();
