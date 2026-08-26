/* 35번 — 「누르면 열리는 것」을 **안 건드리고** 알 수 있게. 두 안을 재서 고른다.

   대상은 **문 넷**이다 — 💿 CD 플레이어 · 📅 벽걸이 달력 · 📌 제휴 게시판 · 📕 도배 견본책.
   고양이의 숫자를 바꾸는 가구가 아니라 **설정을 바꾸는 상호작용**이 걸린 물건들이고,
   이 게임의 UI 를 일부러 방 안에 놓은 것들이다.

   질문은 「빛나는 게 정말 안 좋은 선택지인가」였고, 그건 취향으로 답할 게 아니라
   같은 자리에서 찍어 재는 것이다. 세 판을 만든다:

     off    지금 (표시 없음) — 기준선
     knob   문 넷에 같은 놋쇠 손잡이 하나 (발광 없이 형태로만)
     glow   문 넷에 찬 흰빛 발광 테두리 (「빛나는 게 안 좋은가」의 그 안)

   각각 **낮과 밤** 둘. 낮은 손잡이가 읽히는지, 밤은 발광이 「켜져 있다」와 헷갈리는지가
   각각 그때만 드러난다(모니터·스탠드·창유리·천장등이 이미 그 색으로 빛난다).

   재는 것 넷:
     · 표시가 화면에서 **몇 px** 인가 (기준선과 달라진 픽셀 수)
     · 그 픽셀이 **켜진 모니터 색과 얼마나 가까운가** — 가까우면 한 단어를 두 뜻으로 쓰는 것이다
     · 방의 **채도**를 얼마나 밀어 올리는가 (이 화면은 채도를 절반으로 눌러 내보낸다)
     · 달라진 픽셀이 **몇 군데에 흩어져 있나** — 스무 군데가 깜빡이면 그건 정보가 아니라 노이즈다

   node spike/serve.js 를 먼저 띄운다.  node spike/shot-mark.js
   나오는 것: spike/ui/mark-6.png (여섯 칸 한 장) · mark-<mode>-<sky>.png (낱장) */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9567;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const OUT = path.resolve(__dirname, 'ui') + path.sep;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MODES = [
  { id:'off',  n:'표시 없음 (지금)', d:'기준선. 어느 물건을 누를 수 있는지 알 방법이 없다' },
  { id:'knob', n:'손잡이',           d:'문 넷에 같은 놋쇠 손잡이 하나. 발광 없이 형태로만' },
  { id:'glow', n:'발광 테두리',      d:'문 넷에 찬 흰빛 후광. 등불색은 안 쓴다(그건 「켜져 있다」다)' },
];
const SKIES = [{ id:'day', n:'낮' }, { id:'night', n:'밤' }];
const CELL_W = 500, IMG_H = 300, HEAD_H = 46, PAD = 10;

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-mark');
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
  await send('Emulation.setDeviceMetricsOverride', { width:1400, height:900, deviceScaleFactor:1, mobile:false });

  /* 판 하나를 페이지 안에 만들어 두고 찍을 때마다 한 칸씩 그린다.
     여섯 장을 한 번에 넘기면 표현식이 몇 MB 가 되어 CDP 가 못 받는다. */
  const newSheet = async () => ev(`(() => {
    const C = ${CELL_W}, IH = ${IMG_H}, HH = ${HEAD_H}, P = ${PAD};
    const cv = document.createElement('canvas');
    cv.width = C*3 + P*4; cv.height = (HH + IH)*2 + P*3;
    const g = cv.getContext('2d');
    g.fillStyle = '#151515'; g.fillRect(0,0,cv.width,cv.height);
    window.__sheet = { cv, g, C, IH, HH, P };
    return [cv.width, cv.height];
  })()`);

  /* 문서가 열리기 **전에** 저장을 지운다 — 게임은 로드 순간에 읽으므로 그 뒤에
     지워도 늦다. 그래야 세 판이 다 첫 회차에서 출발한다. */
  await send('Page.addScriptToEvaluateOnNewDocument',
    { source: 'try { localStorage.clear(); } catch(e){}' });

  async function boot(mode){
    await send('Page.navigate', { url: `${BASE}/index.html?3d=1&debug=1&mark=${mode}` });
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
    await sleep(700);
    /* **비품을 전부 사 둔다.** 재려는 것은 표시인데 표시할 가구가 방에 없으면
       아무것도 확인하지 않는다(verify-aug24 가 「가구없음」으로 헛통과한 그 자리다).
       씨앗도 고정한다 — 세 판을 같은 방에서 찍어야 픽셀 차이가 표시의 것이 된다. */
    return await ev(`(() => {
      /* 씨앗을 박고 **다시 깐다** — buildWorld() 는 저장된 배치를 그대로 쓰므로
         씨앗만 바꿔서는 방이 안 바뀐다. true 라야 생성기가 다시 돈다. */
      S.seed = 20260825; S.tier = 3; S.anchovy = 9999999;
      /* 견본책은 **산 물건**이라 도장을 buildWorld 전에 찍어야 벽에 걸린다
         (ensureWallItem 이 buildWorld 안에서 돈다). 첫 회차가 뒤에 찍어서 문이 3/4 였다. */
      S.shop = { binder: 1 };
      buildWorld(true);
      while (S.cats.length < 6 && deskCount() > S.cats.length){
        const c = newCat('냥' + S.cats.length); c.rec = newRecord(1); S.cats.push(c);
      }
      /* **사지 않고 격자에 심는다.** buyItem 의 자리 잡기는 난수라(placeFurniture)
         같은 방이 두 번 안 나오고, 그러면 판끼리 픽셀을 비교할 수가 없다.
         verify-aug24 가 「없는 가구는 격자에 직접 심는다」로 같은 문제를 푼 그 자리다. */
      /* 문 넷이 방에 **다 있어야** 한다. CD 플레이어는 생성기가 깔아 주고(ensureJuke),
         달력·게시판은 벽 장식 승격(ensureCal·ensureBoard)이라 이미 있다. 견본책만
         산 물건이라 없으므로 상점 도장을 찍어 벽에 걸리게 한다. 그 밖에 가구를 몇 개
         더 심는 이유는 **표시가 안 붙은 것들 사이에서** 보이는지를 재기 때문이다. */
      const want = [TILE.COFFEE, TILE.COPIER, TILE.SERVER, TILE.GAME,
                    TILE.TOWER, TILE.SCRATCH, TILE.HAMMOCK, TILE.YARN];
      const free = [];
      for (let y = 2; y < W.H - 2; y++) for (let x = 2; x < W.W - 2; x++)
        if (W.grid[y*W.W + x] === TILE.FLOOR
            && !W.desks.some(d => d.seat.x === x && d.seat.y === y)) free.push([x, y]);
      want.forEach((t, i) => {
        const c = free[Math.floor(i * free.length / want.length)];
        if (c) W.grid[c[1]*W.W + c[0]] = t;
      });
      want.forEach(t => { const u = (TILE_INFO[t]||{}).use;
        if (u) (W.facilities[u] = W.facilities[u] || []); });
      snapshotWorld();
      assignDesks();
      const st = document.createElement('style');
      st.textContent = '#topbar,#panelInbox,#panelBiz,#colTabs,#ticker,.clockchip,.cambtn,'
        + '.foldbtn,#btnFoldL,#btnFoldR,#btnCam,#clock,.edithint,#tags3d,#fx3d,.toast{visibility:hidden !important}';
      document.head.appendChild(st);
      R3.followOn(false);
      /* 게임에서 실제로 보는 거리로 잰다 — 카메라 추적 배율이 0.30 이라
         멀리서 안 보이는 표시를 놓고 「안 보인다」고 하면 그건 틀린 실측이다. */
      R3.camSet({ center:true, az:0.72, el:0.52, zoom:0.56 });
      renderTiles(); renderNight(); R3.clearTags();
      document.querySelectorAll('.veil,.coach,.coachring,.bubble').forEach(e => e.remove());
      const d = R3.debug();
      const doors = [TILE.JUKE, TILE.CAL, TILE.BOARD, TILE.BINDER];
      const 문 = doors.filter(t => W.grid.includes(t)
        || (W.wallDecor || []).some(x => x.tile === t)).length;
      return { 표시: d.mark, 방: W.W + 'x' + W.H, 문, 기계수: W.grid.filter(t => t === TILE.COFFEE || t === TILE.COPIER
        || t === TILE.SERVER || t === TILE.FEEDER || t === TILE.GAME || t === TILE.GYM
        || t === TILE.LAB || t === TILE.ROCKET || t === TILE.SNACK).length };
    })()`);
  }

  /* 여섯 장을 다 찍은 **뒤에** 판을 만든다. 판은 페이지 안의 캔버스라 모드마다
     새로 띄우는 동안 사라진다 — 마지막 페이지에서 한 장씩 넘겨 그린다. */
  const shots = {}, meta = {};
  let clip = null;

  for (const m of MODES){
    const info = await boot(m.id);
    console.log(`\n── ${m.n} ──  표시 ${info.표시.mode} ${info.표시.n}개 · 문 ${info.문}/4 · 방 ${info.방}`);
    meta[m.id] = info;
    if (!clip){
      clip = JSON.parse(await ev(`(() => { const b = document.querySelector('#gl').getBoundingClientRect();
        const H = Math.min(b.height, b.width * 0.62);
        return JSON.stringify({ x:Math.round(b.x), y:Math.round(b.y + (b.height - H)/2),
                                width:Math.round(b.width), height:Math.round(H) }); })()`));
      console.log('   무대 ' + JSON.stringify(clip));
    }
    for (const sky of SKIES){
      await ev(`(() => { setSkyForce('${sky.id}'); renderNight(); R3.draw(); })()`);
      await sleep(1500);
      const b64 = (await send('Page.captureScreenshot', { format:'png', clip: { ...clip, scale:1 } })).data;
      shots[m.id + '|' + sky.id] = b64;
      fs.writeFileSync(OUT + `mark-${m.id}-${sky.id}.png`, Buffer.from(b64, 'base64'));
    }
  }

  /* 재는 자리 — 마지막 판(pilot)의 램프 위치를 화면 좌표로 옮긴다.
     R3.project 는 무대 상자 기준이므로 페이지 좌표로 올리고, 자른 만큼 다시 뺀다. */
  const PTS = JSON.parse(await ev(`(() => {
    const d = R3.debug();
    const vp = document.querySelector('#viewport').getBoundingClientRect();
    const out = (d.mark.pts || []).map(q => {
      const s = R3.project(q[0] - 0.5, q[2] - 0.5, q[1]);
      return s ? { x: Math.round(s.x + vp.x - ${clip.x}), y: Math.round(s.y + vp.y - ${clip.y}) } : null;
    }).filter(Boolean);
    return JSON.stringify(out);
  })()`));
  console.log('재는 자리 ' + PTS.length + '곳  ' + JSON.stringify(PTS.slice(0, 3)));

  /* ---------- 재기 ----------
     기준선(off)과 비교해서 달라진 픽셀만 본다. 그게 곧 표시의 화면 지분이다. */
  await ev(`(() => {
    const C = ${CELL_W}, IH = ${IMG_H}, HH = ${HEAD_H}, P = ${PAD};
    const cv = document.createElement('canvas');
    cv.width = C*3 + P*4; cv.height = (HH + IH)*2 + P*3;
    const g = cv.getContext('2d');
    g.fillStyle = '#151515'; g.fillRect(0,0,cv.width,cv.height);
    window.__sheet = { cv, g, C, IH, HH, P };
    window.__base = {};
    return 1;
  })()`);

  const num = {};
  for (let si = 0; si < SKIES.length; si++){
    for (let mi = 0; mi < MODES.length; mi++){
      const m = MODES[mi], sky = SKIES[si];
      const key = m.id + '|' + sky.id;
      const r = await ev(`(async () => {
        const S = window.__sheet, g = S.g;
        const col = ${mi}, row = ${si};
        const x = S.P + col * (S.C + S.P), y = S.P + row * (S.HH + S.IH + S.P);
        const img = await new Promise(rr => { const im = new Image(); im.onload = () => rr(im);
          im.src = 'data:image/png;base64,${shots[key]}'; });
        /* 머리글 */
        g.fillStyle = '#F2F2F0'; g.font = '700 15px system-ui,"Malgun Gothic",sans-serif';
        g.fillText(${JSON.stringify(m.n + ' · ' + sky.n)}, x, y + 17);
        g.fillStyle = '#9A9A96'; g.font = '400 11.5px system-ui,"Malgun Gothic",sans-serif';
        g.fillText(${JSON.stringify(m.d)}, x, y + 34);
        /* 그림 */
        const sc = Math.max(S.C / img.width, S.IH / img.height);
        const dw = img.width * sc, dh = img.height * sc;
        g.save(); g.beginPath(); g.rect(x, y + S.HH, S.C, S.IH); g.clip();
        g.drawImage(img, x + (S.C - dw)/2, y + S.HH + (S.IH - dh)/2, dw, dh);
        g.restore();
        g.strokeStyle = '#2A2A2A'; g.strokeRect(x + 0.5, y + S.HH + 0.5, S.C - 1, S.IH - 1);

        /* 원본 해상도로 한 장 떠서 재고, 기준선은 저장해 둔다 */
        const sc2 = document.createElement('canvas');
        sc2.width = img.width; sc2.height = img.height;
        const g2 = sc2.getContext('2d', { willReadFrequently:true });
        g2.drawImage(img, 0, 0);
        const d = g2.getImageData(0, 0, img.width, img.height).data;
        const skyKey = ${JSON.stringify(sky.id)};
        if (${JSON.stringify(m.id)} === 'off'){ window.__base[skyKey] = d; }
        const base = window.__base[skyKey];
        /* **국부 대비로 잰다.** 차분으로는 못 잰다 — 이 화면에는 프레임마다 다른 필름
           그레인이 있어서(eerie 의 grade grain) 같은 방을 두 번 찍어도 픽셀이 다르고,
           첫 회차가 그 잡음을 7,769px 짜리 「표시」로 읽었다. 색으로 세는 것도 안 된다:
           그레이드가 노출·리프트·틴트를 다 지나가므로 화면 색이 재질 색이 아니다.

           표시를 붙인 자리는 알고 있으니(R3.debug().mark.pts) 그 자리를 화면에 투영해서
           **가운데 9×9 와 그 둘레 31×31 의 밝기 차**를 잰다. 22번이 「안개가 뒤쪽 고양이의
           국부 대비를 지우는지」를 쟀던 그 축이고, 그레이드를 지나도 뜻이 남는다.
           기준선(off)의 같은 자리와 비교하면 그 차이가 곧 표시가 만든 대비다. */
        const L = i => d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114;
        const boxL = (cx, cy, r) => { let s = 0, n = 0;
          for (let y = Math.max(0, cy-r); y < Math.min(img.height, cy+r+1); y++)
            for (let x = Math.max(0, cx-r); x < Math.min(img.width, cx+r+1); x++){
              s += L((y*img.width + x) * 4); n++; }
          return n ? s/n : 0; };
        const pts = ${JSON.stringify(PTS)};
        let sum = 0, worst = 0, cnt = 0;
        for (const q of pts){
          if (!q) continue;
          const mid = boxL(q.x, q.y, 4);
          const ring = (boxL(q.x, q.y, 15) * (31*31) - mid * (9*9)) / (31*31 - 9*9);
          const c = mid - ring;
          sum += c; if (c > worst) worst = c; cnt++;
        }
        /* 채도 — 채널 폭의 평균. 이 화면은 채도를 절반으로 눌러 내보내므로 새 표시가
           그 값을 얼마나 밀어 올리는지가 「팔레트를 깨는가」의 숫자다. */
        let sat = 0, n2 = 0;
        for (let i = 0; i < d.length; i += 4){
          sat += Math.max(d[i], d[i+1], d[i+2]) - Math.min(d[i], d[i+1], d[i+2]); n2++;
        }
        return { sat: +(sat/n2).toFixed(1), 자리: cnt,
                 평균대비: cnt ? +(sum/cnt).toFixed(1) : 0, 최대대비: +worst.toFixed(1) };
      })()`);
      num[key] = r;
    }
  }

  /* 켜진 모니터 색 — 새 표시가 그 색과 얼마나 가까운가. 가까우면 「켜져 있다」와
     「효과가 있다」를 한 단어로 쓰는 것이다. */
  const mon = JSON.parse(await ev(`(() => {
    const c = R3.skyInfo();
    return JSON.stringify({ 자락: c.색 });
  })()`));

  console.log('\n── 잰 것 ──');
  console.log('  판                     채도  잰 자리  평균 대비  최대 대비');
  for (const sky of SKIES){
    for (const m of MODES){
      const r = num[m.id + '|' + sky.id];
      console.log(`  ${(m.n + ' · ' + sky.n).padEnd(20)} ${String(r.sat).padStart(5)}` +
        `  ${String(r.자리).padStart(6)} ${String(r.평균대비).padStart(9)} ${String(r.최대대비).padStart(9)}`);
    }
  }
  const sheet = await ev(`window.__sheet.cv.toDataURL('image/png').slice(22)`);
  fs.writeFileSync(OUT + 'mark-6.png', Buffer.from(sheet, 'base64'));
  console.log('\n오류: ' + (errs.length ? errs.slice(0,3).join(' | ') : '없음'));
  console.log('→ spike/ui/mark-6.png  (낱장은 mark-<mode>-<sky>.png)');
  ws.close(); chrome.kill();
  process.exit(0);
})();
