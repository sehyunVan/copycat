/* 2026-08-24 요청 다섯 항목 검증.  node spike/serve.js 를 먼저 띄운다.

     38  패널을 오른쪽으로      기둥이 오른쪽에 서고, 시계·카메라는 왼쪽으로 돌아오고,
                               접는 손잡이가 R 로 뒤집히고, **예전 foldL 상태가 무력화**되는지
     41  게임기 가구            상점에 있고, 사면 격자에 놓이고, **그 칸에 실제로 1.5 높이의
                               물건이 서 있는지**(R3.geomAt — 격자에만 있고 안 그려지는 경우를 가른다)
     42  아침을 어슴푸레하게    화면 평균 밝기가 **밤 < 아침 < 낮** 인지. 색을 눈으로 고르는 게
                               아니라 픽셀로 잰다 — 표 하나를 고쳤을 때 어디까지 따라오는지가 요점이다
     45  폰 배포본 = 폰 UI      ?mobile=1 이면 1560px 에서도 탭 바 + 420px 상자인지,
                               그 도장이 없으면 원래대로 한 기둥인지, 그리고 **pack-mobile 이
                               그 도장을 실제로 찍는지**
     37  게이지 이름          직원 카드의 막대 넷에 **글자**가 붙었는지. title 속성은 폰에서
                               hover 가 없어 이름이 아예 없었다 — 그래서 화면에 보이는지를 본다
     36  뭘 하는지 말풍선       도착하면 그 가구에 맞는 말이 머리 위에 뜨는지. 급식기에서
                               「커피 마시는 중」이라고 하지 않는지(쓰임이 coffee 다) ·
                               근무·이동 중에는 안 뜨는지 · 겹쳐 붙지 않는지

   판정은 전부 **화면과 격자에서** 읽는다. 코드가 그렇게 적혀 있는지는 확인이 아니다. */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9524;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const OUT = path.resolve(__dirname, 'ui') + path.sep;
