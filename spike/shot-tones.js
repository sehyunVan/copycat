/* 가구 톤 아홉 벌을 **한 장으로** 찍는다 — 레퍼런스 아홉 장과 같은 배치다.
   node spike/serve.js 를 먼저 띄운다.  node spike/shot-tones.js

   찍는 것 말고 두 가지를 같이 잰다:
     · **고양이 털색이 안 바뀌는가.** 레퍼런스에서는 벌을 갈 때 고양이까지 같이
       회색이 됐는데 그건 인테리어가 아니라 직원이 바뀐 것이다. 화면 픽셀로 재면
       빛이 섞여 못 가르므로 **재질에 실린 값**을 아홉 번 읽어 비교한다
     · **어울리는 벽지·바닥이 같이 따라오는가.** 벌만 갈면 방의 절반이 옛 벌이다

   나오는 것: spike/ui/tones-9.png (아홉 칸 한 장) · spike/ui/tone-<id>.png (낱장 아홉) */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9553;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const OUT = path.resolve(__dirname, 'ui') + path.sep;
/* 카드 그림이 나가는 자리 — spike 산출물이 아니라 **게임 에셋**이다.
   견본책이 런타임에 읽고, 배포 도구가 인라인한다(tools/pack-single.js · collect.js). */
const CARD = path.resolve(__dirname, '..', 'assets', 'tones') + path.sep;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 칸 하나의 치수. 레퍼런스와 같은 비율(가로 세 칸)이다. */
const CELL_W = 500, IMG_H = 300, HEAD_H = 46, PAD = 10;

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-tones');
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
  await sleep(700);

  /* 사무실을 세운다 — 등급 3(냥코 소형 빌딩). 책상이 아홉이라 가구가 고르게 깔리고,
     방이 화면에 다 들어온다. 카메라는 아홉 장 내내 **한 자리에 못박는다**:
     각도가 달라지면 벌이 아니라 구도를 비교하게 된다. */
  await ev(`(() => {
    S.tier = 2; S.anchovy = 9999999; S.shop.binder = 1;
    while (S.cats.length < 7 && deskCount() > S.cats.length){
      const c = newCat('냥' + S.cats.length); c.rec = newRecord(1); S.cats.push(c);
    }
    buildWorld(); assignDesks();
    /* 아홉 벌과 그 짝(벽지·바닥)을 전부 사 둔다 */
    DECOR.TONES.forEach(t => { decorBuy(t.id);
      if (t.pair){ decorBuy(t.pair.wall); decorBuy(t.pair.floor); } });
    /* **빛을 낮으로 못박는다.** 아홉 장을 비교하는 사진인데 시계가 흐르면 저녁 주황이
       벌 위에 얹혀서, 무엇이 벌의 색이고 무엇이 시간대인지 못 가른다(15번이 갈라 둔
       두 축이 여기서 다시 붙는다). ?debug=1 에서만 열리는 손잡이다. */
    if (typeof setSkyForce === 'function') setSkyForce('day');
    /* 화면의 살림살이는 **자리를 그대로 둔 채** 감춘다(display 가 아니라 visibility) —
       지우면 한 기둥 배치가 무너져서 무대 크기가 아홉 장마다 달라진다. */
    const st = document.createElement('style');
    st.textContent = '#topbar,#panelInbox,#panelBiz,#colTabs,#ticker,.clockchip,.cambtn,'
      + '.foldbtn,#btnFoldL,#btnFoldR,#btnCam,#clock,.edithint,#tags3d,#fx3d,.toast{visibility:hidden !important}';
    document.head.appendChild(st);
    R3.followOn(false);
    R3.camSet({ center:true, az:0.72, el:0.56, zoom:0.42 });
    renderTiles(); renderRight(); renderNight();
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e => e.remove());
    /* 말풍선·이름표는 뺀다 — 아홉 칸에 글자가 겹쳐 들어오면 색을 못 본다 */
    R3.clearTags();
    document.querySelectorAll('.bubble').forEach(e => e.remove());
    return S.tier;
  })()`);
  await sleep(2500);

  /* 자르는 자리는 **캔버스**다. 패널을 감췄으니 캔버스가 통째로 드러나고,
     거기서 5:3 을 가운데로 잘라 아홉 칸에 넣는다. */
  const clip = await ev(`(() => { const b = document.querySelector('#gl').getBoundingClientRect();
    const H = Math.min(b.height, b.width * 0.62);
    return JSON.stringify({ x:Math.round(b.x), y:Math.round(b.y + (b.height - H)/2),
                            width:Math.round(b.width), height:Math.round(H) }); })()`);
  const VP = JSON.parse(clip);
  console.log('무대 ' + JSON.stringify(VP));

  /* **가구를 잰다.** 칸 전체의 평균은 벽과 바닥이 대부분이라, 벌이 갈렸는지를
     묻는 질문에 거의 답하지 않는다(그 값으로는 「차가운 회색」과 「블루 그레이」가
     rgb 거리 2.2 였다). 카메라가 아홉 장 내내 한 자리에 못박혀 있으므로,
     책상 상판과 의자 등받이의 **화면 좌표를 한 번 구해서** 아홉 번 같은 자리를 뜬다. */
  const spots = JSON.parse(await ev(`(() => {
    const b = document.querySelector('#gl').getBoundingClientRect();
    const d = W.desks[Math.floor(W.desks.length/2)];
    const P = (x, y, up) => { const p = R3.project(x, y, up); return p ? { x:Math.round(p.x), y:Math.round(p.y) } : null; };
    return JSON.stringify({
      책상: P(d.desk.x, d.desk.y, 0.76),          // 상판 — PAL.wood
      top: Math.round(b.y) });
  })()`));
  console.log('재는 자리 ' + JSON.stringify(spots));

  const tones = JSON.parse(await ev(`JSON.stringify(DECOR.TONES.map(t => ({
    id:t.id, n:t.n, note:t.note, chips:t.chips || [],
    pair: t.pair ? { wall: DECOR.wallById[t.pair.wall].n, floor: DECOR.floorById[t.pair.floor].n } : null })))`));

  /* 아홉 칸 판을 페이지 안에 한 번 만들어 두고, 찍을 때마다 한 칸씩 그린다.
     아홉 장을 한 번에 넘기면 표현식이 몇 MB 가 되어 CDP 가 못 받는다. */
  await ev(`(() => {
    const C = ${CELL_W}, IH = ${IMG_H}, HH = ${HEAD_H}, P = ${PAD};
    const cv = document.createElement('canvas');
    cv.width = C*3 + P*4; cv.height = (HH + IH)*3 + P*4;
    const g = cv.getContext('2d');
    g.fillStyle = '#151515'; g.fillRect(0,0,cv.width,cv.height);
    window.__sheet = { cv, g, C, IH, HH, P };
    return [cv.width, cv.height];
  })()`);

  const furs = [], mean = [];
  for (let i = 0; i < tones.length; i++){
    const t = tones[i];
    await ev(`(() => { decorPick('${t.id}');
      const it = DECOR.byId('${t.id}');
      if (it.pair){ decorPick(it.pair.wall); decorPick(it.pair.floor); }
      R3.clearTags();
      document.querySelectorAll('.bubble').forEach(e => e.remove());
    })()`);
    await sleep(2200);
    /* 털색은 **재질에 실린 값**을 읽는다. 아홉 번 다 같아야 한다. */
    furs.push(JSON.parse(await ev(`JSON.stringify(R3.debug().cats.map(c => c.fur))`)));
    const shot = (await send('Page.captureScreenshot', { format:'png', clip: { ...VP, scale:1 } })).data;
    fs.writeFileSync(OUT + 'tone-' + t.id + '.png', Buffer.from(shot, 'base64'));
    const pan = await ev(`(async () => {
      const S = window.__sheet, g = S.g;
      const col = ${i} % 3, row = (${i} / 3) | 0;
      const x = S.P + col * (S.C + S.P), y = S.P + row * (S.HH + S.IH + S.P);
      const img = await new Promise(r => { const im = new Image(); im.onload = () => r(im);
        im.src = 'data:image/png;base64,${shot}'; });
      /* 머리글 — 번호·이름·한 줄 설명 */
      g.fillStyle = '#F2F2F0'; g.font = '700 15px system-ui,"Malgun Gothic",sans-serif';
      g.fillText('${i + 1}. ' + ${JSON.stringify(t.n)}, x, y + 17);
      g.fillStyle = '#9A9A96'; g.font = '400 11.5px system-ui,"Malgun Gothic",sans-serif';
      g.fillText(${JSON.stringify(t.note)}, x, y + 34);
      /* 그림 — 무대를 칸 폭에 맞춰 가운데를 잘라 넣는다 */
      const sc = Math.max(S.C / img.width, S.IH / img.height);
      const dw = img.width * sc, dh = img.height * sc;
      g.save(); g.beginPath(); g.rect(x, y + S.HH, S.C, S.IH); g.clip();
      g.drawImage(img, x + (S.C - dw)/2, y + S.HH + (S.IH - dh)/2, dw, dh);
      /* 색 띠 — 왼쪽 아래. 레퍼런스의 그 줄이다 */
      const chips = ${JSON.stringify(t.chips)};
      const cw = 26, ch = 15, bx = x + 8, by = y + S.HH + S.IH - ch - 8;
      chips.forEach((c, k) => { g.fillStyle = c; g.fillRect(bx + k*cw, by, cw, ch); });
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1;
      g.strokeRect(bx + 0.5, by + 0.5, cw*chips.length - 1, ch - 1);
      g.restore();
      g.strokeStyle = '#2A2A2A'; g.strokeRect(x + 0.5, y + S.HH + 0.5, S.C - 1, S.IH - 1);
      /* 이 벌이 화면에서 실제로 무슨 색인가 — **눈이 아니라 숫자로** 잰다.
         칸 전체의 평균은 벽과 바닥이 대부분이라 이 질문에 거의 답하지 않는다
         (그 값으로는 「차가운 회색」과 「블루 그레이」가 rgb 거리 2.2 였다 —
         눈으로는 확실히 다른 두 방인데). 그래서 **가구를 직접 뜬다**:
         카메라가 아홉 장 내내 한 자리에 못박혀 있으므로 책상 상판과 의자 등받이의
         화면 좌표가 아홉 장에서 같다. 찍은 그림에서 그 자리만 14×10 으로 평균한다. */
      const sc2 = document.createElement('canvas');
      sc2.width = img.width; sc2.height = img.height;
      const g2 = sc2.getContext('2d', { willReadFrequently:true });
      g2.drawImage(img, 0, 0);
      const at = pt => { if (!pt) return [0,0,0];
        const px = Math.max(7, Math.min(img.width-8, pt.x)),
              py = Math.max(5, Math.min(img.height-6, pt.y - ${VP.y}));
        const d = g2.getImageData(px - 7, py - 5, 14, 10).data;
        let r=0, gg=0, b=0;
        for (let k = 0; k < d.length; k += 4){ r += d[k]; gg += d[k+1]; b += d[k+2]; }
        const n = d.length / 4;
        return [Math.round(r/n), Math.round(gg/n), Math.round(b/n)]; };
      /* 칸 전체 평균 — 벽지·바닥까지 포함한 방의 인상 */
      const all = g2.getImageData(0, 0, img.width, img.height).data;
      let ar=0, ag=0, ab=0;
      for (let k = 0; k < all.length; k += 4){ ar += all[k]; ag += all[k+1]; ab += all[k+2]; }
      const an = all.length / 4;
      /* ---------- 견본책 카드에 쓸 작은 그림 ----------
         카드 썸네일을 따로 굽던 것을 **여기서 잘라 쓰는 것으로 바꿨다.**
         작은 장면을 따로 세우면 아무리 손봐도 「방 한 구석 모형」이고, 카드에서 보고
         싶은 것은 **이 벌의 사무실**이다. 아홉 칸 사진과 카드가 같은 그림이면
         「산 것과 다른 게 온다」가 원천적으로 없다.
         가운데를 카드 비율(264×146)로 잘라 두 배 크기로 내보낸다. */
      const CW = 264, CH2 = 146;
      const cc = document.createElement('canvas');
      cc.width = CW; cc.height = CH2;
      const gc = cc.getContext('2d');
      const cen = R3.project(W.W/2 - 0.5, W.H/2 - 0.5, 0.75) || { x: img.width/2, y: img.height/2 };
      const cwid = Math.min(img.width, 960), chei = cwid * CH2 / CW;
      let cx0 = Math.round(cen.x - cwid/2);
      let cy0 = Math.round(cen.y - ${VP.y} - chei*0.52);
      cx0 = Math.max(0, Math.min(img.width - cwid, cx0));
      cy0 = Math.max(0, Math.min(img.height - chei, cy0));
      gc.drawImage(sc2, cx0, cy0, cwid, chei, 0, 0, CW, CH2);
      return { desk: at(${JSON.stringify(spots.책상)}),
               room: [Math.round(ar/an), Math.round(ag/an), Math.round(ab/an)],
               /* jpeg 로 낸다. 264×146 png 은 디더 노이즈 때문에 85KB 이고,
                  아홉 장이면 배포본 하나에 base64 로 1MB 가 붙는다 — 카드 그림에
                  그 값을 낼 이유가 없다. jpeg 0.86 이면 같은 그림이 12KB 다. */
               card: cc.toDataURL('image/jpeg', 0.86).slice(23) };
    })()`);
    mean.push(pan.desk.concat(pan.room));
    /* 카드 그림은 **에셋으로 나간다** — 견본책이 이걸 그대로 쓴다(js/decor.js) */
    fs.mkdirSync(CARD, { recursive:true });
    fs.writeFileSync(CARD + t.id + '.jpg', Buffer.from(pan.card, 'base64'));
    console.log(`  ${i + 1}. ${t.n}  책상 rgb(${pan.desk.join(',')}) · 방 rgb(${pan.room.join(',')})` +
                `  ${t.pair ? '(' + t.pair.wall + ' / ' + t.pair.floor + ')' : ''}`);
  }

  /* 아홉이 화면에서 실제로 갈리는가 — 가장 가까운 두 칸의 거리를 잰다.
     팔레트에서 갈라 뒀는데 화면에서 붙으면 그건 아홉 벌이 아니라 다섯 벌이다. */
  let worst = 1e9, pair = null;
  for (let a = 0; a < mean.length; a++) for (let b = a+1; b < mean.length; b++){
    const d = Math.hypot(...mean[a].map((v, k) => v - mean[b][k]));
    if (d < worst){ worst = d; pair = [a+1, b+1]; }
  }
  console.log(`
제일 붙은 두 칸: ${pair[0]} ↔ ${pair[1]}  거리 ${worst.toFixed(1)}`);

  /* ---- 견본책 화면 한 장 — 아홉 칸이 카드로 어떻게 보이나 ---- */
  await ev(`(() => {
    /* 사진용으로 감춰 뒀던 살림살이를 되돌린다 — 모달은 그 위에 뜬다 */
    document.querySelectorAll('style').forEach(e => {
      if (e.textContent.indexOf('#topbar,#panelInbox') === 0) e.remove(); });
    decorPick('tone_std');
    showBinder();
    /* 가구 톤 칸으로 내린다 — 벽지·바닥·러그를 지나 넷째다 */
    const body = document.querySelector('#binderBody');
    const secs = [...body.querySelectorAll('.jukesec')];
    const tone = secs[secs.length - 1];
    tone.scrollIntoView({ block:'start' });
    return secs.map(e => e.textContent);
  })()`);
  await sleep(1600);
  const bshot = (await send('Page.captureScreenshot', { format:'png' })).data;
  fs.writeFileSync(OUT + 'tones-binder.png', Buffer.from(bshot, 'base64'));
  console.log('→ spike/ui/tones-binder.png  (견본책의 가구 톤 칸)');

  const sheet = await ev(`window.__sheet.cv.toDataURL('image/png').slice(22)`);
  fs.writeFileSync(OUT + 'tones-9.png', Buffer.from(sheet, 'base64'));

  /* ---- 고양이는 안 바뀌었는가 ---- */
  const same = furs.every(f => JSON.stringify(f) === JSON.stringify(furs[0]));
  console.log('\n고양이 털색 — 아홉 벌 내내 ' + (same ? '같다 ✅' : '달라졌다 ❌'));
  console.log('   ' + JSON.stringify(furs[0]) + (same ? '' : '\n   ' + JSON.stringify(furs)));
  console.log('오류: ' + (errs.length ? errs.slice(0,3).join(' | ') : '없음'));
  console.log('\n→ spike/ui/tones-9.png  (낱장은 spike/ui/tone-*.png)');

  ws.close(); chrome.kill();
  process.exit(same && !errs.length ? 0 : 1);
})();
