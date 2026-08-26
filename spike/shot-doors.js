/* 35번 — 「누르면 열리는 것」을 안 건드리고 알 수 있게. **문 넷을 클로즈업으로** 재서 고른다.

   대상은 💿 CD 플레이어 · 📅 벽걸이 달력 · 📌 제휴 게시판 · 📕 도배 견본책.
   고양이의 숫자를 바꾸는 가구가 아니라 **설정을 바꾸는 상호작용**이 걸린 물건들이고,
   이 게임의 UI 를 일부러 방 안에 놓은 것들이다.

   **방 전체 샷으로는 판정이 안 된다** — 한 번 찍어 봤다(spike/ui/mark-6.png).
   벽에 걸린 셋이 화면에서 10px 남짓이라 세 판이 구분이 안 간다. 사람이 그 물건을
   보는 거리는 카메라가 고양이를 따라갈 때의 배율(0.30)이나 첫 출근 안내의 클로즈업이고,
   그 거리에서 재야 한다. 그래서 **문마다 한 칸씩** 찍는다.

     off   지금 (표시 없음)
     knob  같은 놋쇠 손잡이 하나 — 발광 없이 형태로만
     glow  찬 흰빛 발광 테두리 — 「빛나는 게 정말 안 좋은가」의 그 안
           (등불색은 안 쓴다. 이 방에서 그 색은 이미 「켜져 있다」다)

   낮과 밤 두 장. 밤이 중요하다 — 발광이 모니터·스탠드·창유리와 헷갈리는지는 어두울 때
   드러나고, 손잡이가 안 보이는 것도 그때 드러난다.

   node spike/serve.js 를 먼저 띄운다.  node spike/shot-doors.js
   나오는 것: spike/ui/doors-day.png · doors-night.png */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9573;
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
const CELL_W = 300, IMG_H = 190, HEAD_H = 30, PAD = 9, ROW_H = 26;

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-doors');
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
  const errs = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => { const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errs.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' ')); });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;
  await send('Emulation.setDeviceMetricsOverride', { width:1200, height:820, deviceScaleFactor:1, mobile:false });
  /* 문서가 열리기 전에 저장을 지운다 — 세 판이 다 같은 방에서 출발해야 한다 */
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try { localStorage.clear(); } catch(e){}' });

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
    return JSON.parse(await ev(`(() => {
      /* 견본책 도장을 buildWorld **전에** 찍어야 벽에 걸린다(ensureWallItem) */
      S.seed = 20260825; S.tier = 3; S.anchovy = 9999999; S.shop = { binder: 1 };
      buildWorld(true);
      while (S.cats.length < 5 && deskCount() > S.cats.length){
        const c = newCat('냥' + S.cats.length); c.rec = newRecord(1); S.cats.push(c);
      }
      assignDesks();
      const st = document.createElement('style');
      st.textContent = '#topbar,#panelInbox,#panelBiz,#colTabs,#ticker,.clockchip,.cambtn,'
        + '.foldbtn,#btnFoldL,#btnFoldR,#btnCam,#clock,.edithint,#tags3d,#fx3d,.toast{visibility:hidden !important}';
      document.head.appendChild(st);
      R3.followOn(false);
      renderTiles(); renderNight(); R3.clearTags();
      document.querySelectorAll('.veil,.coach,.coachring,.bubble').forEach(e => e.remove());
      const d = R3.debug();
      /* 문 넷의 자리와 이름 — 표시가 없는 판(off)에서도 자리는 찍힌다 */
      const name = t => (TILE_INFO[t] || {}).n || '?';
      const em = t => (TILE_INFO[t] || {}).em || '';
      const doors = [];
      for (const t of [TILE.JUKE, TILE.CAL, TILE.BOARD, TILE.BINDER]){
        let at = null;
        for (let y = 0; y < W.H && !at; y++) for (let x = 0; x < W.W && !at; x++)
          if (W.grid[y*W.W + x] === t) at = { x, y, up: 0.55 };
        if (!at){ const wd = (W.wallDecor || []).find(v => v.tile === t);
          if (wd) at = { x: wd.x, y: wd.y, up: 1.5, face: wd.face }; }
        if (at) doors.push({ tile:t, n: em(t) + ' ' + name(t), at });
      }
      return JSON.stringify({ 표시: d.mark.mode, 표시수: d.mark.n, 문: doors });
    })()`));
  }

  const shots = {};                        // `${mode}|${sky}|${i}` → base64
  let doors = null;
  const boxes = {};                        // `${sky}|${i}` → 크롭 상자 (첫 판에서 한 번 잡는다)

  for (const m of MODES){
    const info = await boot(m.id);
    if (!doors) doors = info.문;
    console.log(`\n── ${m.n} ──  표시 ${info.표시} ${info.표시수}개 · 문 ${info.문.length}/4`);
    for (const sky of ['day','night']){
      await ev(`(() => { setSkyForce('${sky}'); renderNight(); })()`);
      for (let i = 0; i < doors.length; i++){
        const d = doors[i];
        /* 첫 출근 안내(32번)의 클로즈업과 같은 손잡이를 쓴다 — 그 각·그 거리가
           이 게임이 「이 물건을 봐라」 할 때 쓰는 각이다. */
        await ev(`R3.camSet({ at:{ x:${d.at.x}, y:${d.at.y}, up:${d.at.up} }, zoom:0.19, el:0.44 })`);
        await sleep(1100);
        /* **판이 문제였다.** 1200px 캡처를 300px 칸에 넣으면 4배로 줄어들고, 7px 짜리
           표시는 2px 이 되어 사라진다. 네 판을 「구분이 안 간다」고 읽은 게 그 때문이다.
           그래서 문 자리를 화면에 투영해서 **그 자리를 칸 크기 그대로 1:1 로** 잘라 온다. */
        const bk = `${sky}|${i}`;
        const box = boxes[bk] || (boxes[bk] = JSON.parse(await ev(`(() => {
          const vp = document.querySelector('#viewport').getBoundingClientRect();
          const s = R3.project(${d.at.x}, ${d.at.y}, ${d.at.up});
          const cx = s ? s.x + vp.x : vp.x + vp.width/2, cy = s ? s.y + vp.y : vp.y + vp.height/2;
          return JSON.stringify({ x: Math.max(0, Math.round(cx - ${CELL_W}/2)),
                                  y: Math.max(0, Math.round(cy - ${IMG_H}/2)),
                                  width: ${CELL_W}, height: ${IMG_H} });
        })()`)));
        shots[`${m.id}|${sky}|${i}`] =
          (await send('Page.captureScreenshot', { format:'png', clip: { ...box, scale:1 } })).data;
      }
      console.log(`   ${sky} — ${doors.length}칸`);
    }
  }

  /* 판 둘 — 낮 한 장, 밤 한 장. 행이 문 넷, 열이 세 판이다. */
  for (const sky of ['day','night']){
    await ev(`(() => {
      const C = ${CELL_W}, IH = ${IMG_H}, HH = ${HEAD_H}, P = ${PAD}, RH = ${ROW_H};
      const cv = document.createElement('canvas');
      cv.width = C*${MODES.length} + P*(${MODES.length}+1); cv.height = HH + (${doors.length}) * (RH + IH + P) + P;
      const g = cv.getContext('2d');
      g.fillStyle = '#151515'; g.fillRect(0,0,cv.width,cv.height);
      ${JSON.stringify(MODES.map(m => m.n))}.forEach((n, k) => {
        g.fillStyle = '#D8D8D4'; g.font = '700 12.5px system-ui,"Malgun Gothic",sans-serif';
        g.fillText(n, P + k * (C + P), 19);
      });
      window.__sheet = { cv, g, C, IH, HH, P, RH };
      return 1;
    })()`);
    /* 열 머리글은 각 행 위에 다시 적는 대신 맨 위에 한 번만 — 위에서 그렸다 */
    for (let i = 0; i < doors.length; i++){
      for (let k = 0; k < MODES.length; k++){
        const key = `${MODES[k].id}|${sky}|${i}`;
        await ev(`(async () => {
          const S = window.__sheet, g = S.g;
          const x = S.P + ${k} * (S.C + S.P);
          const y = S.HH + ${i} * (S.RH + S.IH + S.P);
          const img = await new Promise(r => { const im = new Image(); im.onload = () => r(im);
            im.src = 'data:image/png;base64,${shots[key]}'; });
          if (${k} === 0){
            g.fillStyle = '#9AE0B0'; g.font = '700 12.5px system-ui,"Malgun Gothic",sans-serif';
            g.fillText(${JSON.stringify(doors[i].n)}, x, y + 17);
          }
          const sc = Math.max(S.C / img.width, S.IH / img.height);
          const dw = img.width * sc, dh = img.height * sc;
          g.save(); g.beginPath(); g.rect(x, y + S.RH, S.C, S.IH); g.clip();
          g.drawImage(img, x + (S.C - dw)/2, y + S.RH + (S.IH - dh)/2, dw, dh);
          g.restore();
          g.strokeStyle = '#2A2A2A'; g.strokeRect(x + 0.5, y + S.RH + 0.5, S.C - 1, S.IH - 1);
          return 1;
        })()`);
      }
    }
    const b64 = await ev(`window.__sheet.cv.toDataURL('image/png').slice(22)`);
    fs.writeFileSync(OUT + `doors-${sky}.png`, Buffer.from(b64, 'base64'));
    console.log(`→ spike/ui/doors-${sky}.png`);
  }

  console.log('\n오류: ' + (errs.length ? errs.slice(0,3).join(' | ') : '없음'));
  ws.close(); chrome.kill();
  process.exit(0);
})();
