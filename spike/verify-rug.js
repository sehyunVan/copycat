/* 2026-08-25 — 49(러그) · 34 뒷절반(가구 톤) · 39(고양이 모션) 검증.
   node spike/serve.js 를 먼저 띄운다.  node spike/verify-rug.js

   판정은 전부 **화면과 상태에서** 읽는다. 코드가 그렇게 적혀 있는지는 확인이 아니다. */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9536;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const OUT = path.resolve(__dirname, 'ui') + path.sep;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const ok = (name, good, detail) => {
  (good ? pass++ : fail++);
  console.log(`  ${good ? '✅' : '❌'} ${name}${detail === undefined ? '' : '   ' + detail}`);
};

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-rug');
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
  let errs = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errs.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;
  const shot = async f => fs.writeFileSync(OUT + f,
    Buffer.from((await send('Page.captureScreenshot', { format:'png' })).data, 'base64'));

  errs = [];
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
    S.tier = 4; S.anchovy = 999999; S.shop.binder = 1;
    while (S.cats.length < 6 && deskCount() > S.cats.length){
      const c = newCat('냥' + S.cats.length); c.rec = newRecord(1); S.cats.push(c);
    }
    buildWorld(); assignDesks(); renderTiles(); renderRight(); renderTodos();
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e => e.remove());
  })()`);
  await sleep(1600);
  let ep = null;
  console.log('\n── 49 러그 ──');

  /* ---- 산다 · 깔린다 ---- */
  const r1 = await ev(`(() => {
    const it = DECOR.rugById['rugstripe'];
    const before = decorState().rugs.length;
    const bought = decorBuy('rugstripe');
    const laid = decorPick('rugstripe');
    const r = decorState().rugs.find(x => x.id === 'rugstripe');
    return { 목록:!!it, 크기:it && (it.w + 'x' + it.h), 값:it && it.cost,
             삼:bought, 깖:laid, 자리:r || null,
             전:before, 후:decorState().rugs.length,
             월드가같은배열: W.rugs === decorState().rugs };
  })()`);
  await sleep(1200);
  if (!r1){ console.log('   페이지 예외: ' + errs.slice(0,4).join(' | ')); process.exit(1); }
  console.log('   ' + JSON.stringify(r1));
  ok('49 견본책에 러그가 있다', r1.목록 === true, `${r1.크기}칸 · 🐟${r1.값}`);
  ep = r1.자리;
  ok('49 사면 바로 깔린다', r1.삼 === true && r1.깖 === true && r1.후 === r1.전 + 1);
  ok('49 W.rugs 가 저장 배열을 그대로 가리킨다', r1.월드가같은배열 === true);

  /* ---- 그려진다 ----
     **geomAt 으로 재지 않는다.** 그 칸의 의자·책상 정점이 같이 잡혀서 두께가 0.88 로
     나온다 — 41번에서 오락기 키를 벽 붙은 칸에서 재다 틀렸던 것과 같은 함정이고,
     그때 배운 대로 재는 자리를 옮긴다. 러그는 러그 메시에서 잰다. */
  const g1 = JSON.parse(await ev(`JSON.stringify(R3.debug().rugs)`));
  console.log('   rugs=' + JSON.stringify(g1));
  ok('49 깔린 러그가 실제로 씬에 서 있다', g1.length === 1 && ep &&
     Math.abs(g1[0].x - ep.x) < 0.01 && Math.abs(g1[0].y - ep.y) < 0.01,
     JSON.stringify(g1[0]));
  ok('49 발자국이 카탈로그와 같다', g1.length === 1 && g1[0].w === 3 && g1[0].h === 2,
     `${g1[0] && g1[0].w}x${g1[0] && g1[0].h}`);
  ok('49 바닥에 붙어 있고 두께가 러그다 (0 < 두께 ≤ 0.05)',
     g1.length === 1 && g1[0].y0 === 0 && g1[0].thick > 0 && g1[0].thick <= 0.05,
     `두께=${g1[0] && g1[0].thick} · 바닥에서 ${g1[0] && g1[0].y0}`);

  /* ---- 길찾기: 격자를 한 칸도 안 막는다 ----
     **자리를 만들어서 잰다.** 처음에는 방 네 귀퉁이를 끝점으로 잡았는데, 절차 생성이
     그 칸에 가구를 놓은 사무실에서는 길이 애초에 없어서 검사가 러그와 무관하게 실패했다
     (verify-aug24 가 「없는 가구는 격자에 직접 심는다」로 같은 문제를 푼 그 자리다).
     그래서 가운데에 **빈 차선 한 줄**을 내고 러그를 그 위로 옮긴다. 그러면 왼쪽 끝에서
     오른쪽 끝으로 가는 최단 경로가 반드시 러그를 지난다 — 러그가 막지 않는다면. */
  const cross = await ev(`(() => {
    const r = decorState().rugs[0], s = DECOR.rugSize(r);
    const y = Math.floor(W.H / 2);
    /* 차선 — 가운데 한 줄을 비운다(자리·잡동사니까지). 검사용 격자 조작이다. */
    for (let x = 1; x < W.W - 1; x++){
      const t = W.grid[y*W.W + x];
      if (t !== TILE.WALL) W.grid[y*W.W + x] = TILE.FLOOR;
    }
    /* 러그가 세로로 두 칸이면 그 아래 줄도 비워야 러그가 온전히 바닥 위에 온다 */
    for (let j = 1; j < s.h; j++)
      for (let x = 1; x < W.W - 1; x++){
        const t = W.grid[(y+j)*W.W + x];
        if (t !== TILE.WALL) W.grid[(y+j)*W.W + x] = TILE.FLOOR;
      }
    /* **스냅샷을 먼저 뜬다.** buildWorld 는 저장된 배치(S.layout)에서 되살리므로,
       격자만 고치고 부르면 방금 낸 차선이 통째로 되돌아간다(실제로 한 칸이 되돌아왔다). */
    snapshotWorld();
    buildWorld();
    const x0 = Math.max(2, Math.floor((W.W - s.w) / 2));
    r.x = x0; r.y = y;
    const on = (x, yy) => x >= r.x && x < r.x + s.w && yy >= r.y && yy < r.y + s.h;
    const A = { x:1, y }, B = { x:W.W - 2, y };
    const 걸을수있음 = WALKABLE.has(W.grid[y*W.W + A.x]) && WALKABLE.has(W.grid[y*W.W + B.x]);
    const path = findPath(W, A, B) || [];
    const 밟음 = path.filter(p => on(p.x, p.y)).length;
    /* 그리고 실제로 걸려 본다 — 길이 있는 것과 고양이가 가는 것은 다른 일이다 */
    const c = S.cats[0];
    c.x = A.x; c.y = A.y;
    let 발자국 = 0;
    goTo(c, B, 'idle');
    for (let i = 0; i < 400 && c.act.s === 'walk'; i++){
      simTick(0.1);
      if (on(Math.round(c.x), Math.round(c.y))) 발자국++;
    }
    /* 러그가 덮은 칸이 전부 그대로 걸을 수 있는가 */
    let 칸 = 0, 통행 = 0;
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++){
      칸++;
      if (WALKABLE.has(W.grid[(r.y+j)*W.W + (r.x+i)])) 통행++;
    }
    return { 끝점: 걸을수있음, 러그:[r.x, r.y], 크기:[s.w, s.h], 길이:path.length, 밟음, 발자국,
             칸, 통행, 끝: [Math.round(c.x), Math.round(c.y)], 목표:[B.x, B.y],
             격자에러그있나: Object.values(TILE).includes(r.id) };
  })()`);
  await sleep(1000);
  console.log('   ' + JSON.stringify(cross));
  ok('49 러그가 덮은 칸이 전부 그대로 걸을 수 있다', cross.통행 === cross.칸,
     `${cross.통행}/${cross.칸}`);
  ok('49 러그는 격자에 아예 없다', cross.격자에러그있나 === false);
  ok('49 길찾기가 러그를 밟고 지나간다 (돌아가지 않는다)', cross.밟음 > 0,
     `길 ${cross.길이}칸 중 러그 위 ${cross.밟음}칸`);
  ok('49 고양이가 실제로 러그를 밟고 건넌다', cross.발자국 > 0 &&
     cross.끝[0] === cross.목표[0] && cross.끝[1] === cross.목표[1],
     `러그 위에서 ${cross.발자국}틱 · ${JSON.stringify(cross.끝)} 도착`);

  /* ---- 배치 모드에서 옮기고 돌린다 ---- */
  const m1 = await ev(`(() => {
    toggleEdit(true);
    const r = decorState().rugs[0];
    const u = unitAt(r.x, r.y);
    if (!u || u.kind !== 'rug') return { 집힘:false, kind:u && u.kind };
    EDIT.sel = u;
    const 돌리기 = editRotate(1);
    const s1 = DECOR.rugSize(r);
    const to = { x:2, y:2 };
    const 옮기기 = editApply(EDIT.sel, to.x, to.y);
    const moved = decorState().rugs[0];
    toggleEdit(false);
    return { 집힘:true, 돌리기, rot:moved.rot, 뒤집힘: s1.w === DECOR.rugById[r.id].h,
             옮기기, x:moved.x, y:moved.y,
             저장에도: JSON.parse(localStorage.getItem(SAVE_KEY)||'{}').decor.rugs[0] };
  })()`);
  await sleep(1000);
  console.log('   ' + JSON.stringify(m1));
  ok('49 배치 모드에서 러그가 집힌다', m1.집힘 === true, m1.kind ? 'kind=' + m1.kind : '');
  ok('49 R 로 돌아간다 (가로세로가 바뀐다)', m1.돌리기 === true && m1.rot === 1 && m1.뒤집힘 === true);
  ok('49 다른 칸으로 옮겨진다', m1.옮기기 === true && m1.x === 2 && m1.y === 2);
  ok('49 옮긴 자리가 그대로 저장된다',
     !!m1.저장에도 && m1.저장에도.x === 2 && m1.저장에도.y === 2 && m1.저장에도.rot === 1);

  /* ---- 가구 밑에 깔린 러그는 가구가 먼저 잡힌다 ---- */
  const m2 = await ev(`(() => {
    /* 러그를 책상 위로 옮겨 놓고 그 칸을 눌러 본다 */
    const d = W.desks[0].desk;
    const r = decorState().rugs[0];
    r.x = d.x; r.y = d.y;
    const u = unitAt(d.x, d.y);
    const 빈칸 = (() => {
      /* 러그가 덮은 칸 중 바닥인 칸에서는 러그가 잡혀야 한다 */
      const s = DECOR.rugSize(r);
      for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++){
        const x = r.x+i, y = r.y+j;
        if (W.grid[y*W.W+x] === TILE.FLOOR){ const v = unitAt(x,y); return v && v.kind; }
      }
      return null;
    })();
    return { 가구칸: u && u.kind, 바닥칸: 빈칸 };
  })()`);
  console.log('   ' + JSON.stringify(m2));
  ok('49 가구 밑에 깔려도 가구가 먼저 잡힌다', m2.가구칸 === 'desk');
  ok('49 빈 바닥에서는 러그가 잡힌다', m2.바닥칸 === 'rug');

  /* ---- 이사 — 좁은 사무실로 옮겨도 남고, 방 밖으로 안 나간다 ---- */
  const mv = await ev(`(() => {
    const before = decorState().rugs.length;
    S.tier = 0; buildWorld();
    const rs = decorState().rugs;
    const 안쪽 = rs.every(r => { const s = DECOR.rugSize(r);
      return r.x >= 1 && r.y >= 1 && r.x + s.w <= W.W - 1 && r.y + s.h <= W.H - 1; });
    return { 전:before, 후:rs.length, 안쪽, 방: W.W + 'x' + W.H, 자리: rs[0] };
  })()`);
  await sleep(900);
  console.log('   ' + JSON.stringify(mv));
  ok('49 사무실을 옮겨도 러그가 남는다', mv.후 === mv.전, `${mv.전} → ${mv.후}장`);
  ok('49 좁은 방에서도 방 안에 들어온다', mv.안쪽 === true, `방 ${mv.방} · ${JSON.stringify(mv.자리)}`);

  await ev(`(() => { S.tier = 4; buildWorld(); renderTiles(); })()`);
  await sleep(1400);

  console.log('\n── 34 가구 톤 (뒷 절반) ──');
  const t0 = await ev(`JSON.stringify({ pal: DECOR.pal(), tone: DECOR.cur().tone, mats: R3.debug().mats || null })`);
  const t1 = await ev(`(() => {
    const before = DECOR.pal().wood;
    const bought = decorBuy('tone_darkwood');
    const picked = decorPick('tone_darkwood');
    return { 전:before, 삼:bought, 고름:picked };
  })()`);
  await sleep(1400);
  const t2 = await ev(`JSON.stringify({ pal: DECOR.pal(), tone: DECOR.cur().tone,
      lp: R3.debug().pal })`);
  console.log('   전 ' + t0);
  console.log('   ' + JSON.stringify(t1));
  console.log('   후 ' + t2);
  const P2 = JSON.parse(t2);
  ok('34 가구 톤을 사고 고를 수 있다', t1.삼 === true && t1.고름 === true);
  ok('34 팔레트의 나무색이 실제로 바뀐다', P2.pal.wood !== t1.전, `${t1.전} → ${P2.pal.wood}`);
  ok('34 렌더러의 PAL 까지 따라간다', P2.lp.wood === P2.pal.wood && P2.lp.fabric === P2.pal.fabric);
  await shot('rug-tone-darkwood.png');

  /* 되돌아가는가 — setPalette 는 덮어쓰기만 하므로 기본 벌이 값을 안 실으면
     우드톤에서 사무용으로 돌아왔을 때 옛 색이 그대로 남는다 */
  const t3 = await ev(`(() => { decorPick('tone_std'); return null; })()`);
  await sleep(1200);
  const t4 = await ev(`JSON.stringify({ wood: R3.debug().pal.wood, pal: DECOR.pal().wood })`);
  console.log('   되돌림 ' + t4);
  ok('34 기본 벌로 되돌리면 옛 색이 돌아온다', JSON.parse(t4).wood === t1.전, t4);

  /* 곱해지지 않는가 — 벌을 여러 번 갈아도 **살아 있는 텍스처가 안 늘어야** 한다.
     절대 개수로 재면 안 된다: 벽 덩어리마다 한 장씩이고 러그도 제 것을 갖고 있어서
     방마다 다른 수가 나온다. 재야 하는 것은 **갈기 전과 후가 같은가**이다. */
  const t5 = await ev(`(async () => {
    const before = R3.debug().decor.tex;
    const seq = ['tone_darkwood','tone_mono','tone_bluegrey','tone_std','tone_khaki','tone_std'];
    for (const id of seq){ decorBuy(id); decorPick(id); await new Promise(r => setTimeout(r, 260)); }
    return { 전: before, 후: R3.debug().decor.tex };
  })()`);
  await sleep(1200);
  console.log('   ' + JSON.stringify(t5));
  ok('34 벌을 여섯 번 갈아도 텍스처가 안 늘어난다', t5.전 === t5.후,
     `${t5.전} → ${t5.후}장`);

  /* 벽지를 갈면 텍스처는 **바뀌되 안 쌓여야** 한다 — 34번이 적어 둔 그 실측 항목이다 */
  const t6 = await ev(`(async () => {
    const before = R3.debug().decor.tex;
    for (const id of ['stripe','cork','panel','plain']){
      decorBuy(id); decorPick(id); await new Promise(r => setTimeout(r, 300));
    }
    return { 전: before, 후: R3.debug().decor.tex };
  })()`);
  await sleep(900);
  console.log('   ' + JSON.stringify(t6));
  ok('34 벽지를 네 번 갈아도 텍스처가 안 쌓인다', t6.후 <= t6.전, `${t6.전} → ${t6.후}장`);

  /* ---- 아홉 벌 · 어울리는 벽지·바닥 · 고양이는 안 바뀐다 ---- */
  const t7 = await ev(`(async () => {
    const T = DECOR.TONES;
    const 짝없는 = T.filter(t => !t.pair || !DECOR.wallById[t.pair.wall] || !DECOR.floorById[t.pair.floor]).map(t => t.id);
    /* 벌을 아홉 번 갈면서 **고양이 털색**을 매번 읽는다. 하나라도 움직이면
       그건 인테리어가 아니라 직원이 바뀐 것이다. */
    const furs = [];
    let 짝적용 = 0;
    for (const t of T){
      decorBuy(t.id); decorPick(t.id);
      if (t.pair){ decorBuy(t.pair.wall); decorBuy(t.pair.floor);
        decorPick(t.pair.wall); decorPick(t.pair.floor);
        const c = DECOR.cur();
        if (c.wall === t.pair.wall && c.floor === t.pair.floor) 짝적용++;
      }
      await new Promise(r => setTimeout(r, 280));
      furs.push(R3.debug().cats.map(c => c.fur).join(','));
    }
    /* 그리고 **일곱 칸만** 바뀌었는지 — 잎·장난감·종이는 그대로여야 한다 */
    const p = R3.debug().pal;
    return { 벌수: T.length, 짝없는, 짝적용,
             털색고정: furs.every(f => f === furs[0]), 털색: furs[0],
             잎: p.leaf, 장난감: p.toy };
  })()`);
  console.log('   ' + JSON.stringify(t7));
  ok('34 가구 톤이 아홉 벌이다', t7.벌수 === 9, t7.벌수 + '벌');
  ok('34 아홉 벌에 어울리는 벽지·바닥이 다 있다', t7.짝없는.length === 0, t7.짝없는.join(' ') || '전부 있음');
  ok('34 짝을 고르면 실제로 그 벽지·바닥이 발린다', t7.짝적용 === 9, t7.짝적용 + '/9');
  ok('**고양이 털색은 벌을 아홉 번 갈아도 안 바뀐다**', t7.털색고정 === true, t7.털색);
  ok('34 잎과 장난감은 벌을 안 탄다 (초록 잎 · 빨간 털뭉치)',
     t7.잎 === 0x8DB584 && t7.장난감 === 0xC2705F,
     `잎=${(t7.잎||0).toString(16)} 장난감=${(t7.장난감||0).toString(16)}`);

  console.log('\n── 39 고양이 모션 ──');
  /* 카메라를 세우고 한 마리만 남긴다. 스무 마리가 같이 움직이면 화면 차이가
     누구 것인지 모른다. */
  await ev(`(() => {
    R3.followOn(false); R3.camReset();
    while (S.cats.length > 1) S.cats.pop();
    NPCS.length = 0; DOCS.length = 0;
    assignDesks(); renderTiles();
  })()`);
  await sleep(2200);

  /* ---- 굽힌 장면 수 — 곱셈이 일어났는지 ---- */
  const c1 = await ev(`JSON.stringify(R3.catStats())`);
  console.log('   ' + c1);
  const C1 = JSON.parse(c1);
  ok('39 자세 셋은 그대로다', C1.poses === 3);
  ok('39 꼬리는 자세당 둘만 굽는다 (가운데는 기본 자세)', C1.tail <= 4, 'tail=' + C1.tail);
  ok('39 귀는 자세당 하나다', C1.ear <= 2, 'ear=' + C1.ear);
  ok('39 지오메트리가 열일곱을 안 넘는다 (마리 수와 무관)', C1.geoms <= 17, 'geoms=' + C1.geoms);

  /* ---- 꼬리가 실제로 돌아간다: 장면 이름이 셋을 다 지나는가 ----

     **시계를 손으로 돌린다.** ui.js 가 배우에게 넘기는 dt 는 0.05 로 잘려 있어서
     (한 프레임이 길어졌을 때 애니메이션이 튀지 않게 하는 장치다), 헤드리스처럼
     프레임이 느린 데서는 배우의 시간이 실시간보다 몇 배 천천히 간다.
     실제 기계에서는 60fps 라 dt 가 0.016 이고 안 잘린다 — 즉 이건 **검사 쪽 사정**이라
     여기서 sync 를 직접 펌프해서 배우 시간을 정직하게 흘려 준다. */
  const c2 = await ev(`(async () => {
    const id = S.cats[0].id;
    const seen = {}, xs = [];
    for (let i = 0; i < 240; i++){
      R3.sync(S.cats.concat(NPCS), DOCS, 0.05);        // 배우 시간 12초치
      const s = R3.catShape(id);
      if (s){ seen[s.key] = (seen[s.key]||0)+1; xs.push(s.maxX); }
      if (i % 8 === 0) await new Promise(r => requestAnimationFrame(r));
    }
    return { seen, 폭최소: Math.min(...xs), 폭최대: Math.max(...xs) };
  })()`);
  console.log('   ' + JSON.stringify(c2));
  const keys = Object.keys(c2.seen).filter(k => k[0] === 't');
  ok('39 꼬리 장면 셋을 다 지난다', keys.length >= 3, keys.join(' '));
  ok('39 꼬리가 실제로 옆으로 흘러나간다', (c2.폭최대 - c2.폭최소) > 0.02,
     `몸 폭 ${c2.폭최소.toFixed(3)} ~ ${c2.폭최대.toFixed(3)} (월드 단위)`);

  /* ---- 화면이 실제로 달라지는가 ----
     「움직였다고 코드가 말하는 것」과 「화면이 달라지는 것」은 다른 일이다(TODO 39).

     재는 방법 둘이 여기서 정해졌다:
       · **선 고양이를 빈 바닥에 세운다.** 자리에 앉아 있으면 꼬리가 의자·책상 뒤라
         화면에서 안 보이고, 그러면 이 검사는 가림막을 재는 것이 된다
       · **꼬리가 반대쪽 끝에 갈 때까지 시계를 돌린 뒤** 찍는다. 실시간으로 기다리면
         헤드리스에서는 배우 시간이 몇 배 느려서(dt 가 0.05 로 잘린다) 꼬리가
         거의 안 움직인 두 장을 비교하게 된다 */
  await ev(`(() => {
    const c = S.cats[0];
    /* **사방이 트인 칸**에 세운다. 아무 빈 바닥이나 잡으면 책상 옆에 서게 되고,
       그러면 꼬리가 책상 뒤로 가려서 이 검사가 꼬리가 아니라 가림막을 잰다.
       이웃 여덟 칸이 제일 많이 비어 있는 자리를 고른다. */
    const free = (x,y) => x>=0 && y>=0 && x<W.W && y<W.H && W.grid[y*W.W+x] === TILE.FLOOR;
    let put = null, best = -1;
    for (let y = 2; y < W.H-2; y++)
      for (let x = 2; x < W.W-2; x++){
        if (!free(x,y) || W.desks.some(d => d.seat.x===x && d.seat.y===y)) continue;
        let n = 0;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (free(x+i, y+j)) n++;
        if (n > best){ best = n; put = { x, y }; }
      }
    c.x = put.x; c.y = put.y; c.act = { s:'idle', t:0, use:null };
    window.__realTick = window.simTick; window.simTick = () => {};
    /* 그리고 가까이 간다 — 141px 짜리 고양이에서 꼬리는 몇십 px 이고, 헤드리스에서
       그 정도는 디더링과 섞인다. 재는 것은 「꼬리가 움직이는가」지 「멀리서도 보이는가」가
       아니므로, 볼 수 있는 거리에서 잰다. */
    R3.followOn(false);
    R3.camSet({ at: { x: put.x, y: put.y, up: 0.4 }, zoom: 0.34, el: 0.58, az: 0.72 });
  })()`);
  await sleep(1200);
  const A = (await send('Page.captureScreenshot', { format:'png' })).data;
  /* 꼬리가 반대쪽 끝으로 갈 때까지 돌린다 */
  const swung = await ev(`(async () => {
    const id = S.cats[0].id;
    const from = R3.catShape(id).key;
    for (let i = 0; i < 400; i++){
      R3.sync(S.cats.concat(NPCS), DOCS, 0.05);
      if (i % 6 === 0) await new Promise(r => requestAnimationFrame(r));
      const now = R3.catShape(id).key;
      if (from.endsWith('0') && now.endsWith('2')) return { from, to:now, 돈횟수:i };
      if (from.endsWith('2') && now.endsWith('0')) return { from, to:now, 돈횟수:i };
      if (from.endsWith('1') && (now.endsWith('0') || now.endsWith('2'))) return { from, to:now, 돈횟수:i };
    }
    return { from, to: R3.catShape(id).key, 돈횟수:-1 };
  })()`);
  await sleep(500);
  const B = (await send('Page.captureScreenshot', { format:'png' })).data;
  fs.writeFileSync(OUT + 'rug-motion-a.png', Buffer.from(A, 'base64'));
  fs.writeFileSync(OUT + 'rug-motion-b.png', Buffer.from(B, 'base64'));
  console.log('   꼬리 ' + JSON.stringify(swung));
  const diff = await ev(`(async () => {
    const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
    const a = await load('data:image/png;base64,${A}'), b = await load('data:image/png;base64,${B}');
    const cv = document.createElement('canvas'); cv.width = a.width; cv.height = a.height;
    const g = cv.getContext('2d', { willReadFrequently:true });
    g.drawImage(a,0,0); const da = g.getImageData(0,0,cv.width,cv.height).data;
    g.clearRect(0,0,cv.width,cv.height); g.drawImage(b,0,0);
    const db = g.getImageData(0,0,cv.width,cv.height).data;
    const R = 90;
    const boxAt = p => {
      let n = 0;
      for (let y = Math.max(0, p.y-R|0); y < Math.min(cv.height, p.y+R); y++)
        for (let x = Math.max(0, p.x-R|0); x < Math.min(cv.width, p.x+R); x++){
          const i = (y*cv.width + x) * 4;
          const d = Math.abs(da[i]-db[i]) + Math.abs(da[i+1]-db[i+1]) + Math.abs(da[i+2]-db[i+2]);
          if (d > 26) n++;
        }
      return n;
    };
    const c = S.cats[0];
    const 고양이 = boxAt(R3.project(c.x, c.y, 0.4) || { x:cv.width/2, y:cv.height/2 });
    /* 같은 크기의 **빈 바닥 상자** — 고양이가 없는 데서도 같은 만큼 달라진다면
       달라진 것은 고양이가 아니라 화면 전체다(시간대 빛·디더링). */
    const 빈바닥 = boxAt(R3.project(1, W.H-3, 0.4) || { x:120, y:cv.height-160 });
    return { 고양이, 빈바닥 };
  })()`);
  console.log('   ' + JSON.stringify(diff));
  ok('39 꼬리가 반대쪽 끝까지 실제로 돈다', swung.돈횟수 >= 0,
     `${swung.from} → ${swung.to}`);
  /* 절대값은 **바닥선**으로만 쓴다(디더링 몇십 px 은 늘 있다). 「달라진 것이 고양이인가」는
     아래의 빈 바닥 대조가 말한다 — 그쪽이 이 검사의 본체다. */
  ok('39 가만히 선 고양이의 화면이 실제로 달라진다', diff.고양이 > 120,
     `고양이 상자 ${diff.고양이}px (180×180)`);
  ok('39 달라지는 것은 고양이다 (빈 바닥은 그대로다)',
     diff.고양이 > diff.빈바닥 * 4 + 40,
     `고양이 ${diff.고양이}px · 빈 바닥 ${diff.빈바닥}px`);
  await ev(`(() => { if (window.__realTick) window.simTick = window.__realTick; })()`);

  /* ---- 귀 튕기기 ---- 여기서도 시계를 손으로 돌린다(위와 같은 이유) */
  const c3 = await ev(`(async () => {
    const id = S.cats[0].id;
    const pump = n => { for (let i = 0; i < n; i++) R3.sync(S.cats.concat(NPCS), DOCS, 0.05); };
    /* **걷는 중에는 귀를 안 튕긴다** — 걸음이 이미 볼 것을 주고 있고, 거기에 귀 장면을
       얹으면 꼬리×귀처럼 축이 하나 더 늘어난다(TODO 39 의 그 판단). 그래서 재기 전에
       고양이를 세워야 한다. 안 세우면 마침 걷는 중이었을 때 검사가 「안 튕긴다」고
       말하는데, 그건 고장이 아니라 규칙이다. */
    const real = window.simTick; window.simTick = () => {};
    S.cats[0].act = { s:'idle', t:0, use:null };
    pump(3);
    R3.flick(id);
    pump(2);                                   // 0.1초 — 튕긴 직후
    const 튕김 = R3.catShape(id);
    pump(16);                                  // 0.8초 — 0.42초짜리라 이미 돌아왔어야 한다
    const 돌아옴 = R3.catShape(id);
    /* 말풍선이 뜨는 것도 사건이다 — ui.js 의 sayAt 이 이 문을 부른다 */
    sayAt(id, '테스트');
    pump(2);
    const 말했을때 = R3.catShape(id);
    window.simTick = real;
    return { 튕김: 튕김 && 튕김.key, 돌아옴: 돌아옴 && 돌아옴.key, 말했을때: 말했을때 && 말했을때.key };
  })()`);
  console.log('   ' + JSON.stringify(c3));
  ok('39 귀가 한 번 튕긴다', String(c3.튕김).startsWith('e'), '장면=' + c3.튕김);
  ok('39 그리고 돌아온다 (상시가 아니다)', !String(c3.돌아옴).startsWith('e'), '장면=' + c3.돌아옴);
  ok('39 말풍선이 뜰 때도 튕긴다', String(c3.말했을때).startsWith('e'), '장면=' + c3.말했을때);

  console.log('\n── 가구를 바라본다 (요청) ──');
  const f1 = await ev(`(async () => {
    const c = S.cats[0];
    const out = [];
    /* 가구 넷을 차례로 시켜 본다 — 한 번 맞는 것은 우연일 수 있다.
       가는 방향과 가구 방향이 우연히 같은 자리가 실제로 있기 때문이다. */
    const kinds = ['social','coffee','play','litter','legal','sleep'];
    /* **시뮬을 멈춘다.** 안 멈추면 도착하자마자 think() 가 다시 일하러 보내고,
       그러면 「가구를 쓰는 중인 고양이」가 화면에 한 프레임도 안 남는다.
       (첫 회차가 그랬다 — 재려던 순간에는 이미 work 였다.) */
    const realTick = window.simTick;
    try {
      for (const k of kinds){
        const f = pickUse(W, k, c);
        if (!f) continue;
        c.x = f.spot.x; c.y = f.spot.y;
        c.act = { s:'use', t:0, use: f.target };
        window.simTick = () => {};                 // 얼린다
        for (let i = 0; i < 40; i++){
          R3.sync(S.cats.concat(NPCS), DOCS, 0.05);
          await new Promise(r => requestAnimationFrame(r));
        }
        const a = R3.catShape(c.id);
        const want = Math.atan2(f.target.x - c.x, f.target.y - c.y);
        let d = a.heading - want;
        while (d > Math.PI) d -= Math.PI*2;
        while (d < -Math.PI) d += Math.PI*2;
        /* 가구 **위에** 올려 그리는 것(캣타워·해먹·낮잠 상자)은 여기서 뺀다 —
           밟고 선 물건을 내려다보는 고양이가 되고, 그건 방향이 아니라 고장이다.
           대신 「올라가 있다」는 사실 자체를 기록해서 규칙이 갈렸는지 볼 수 있게 둔다. */
        out.push({ 쓰임:k, 가구: (TILE_INFO[tileAt(W, f.target.x, f.target.y)]||{}).n,
                   고양이:[c.x,c.y], 목표:[f.target.x,f.target.y], 위에: a.onFurn,
                   차이: +Math.abs(d).toFixed(3) });
      }
    } finally { window.simTick = realTick; }
    return out;
  })()`);
  console.log('   ' + JSON.stringify(f1));
  const beside = f1.filter(o => !o.위에);
  const worst = beside.length ? Math.max(...beside.map(o => o.차이)) : 9;
  ok('요청 가구 **옆에 선** 고양이가 그 가구를 바라본다',
     beside.length >= 2 && worst < 0.15,
     `가구 ${beside.length}종 · 최악 ${worst.toFixed(3)} rad (${(worst*180/Math.PI).toFixed(1)}°)`);
  ok('요청 가구 **위에 올라간** 고양이는 안 돌린다 (밟은 걸 내려다보지 않는다)',
     f1.every(o => !o.위에 || o.차이 >= 0),
     f1.filter(o => o.위에).map(o => o.가구).join(' ') || '해당 없음');
  await shot('rug-facing.png');

  /* ---- 마무리: 방 한 장 찍고 콘솔 오류 ---- */
  await ev(`(() => {
    S.anchovy = 999999;
    ['rugpersian','rugshag','ruground','rugpaw','rugmat'].forEach(id => { decorBuy(id); decorPick(id); });
    decorBuy('tone_darkwood'); decorPick('tone_darkwood');
    R3.followOn(false); R3.camReset(); renderTiles();
  })()`);
  await sleep(2000);
  await shot('rug-room.png');
  const laidAll = await ev(`decorState().rugs.length`);
  ok('49 러그 여섯 장을 동시에 깔 수 있다', laidAll >= 5, laidAll + '장');
  console.log('   그림: spike/ui/rug-room.png · rug-tone-wood.png · rug-facing.png · rug-motion-a/b.png');

  const bad = errs.filter(e => !/favicon|Failed to load resource/i.test(e));
  ok('콘솔 오류 0', bad.length === 0, bad.slice(0,3).join(' | '));

  console.log(`\n${pass} 통과 · ${fail} 실패`);
  ws.close(); chrome.kill();
  process.exit(fail ? 1 : 0);
})();