const ROOT = path.resolve(__dirname, '..') + path.sep;
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
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-aug24');
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

  /* 프롤로그를 넘기고 회사를 키운다 — 비품을 살 수 있어야 41번을 잴 수 있다. */
  async function boot(url, w, h, mobile){
    errs = [];
    await send('Emulation.setDeviceMetricsOverride', { width:w, height:h, deviceScaleFactor:1, mobile:!!mobile });
    await send('Page.navigate', { url });
    /* **고정 시간으로 기다리지 않는다.** 로딩 화면(40번)이 붙은 뒤로 부팅이 그만큼
       길어져서, 11초 뒤에 프롤로그를 건드리면 아직 시작도 안 한 상태였다 —
       그래서 클릭이 전부 헛돌고 사무실이 1등급 그대로 남아 오락기를 놓을 자리가 없었다
       (「0 → 0 칸」). 게임이 준비됐다고 말할 때까지 기다린다. */
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
      S.tier = 4; S.anchovy = 999999;
      while (S.cats.length < 5 && deskCount() > S.cats.length){
        const c = newCat('냥' + S.cats.length); c.rec = newRecord(1); S.cats.push(c);
      }
      assignDesks(); renderTiles(); renderRight(); renderTodos();
      document.querySelectorAll('.veil,.coach,.coachring').forEach(e => e.remove());
    })()`);
    await sleep(1200);
  }

  /* ============================================================
     38 · 41 · 42 · 36 — 넓은 화면(기본 배포)
     ============================================================ */
  console.log('\n── 1560×900 · 소스 트리 ──');
  await boot(BASE + '/index.html?3d=1&debug=1', 1560, 900);

  /* ---- 38 패널 오른쪽 ---- */
  const g38 = await ev(`(() => {
    const r = s => { const e = document.querySelector(s); if (!e) return null;
      const b = e.getBoundingClientRect();
      return { x:Math.round(b.x), y:Math.round(b.y), w:Math.round(b.width), 우:Math.round(b.right) }; };
    const app = document.getElementById('app');
    const seen = s => { const e = document.querySelector(s);
      return !!(e && e.offsetWidth && e.offsetHeight); };
    return { 배치: app.classList.contains('onecol') ? 'onecol' : '-',
      탭줄:r('#colTabs'), 결재함:r('#panelInbox'), 시계:r('.clockchip'), 카메라:r('.cambtn'),
      손잡이L:seen('.foldbtn.L'), 손잡이R:seen('.foldbtn.R'),
      창폭: innerWidth,
      가로오버플로: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  })()`);
  console.log('   ' + JSON.stringify(g38));
  ok('38 한 기둥 배치가 살아 있다', g38.배치 === 'onecol');
  ok('38 기둥이 화면 오른쪽에 붙는다',
     g38.탭줄 && g38.창폭 - g38.탭줄.우 <= 14 && g38.탭줄.x > g38.창폭 / 2,
     `탭줄 우=${g38.탭줄 && g38.탭줄.우} / 창폭=${g38.창폭}`);
  ok('38 결재함도 같은 자리에 선다',
     g38.결재함 && Math.abs(g38.결재함.우 - g38.탭줄.우) <= 2 && Math.abs(g38.결재함.x - g38.탭줄.x) <= 2);
  ok('38 시계·카메라는 왼쪽으로 돌아왔다',
     g38.시계 && g38.시계.x < 200 && g38.카메라 && g38.카메라.x < 200,
     `시계 x=${g38.시계 && g38.시계.x} · 카메라 x=${g38.카메라 && g38.카메라.x}`);
  ok('38 접는 손잡이는 R 만 남는다', g38.손잡이R === true && g38.손잡이L === false);
  ok('38 가로 오버플로 0', g38.가로오버플로 === 0);

  /* 접어 보고, 펴 보고 — 실제로 사라졌다 돌아오는지 */
  const f38 = await ev(`(async () => {
    const seen = () => { const e = document.getElementById('panelInbox');
      const cs = getComputedStyle(e);
      return { 보임: cs.opacity !== '0' && cs.pointerEvents !== 'none',
               opacity: cs.opacity, x: Math.round(e.getBoundingClientRect().x) }; };
    const raf = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    document.getElementById('btnFoldR').click(); await raf(); await new Promise(r=>setTimeout(r,320));
    const 접힘 = seen();
    document.getElementById('btnFoldR').click(); await raf(); await new Promise(r=>setTimeout(r,320));
    const 펴짐 = seen();
    /* 예전에 왼쪽을 접어 둔 사람 — 그 상태가 기둥을 죽이면 안 된다 */
    document.getElementById('main').classList.add('foldL'); await raf();
    const 옛foldL = seen();
    document.getElementById('main').classList.remove('foldL'); await raf();
    return { 접힘, 펴짐, 옛foldL };
  })()`);
  console.log('   ' + JSON.stringify(f38));
  ok('38 R 로 접으면 기둥이 나간다', f38.접힘.보임 === false);
  ok('38 다시 누르면 돌아온다', f38.펴짐.보임 === true);
  ok('38 예전 foldL 상태는 기둥을 죽이지 않는다', f38.옛foldL.보임 === true,
     `opacity=${f38.옛foldL.opacity}`);

  /* ---- 41 게임기 ---- */
  const g41 = await ev(`(() => {
    const it = SHOP.find(s => s.id === 'game');
    if (!it) return { 상점:false };
    const before = W.grid.filter(t => t === TILE.GAME).length;
    const bought = buyItem('game');
    /* 36번이 가구별로 갈리는지 재려면 그 가구들이 방에 **실제로 있어야** 한다.
       없는 가구로 통과하는 검사는 아무것도 확인하지 않는다(첫 회차가 그랬다). */
    ['feeder','yarn','snack','toy','scratch','gym'].forEach(id => { try { buyItem(id); } catch(e){} });
    const cells = [];
    for (let y = 0; y < W.H; y++) for (let x = 0; x < W.W; x++)
      if (W.grid[y*W.W+x] === TILE.GAME) cells.push({ x, y });
    renderTiles();
    const info = TILE_INFO[TILE.GAME];
    return { 상점:true, 값:it.cost, 등급:it.tier, 산뒤: cells.length, 전:before,
      이름: info && info.n, 쓰임: info && info.use, 맵핑: SHOP_TILE.game === TILE.GAME,
      cell: cells[0] || null, 산결과: bought };
  })()`);
  await sleep(1400);
  const geo41 = g41.cell ? await ev(`JSON.stringify(R3.geomAt(${g41.cell.x}, ${g41.cell.y}))`) : null;
  const geo = geo41 ? JSON.parse(geo41) : null;
  console.log('   ' + JSON.stringify(g41) + '  geom=' + geo41);
  ok('41 상점에 사내 오락기가 있다', g41.상점 === true, `🐟${g41.값} · 등급 ${g41.등급}`);
  ok('41 쓰임이 play 다 (social 이 아니다)', g41.쓰임 === 'play');
  ok('41 상점 id → 타일 맵핑이 있다', g41.맵핑 === true);
  ok('41 사면 격자에 놓인다', g41.산뒤 > g41.전, `${g41.전} → ${g41.산뒤} 칸`);
  ok('41 그 칸에 실제로 물건이 서 있다', !!geo && geo.verts > 0, JSON.stringify(geo));

  /* 키는 **벽에서 떨어진 칸**에서 잰다. 벽에 붙은 칸에서 geomAt 을 부르면 벽의
     정점이 같이 잡혀서 maxY 가 벽 높이(1.81)로 나온다 — 첫 회차가 그걸 오락기 키로
     읽고 실패했다. 검사가 틀렸던 것이고, 재는 자리를 옮기는 것이 고치는 방법이다. */
  const h41s = await ev(`(() => {
    /* 벽은 테두리에만 있으므로 테두리에서 두 칸 이상 떨어진 **빈 바닥**이면
       그 칸에 벽 정점이 없다. 이웃까지 비우라고 요구했다가 아무 칸도 못 찾았다
       (비품을 일곱 개 사 둔 방이라 그렇다) — 필요한 조건은 그게 아니었다. */
    const free = (x, y) => W.grid[y*W.W+x] === TILE.FLOOR
      && !W.desks.some(d => d.seat.x === x && d.seat.y === y);
    for (let y = 2; y < W.H-2; y++) for (let x = 2; x < W.W-2; x++)
      if (free(x, y)){ W.grid[y*W.W+x] = TILE.GAME; renderTiles(); return JSON.stringify({ x, y }); }
    return null;
  })()`);
  await sleep(1400);
  const h41c = h41s ? JSON.parse(h41s) : null;
  const h41 = h41c ? JSON.parse(await ev(`JSON.stringify(R3.geomAt(${h41c.x}, ${h41c.y}))`)) : null;
  console.log('   안쪽 칸 ' + h41s + ' geom=' + JSON.stringify(h41));
  ok('41 키가 세로형 아케이드다 (1.3~1.7)', !!h41 && h41.maxY > 1.3 && h41.maxY < 1.7,
     `maxY=${h41 && h41.maxY} (벽 없는 칸)`);
  const play41 = await ev(`(() => {
    const f = pickUse(W, 'play', S.cats[0]);
    /* 고양이가 실제로 갈 수 있는 자리로 잡히는지 — 안 그러면 장식이다 */
    let 오락기자리 = false;
    for (let i = 0; i < 40; i++){
      const p = pickUse(W, 'play', S.cats[0]);
      if (p && p.target && W.grid[p.target.y*W.W+p.target.x] === TILE.GAME){ 오락기자리 = true; break; }
    }
    return { 놀이자리있음: !!f, 오락기가놀이자리: 오락기자리 };
  })()`);
  ok('41 고양이의 놀이 자리로 잡힌다', play41.오락기가놀이자리 === true, JSON.stringify(play41));
  const obs41 = await ev(`(() => {
    const t = LOOK[TILE.GAME];
    return t ? t.length : 0;
  })()`);
  ok('41 조사하면 한 줄 관찰이 나온다', obs41 > 0, `${obs41}줄`);

  /* ---- 36 뭘 하는지 말풍선 ---- */
  const b36 = await ev(`(async () => {
    const raf = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    /* **시뮬을 얼린다.** 여기서 재는 것은 말풍선이지 행동이 아닌데, 프레임을 한 번
       넘기는 사이에 think() 가 고양이를 다시 일하러 보낸다 — 그러면 「가구를 쓰는 중」
       이라고 심어 둔 상태가 재기도 전에 work 로 바뀌어 있다.
       (50번에서 풍선이 「쓰는 동안 떠 있는」 것으로 바뀌면서, 풍선의 수명이 상태에
        매달리게 됐다. 그전에는 2.6초짜리라 상태가 바뀌어도 그 자리에 남아 있었다.) */
    const realTick = window.simTick;
    window.simTick = () => {};
    try {
    const cellOf = t => { for (let y=0;y<W.H;y++) for (let x=0;x<W.W;x++)
      if (W.grid[y*W.W+x] === t) return { x, y }; return null; };
    /* 재려는 가구가 **방에 있어야** 한다. 상점으로 사면 자리가 없을 때 조용히 실패하고
       (1등급 사무실은 좁다) 그러면 「가구없음」으로 헛통과한다 — 실제로 그랬다.
       그래서 없는 것만 격자에 직접 심는다. 재려는 것은 배치기가 아니라 말풍선이다. */
    for (const t of [TILE.FEEDER, TILE.YARN, TILE.COOLER, TILE.JUKE, TILE.GAME]){
      if (cellOf(t)) continue;
      let put = null;
      for (let y = 1; y < W.H-1 && !put; y++)
        for (let x = 1; x < W.W-1 && !put; x++)
          if (W.grid[y*W.W+x] === TILE.FLOOR
              && !W.desks.some(d => d.seat.x === x && d.seat.y === y)) put = { x, y };
      if (!put) continue;
      W.grid[put.y*W.W+put.x] = t;
      const use = (TILE_INFO[t] || {}).use;
      if (use) (W.facilities[use] = W.facilities[use] || []).push({ x:put.x, y:put.y });
    }
    renderTiles();
    const bub = () => { const b = [...document.querySelectorAll('.bubble')];
      return b.length ? { 수:b.length, 글: b[b.length-1].textContent } : { 수:0, 글:null }; };
    /* **DOM 만 지우면 안 된다.** 50번에서 말풍선이 고양이별로 하나씩 살아남는 구조가
       되면서(bubbles 맵), 판만 떼어 내면 맵에는 떨어져 나간 판이 그대로 남는다 —
       다음 sayAt 이 그 죽은 판에 글을 써서 화면에는 아무것도 안 뜬다.
       게임은 이런 식으로 지우는 자리가 없고 이건 검사 쪽 사정이라, 여기서 맞춘다. */
    const clear = () => {
      if (typeof bubbles !== 'undefined') [...bubbles.keys()].forEach(id => dropBubble(id));
      document.querySelectorAll('.bubble').forEach(e => e.remove());
    };
    const c = S.cats[0];
    const out = { 종류:{}, 도착:null, 근무:null, 이동:null, 겹침:null, 급식기:null };

    /* doingKind — 가구별로 갈라지는지 */
    for (const [name, tile] of [['juke',TILE.JUKE],['game',TILE.GAME],['feeder',TILE.FEEDER],
                                ['cooler',TILE.COOLER],['yarn',TILE.YARN]]){
      const cell = cellOf(tile);
      if (!cell){ out.종류[name] = '가구없음'; continue; }
      c.act = { s:'use', t:0, use:cell };
      out.종류[name] = doingKind(c);
    }
    c.act = { s:'sleep', t:0, use:null };
    out.종류.sleep = doingKind(c);

    /* 근무·이동 중에는 이 말이 없다 */
    clear(); c._bubble = 0;
    c.act = { s:'work', t:0, use:null };
    out.근무 = { kind: doingKind(c), 말함: sayDoing(c) };
    clear(); c._bubble = 0;
    c.act = { s:'walk', t:0, use:cellOf(TILE.JUKE), path:[], pi:0, then:'use' };
    out.이동 = { kind: doingKind(c), 말함: sayDoing(c) };

    /* **도착 경로 그대로** — arrive() 가 실제로 말풍선을 띄우는지 */
    clear(); c._bubble = 0;
    const jc = cellOf(TILE.JUKE);
    c.act = { s:'walk', t:0, use:jc, path:[], pi:0, then:'use' };
    arrive(c);
    await raf();
    out.도착 = { 상태:c.act.s, ...bub(), 후보: DOING.juke };

    /* 급식기는 「커피 마시는 중」이 아니다(쓰임이 coffee 다) */
    const fc = cellOf(TILE.FEEDER);
    if (fc){
      clear(); c._bubble = 0;
      c.act = { s:'walk', t:0, use:fc, path:[], pi:0, then:'use' };
      arrive(c);
      await raf();
      out.급식기 = { ...bub(), snack: DOING.snack, coffee: DOING.coffee };
    }

    /* 겹쳐 붙지 않는다 — 3D 는 옛 풍선을 지울 수 없으므로 여기서 막는다 */
    clear(); c._bubble = 0;
    c.act = { s:'use', t:0, use:jc };
    const a = sayDoing(c), b = sayDoing(c);
    await raf();
    out.겹침 = { 첫:a, 둘째:b, 화면: bub().수 };
    clear();
    return out;
    } finally { window.simTick = realTick; }
  })()`);
  console.log('   ' + JSON.stringify(b36));
  ok('36 가구마다 다른 일로 갈린다',
     b36.종류.juke === 'juke' && b36.종류.game === 'game' && b36.종류.feeder === 'snack'
     && b36.종류.cooler === 'social' && b36.종류.sleep === 'sleep',
     JSON.stringify(b36.종류));
  ok('36 근무 중에는 안 뜬다', b36.근무.kind === null && b36.근무.말함 === false);
  ok('36 이동 중에도 안 뜬다', b36.이동.kind === null && b36.이동.말함 === false);
  ok('36 도착하면 머리 위에 뜬다', b36.도착 && b36.도착.수 === 1, JSON.stringify(b36.도착));
  ok('36 그 글이 그 가구의 말이다',
     b36.도착 && b36.도착.후보.indexOf(b36.도착.글) >= 0, `「${b36.도착 && b36.도착.글}」`);
  ok('36 급식기는 밥이라고 말한다 (커피가 아니다)',
     !b36.급식기 || (b36.급식기.snack.indexOf(b36.급식기.글) >= 0
                     && b36.급식기.coffee.indexOf(b36.급식기.글) < 0),
     `「${b36.급식기 && b36.급식기.글}」`);
  ok('36 풍선이 겹쳐 붙지 않는다',
     b36.겹침.첫 === true && b36.겹침.둘째 === false && b36.겹침.화면 === 1,
     JSON.stringify(b36.겹침));

  /* ---- 37 게이지 이름 ---- */
  const n37 = await ev(`(() => {
    setCol && setCol('staff');
    renderRight();
    const card = document.querySelector('#panelBiz .catcard');
    if (!card) return { 카드:false };
    const bars = [...card.querySelectorAll('.needs .nb')];
    const seen = e => !!(e && e.offsetWidth && e.offsetHeight);
    return { 카드:true, 막대수: bars.length,
      이름: bars.map(b => { const l = b.querySelector('.nbl');
        return { 글: l ? l.textContent.trim() : null, 보임: seen(l),
                 잘림: l ? l.scrollWidth > l.clientWidth + 1 : null }; }),
      /* 막대가 여전히 값을 폭으로 말하는지 — 이름을 붙이면서 이걸 깨면 계기판이 아니다 */
      채움: bars.map(b => { const i = b.querySelector('.nbt i'); return i ? i.style.width : null }),
      카드높이: Math.round(card.getBoundingClientRect().height) };
  })()`);
  console.log('   ' + JSON.stringify(n37));
  ok('37 막대마다 이름이 화면에 보인다',
     n37.카드 && n37.이름.length >= 3 && n37.이름.every(x => x.보임 && x.글 && x.글.length),
     n37.이름 ? n37.이름.map(x => x.글).join(' · ') : '-');
  ok('37 이름이 잘리지 않는다', n37.카드 && n37.이름.every(x => !x.잘림));
  ok('37 막대는 여전히 값을 폭으로 말한다',
     n37.카드 && n37.채움.every(w => /%$/.test(w || '')), JSON.stringify(n37.채움));

  /* 기준선 아래로 내려가면 이름까지 붉어지는지 — 급할 때 순서를 세지 않게 하는 것이 목적이다 */
  const low37 = await ev(`(() => {
    S.cats[0].needs.energy = 12;
    renderRight();
    const nb = document.querySelector('#panelBiz .catcard .needs .nb');
    const l = nb && nb.querySelector('.nbl');
    return { low: nb ? nb.classList.contains('low') : null,
             색: l ? getComputedStyle(l).color : null,
             굵기: l ? getComputedStyle(l).fontWeight : null };
  })()`);
  console.log('   ' + JSON.stringify(low37));
  ok('37 낮아진 항목은 이름까지 붉어진다',
     low37.low === true && low37.색 !== 'rgb(255, 255, 255)' && low37.굵기 === '700',
     JSON.stringify(low37));

  /* 기록증(🪪)에서는 숫자까지, 그리고 옛 중복 줄이 사라졌는지 */
  const card37 = await ev(`(async () => {
    showCat(S.cats[0].id);
    await new Promise(r => setTimeout(r, 400));
    const m = document.querySelector('.resume');
    if (!m) return { 열림:false };
    const txt = m.textContent.replace(/\s+/g, ' ');
    const nums = [...m.querySelectorAll('.needs .nbl b')].map(b => b.textContent);
    /* 「기력 …」 이 두 번 나오면 옛 줄이 남아 있는 것이다 */
    const dup = (txt.match(/기력|Energy|気力/g) || []).length;
    document.querySelectorAll('[data-close]').forEach(b => b.click());
    return { 열림:true, 숫자: nums, 기력등장: dup };
  })()`);
  console.log('   ' + JSON.stringify(card37));
  ok('37 기록증에는 숫자까지 붙는다', card37.열림 && card37.숫자.length >= 3, JSON.stringify(card37.숫자));
  ok('37 기록증의 중복 줄이 사라졌다', card37.열림 && card37.기력등장 === 1,
     `「기력」 ${card37.기력등장}번 등장`);

  /* ---- 42 아침을 어슴푸레하게 ---- */
  const lit = {};
  for (const k of ['night','morning','day','evening']){
    const v = await ev(`(async () => {
      setSkyForce('${k}');
      renderNight(); R3.draw();
      await new Promise(r => requestAnimationFrame(r));
      R3.draw();
      const cv = document.getElementById('gl');
      const c2 = document.createElement('canvas'); c2.width = 60; c2.height = 40;
      const cx = c2.getContext('2d'); cx.drawImage(cv, 0, 0, 60, 40);
      const d = cx.getImageData(0, 0, 60, 40).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4){ r += d[i]; g += d[i+1]; b += d[i+2]; }
      const n = d.length / 4;
      const rgb = [Math.round(r/n), Math.round(g/n), Math.round(b/n)];
      return JSON.stringify({ rgb, 밝기: +(rgb[0]*0.299 + rgb[1]*0.587 + rgb[2]*0.114).toFixed(1),
                              자락: R3.skyInfo() });
    })()`);
    lit[k] = JSON.parse(v);
    console.log(`   ${k.padEnd(8)} rgb(${lit[k].rgb.join(',')})  밝기 ${lit[k].밝기}  자락 세기 ${lit[k].자락.세기}`);
  }
  await ev(`setSkyForce(null); renderNight();`);
  ok('42 아침이 낮보다 어둡다', lit.morning.밝기 < lit.day.밝기,
     `아침 ${lit.morning.밝기} < 낮 ${lit.day.밝기}`);
  ok('42 아침이 밤보다는 밝다', lit.morning.밝기 > lit.night.밝기,
     `아침 ${lit.morning.밝기} > 밤 ${lit.night.밝기}`);
  ok('42 창에서 들어오는 빛도 같이 내려갔다', lit.morning.자락.세기 < 0.45,
     `세기 ${lit.morning.자락.세기}`);
  ok('42 네 시간대가 서로 다른 화면이다',
     new Set(Object.values(lit).map(v => v.rgb.join(','))).size === 4);

  /* 이름표가 어두워진 아침에 죽지 않는지 — 흰 글씨 + 그림자라 어두울수록 살지만, 본다 */
  const tag42 = await ev(`(async () => {
    setSkyForce('morning'); renderNight(); R3.draw();
    await new Promise(r => requestAnimationFrame(r));
    const t = [...document.querySelectorAll('.tag3d')].filter(e => e.style.display !== 'none');
    const one = t[0] ? getComputedStyle(t[0]) : null;
    const out = { 개수: t.length, 색: one && one.color, 투명도: one && one.opacity };
    setSkyForce(null); renderNight();
    return out;
  })()`);
  ok('42 어두워진 아침에도 이름표는 그대로다',
     tag42.개수 > 0 && tag42.색 === 'rgb(255, 255, 255)', JSON.stringify(tag42));

  ok('넓은 화면 · 콘솔 오류 0', errs.length === 0, errs.slice(0, 3).join(' | '));
  let shot = await send('Page.captureScreenshot', { format:'png', clip:{x:0,y:0,width:1560,height:900,scale:1} });
  fs.writeFileSync(OUT + 'aug24-desktop.png', Buffer.from(shot.data, 'base64'));

  /* ============================================================
     45 — 폰 배포본을 넓은 화면에서
     ============================================================ */
  console.log('\n── 1560×900 · ?mobile=1 (폰 배포본 흉내) ──');
  await boot(BASE + '/index.html?3d=1&mobile=1', 1560, 900);
  const g45 = await ev(`(() => {
    const app = document.getElementById('app');
    const b = app.getBoundingClientRect();
    const seen = s => { const e = document.querySelector(s); return !!(e && e.offsetWidth && e.offsetHeight); };
    const tabs = document.getElementById('colTabs');
    const tb = tabs.getBoundingClientRect();
    return { 배치: app.classList.contains('tabbar') ? 'tabbar'
                 : app.classList.contains('onecol') ? 'onecol' : '-',
      상자: app.classList.contains('phonebox'),
      앱폭: Math.round(b.width), 앱높이: Math.round(b.height),
      가운데: Math.round(b.x + b.width/2), 창폭: innerWidth,
      탭바아래: Math.round(b.bottom - tb.bottom), 탭수: [...tabs.querySelectorAll('button')].filter(x => x.offsetWidth).length,
      상단바줄: document.getElementById('topbar').offsetHeight > 62 ? '두 줄 이상' : '한 줄',
      가로오버플로: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  })()`);
  console.log('   ' + JSON.stringify(g45));
  ok('45 폭이 1560 인데도 탭 바 배치다', g45.배치 === 'tabbar');
  ok('45 폰 폭 상자에 담긴다', g45.상자 === true && g45.앱폭 === 420, `앱폭 ${g45.앱폭}`);
  ok('45 화면 가운데에 선다', Math.abs(g45.가운데 - g45.창폭/2) <= 2);
  ok('45 세로도 잘린다 (기기 비율)', g45.앱높이 <= 880);
  ok('45 탭 다섯이 상자 맨 아래에 붙는다', g45.탭수 === 5 && g45.탭바아래 <= 2,
     `탭 ${g45.탭수}개 · 아래여백 ${g45.탭바아래}`);
  ok('45 상단 바가 한 줄이다', g45.상단바줄 === '한 줄');
  ok('45 가로 오버플로 0', g45.가로오버플로 === 0);

  /* 탭을 실제로 눌러 화면이 하나만 뜨는지 — 폰 배치의 기본 계약이다 */
  const t45 = await ev(`(async () => {
    const shown = e => !!(e && e.offsetWidth && e.offsetHeight);
    const want = { stage:[], inbox:['panelInbox'], staff:['panelBiz'], shop:['panelBiz'], log:['panelBiz'] };
    const out = [];
    for (const k of ['stage','inbox','staff','shop','log']){
      const b = document.querySelector('#colTabs [data-col="' + k + '"]');
      if (!shown(b)){ out.push({ tab:k, skip:1 }); continue; }
      b.click();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const vis = ['panelInbox','panelBiz'].filter(p => shown(document.getElementById(p)));
      const sw = document.querySelector('.stagewrap');
      const 무대샘 = k !== 'stage' && getComputedStyle(sw).visibility !== 'hidden';
      out.push({ tab:k, vis, 무대샘, ok: JSON.stringify(vis) === JSON.stringify(want[k]) && !무대샘 });
    }
    return out;
  })()`);
  console.log('   ' + JSON.stringify(t45));
  ok('45 탭마다 한 화면만 뜬다', t45.every(s => s.skip || s.ok));
  ok('폰 상자 · 콘솔 오류 0', errs.length === 0, errs.slice(0, 3).join(' | '));
  shot = await send('Page.captureScreenshot', { format:'png', clip:{x:0,y:0,width:1560,height:900,scale:1} });
  fs.writeFileSync(OUT + 'aug24-phonebox.png', Buffer.from(shot.data, 'base64'));

  /* 도장이 없으면 원래대로 — 이게 없으면 45번은 모두를 폰으로 만든 것이다 */
  console.log('\n── 1560×900 · 도장 없음 (되돌아오는지) ──');
  await boot(BASE + '/index.html?3d=1', 1560, 900);
  const back = await ev(`(() => { const a = document.getElementById('app');
    return { onecol:a.classList.contains('onecol'), tabbar:a.classList.contains('tabbar'),
             phonebox:a.classList.contains('phonebox') }; })()`);
  ok('45 도장이 없으면 한 기둥 그대로', back.onecol === true && back.tabbar === false && back.phonebox === false,
     JSON.stringify(back));

  /* 실제 폰 폭 — 회귀 확인. 여기서는 상자에 담지 않는다(담으면 여백만 생긴다) */
  console.log('\n── 390×780 · 실제 폰 폭 (회귀) ──');
  await boot(BASE + '/index.html?3d=1&mobile=1', 390, 780, true);
  const ph = await ev(`(() => { const a = document.getElementById('app');
    return { tabbar:a.classList.contains('tabbar'), phonebox:a.classList.contains('phonebox'),
             앱폭: Math.round(a.getBoundingClientRect().width),
             가로오버플로: document.documentElement.scrollWidth - document.documentElement.clientWidth }; })()`);
  console.log('   ' + JSON.stringify(ph));
  ok('45 실제 폰에서는 상자를 안 씌운다', ph.tabbar === true && ph.phonebox === false && ph.앱폭 === 390);

  /* 37 은 **폰이 본론이다** — 거기에 hover 가 없어서 이름이 아예 없던 것이다 */
  const p37 = await ev(`(() => {
    setCol('staff'); renderRight();
    const card = document.querySelector('#panelBiz .catcard');
    if (!card) return { 카드:false };
    const bars = [...card.querySelectorAll('.needs .nb')];
    const seen = e => !!(e && e.offsetWidth && e.offsetHeight);
    const ls = bars.map(b => b.querySelector('.nbl'));
    return { 카드:true, 수: bars.length,
      전부보임: ls.every(seen), 잘린것: ls.filter(l => l.scrollWidth > l.clientWidth + 1).length,
      글: ls.map(l => l.textContent.trim()),
      /* 이름 줄과 막대가 한 칸 안에 세로로 서는지 — 가로로 접히면 배치가 깨진 것이다 */
      한줄: new Set(bars.map(b => Math.round(b.getBoundingClientRect().y))).size === 1 };
  })()`);
  console.log('   ' + JSON.stringify(p37));
  ok('37 폰 390px 에서도 이름이 보이고 안 잘린다',
     p37.카드 && p37.전부보임 === true && p37.잘린것 === 0 && p37.한줄 === true,
     JSON.stringify(p37.글));
  ok('45 폰 폭 가로 오버플로 0', ph.가로오버플로 === 0);
  ok('실제 폰 폭 · 콘솔 오류 0', errs.length === 0, errs.slice(0, 3).join(' | '));

  /* ---- 45 빌드가 도장을 찍는가 ---- */
  console.log('\n── 배포본에 도장이 찍히는가 ──');
  const tool = fs.readFileSync(ROOT + 'tools/pack-mobile.js', 'utf8');
  ok('45 pack-mobile 이 도장을 머리에 넣는다',
     /copycat-dist"\s+content="mobile"/.test(tool) && /\$\{DIST_MARK\}/.test(tool));
  for (const p of ['android', 'iphone']){
    const f = ROOT + 'dist/' + p + '/index.html';
    if (!fs.existsSync(f)){ console.log(`  ·  dist/${p} 없음 — 빌드 뒤 다시 볼 것`); continue; }
    const html = fs.readFileSync(f, 'utf8');
    ok(`45 dist/${p} 에 도장이 있다`, html.includes('name="copycat-dist" content="mobile"'));

    /* **실제 배포본을 넓은 화면에서 열어 본다.** HTML 안에 그 글자가 있는지는
       확인이 아니다 — ?mobile=1 없이, 배포본이 스스로 폰 화면을 내는지가 이 항목이다. */
    await boot(BASE + '/dist/' + p + '/index.html?3d=1', 1560, 900);
    const d = await ev(`(() => { const a = document.getElementById('app');
      const b = a.getBoundingClientRect();
      const tabs = document.getElementById('colTabs');
      return { tabbar:a.classList.contains('tabbar'), phonebox:a.classList.contains('phonebox'),
        폭:Math.round(b.width), 가운데:Math.round(b.x + b.width/2), 창폭:innerWidth,
        탭수:[...tabs.querySelectorAll('button')].filter(x => x.offsetWidth).length,
        가로오버플로: document.documentElement.scrollWidth - document.documentElement.clientWidth }; })()`);
    console.log('   ' + JSON.stringify(d));
    ok(`45 dist/${p} 을 1560px 로 열면 폰 화면이 나온다`,
       d.tabbar === true && d.phonebox === true && d.폭 === 420
       && d.탭수 === 5 && d.가로오버플로 === 0
       && Math.abs(d.가운데 - d.창폭/2) <= 2, JSON.stringify(d));
    ok(`45 dist/${p} · 콘솔 오류 0`, errs.length === 0, errs.slice(0, 3).join(' | '));
    const sh = await send('Page.captureScreenshot', { format:'png', clip:{x:0,y:0,width:1560,height:900,scale:1} });
    fs.writeFileSync(OUT + 'aug24-dist-' + p + '.png', Buffer.from(sh.data, 'base64'));
  }
  const idx = fs.readFileSync(ROOT + 'index.html', 'utf8');
  ok('45 소스 트리에는 도장이 없다', !idx.includes('copycat-dist'));

  console.log(`\n${fail ? '❌' : '✅'} ${pass}/${pass + fail} 통과${fail ? ` · ${fail} 실패` : ''}`);
  console.log('그림: spike/ui/aug24-desktop.png · aug24-phonebox.png');
  ws.close(); chrome.kill();
  process.exit(fail ? 1 : 0);
})();
