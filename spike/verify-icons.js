/* 머리 위 아이콘(TODO 61)과 마주 보기(TODO 60)를 잰다.
   node spike/serve.js 먼저.  →  node spike/verify-icons.js

   ── 왜 스크린샷만으로는 안 되나 ──
   둘이 마주 보는 일은 **가만 두면 몇 분에 한 번** 일어난다(잡담 가구가 비어 있고,
   두 마리가 연달아 fun 이 떨어져야 한다). 찍을 때마다 그 순간이 걸리기를 기다리면
   검사가 아니라 운이다. 그래서 시뮬을 **그 상태로 밀어 넣고** 잰다 —
   고양이 둘을 잡담 가구 옆에 세우고 act 를 직접 쓴다. 시뮬의 규칙(pairUp)은
   그 상태에서 무엇이 나와야 하는지만 판정한다.

   재는 것 열둘:
     1  아이콘 표는 DOING 의 갈래를 하나도 안 빠뜨린다
     2  근무 중인 고양이 머리 위에는 아무것도 없다 (자막 판이 되면 안 된다)
     3  가구를 쓰면 아이콘이 뜬다
     4  갈래마다 맞는 그림이 뜬다 (커피 → coffee …)
     5  같은 가구에 둘이 있으면 서로 짝이 된다 (c._with)
     6  짝이 있으면 그림이 **하트**로 바뀐다
     7  둘이 실제로 **서로를 향해 돈다** (yaw 가 상대 쪽)
     8  짝이 있으면 회복이 더 크다 (social2)
     9  한쪽이 일어서면 짝이 풀린다
    10  말하면 **같은 풍선**이 문장으로 바뀐다 (판을 두 개 만들지 않는다)
    11  2.6초 뒤 그 풍선이 다시 그림으로 돌아온다
    12  콘솔 오류 없음
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
/* 폰으로도 잰다 — 이 항목(TODO 61)이 애초에 폰에서 문장이 겹쳐서 시작한 일이라,
   폰에서 안 재면 고친 걸 확인 안 한 것이다. 배치는 폭이 정한다(col.js colMode → MQ_M4).
     node spike/verify-icons.js          데스크톱 1400×880
     node spike/verify-icons.js phone    폰 390×844 */
const PHONE = process.argv[2] === 'phone';
const PORT = PHONE ? 9378 : 9376;
const W = PHONE ? 390 : 1400, H = PHONE ? 844 : 880;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const OUT = path.join(__dirname, 'dist', 'shots');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
if (!CHROME) throw new Error('크롬을 못 찾았다');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const rows = [];
const ok = (name, pass, note) => { rows.push({ name, pass, note }); };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'cdp-ico-' + PORT),
    'about:blank'], { stdio:'ignore' });

  let page;
  for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
    if (!page) await sleep(250);
  }
  if (!page) throw new Error('크롬이 안 뜬다');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); const errs = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text
      || (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error'
        && !/favicon/.test(m.params.entry.text)) errs.push(m.params.entry.text);
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.text + ' '
      + (r.exceptionDetails.exception?.description || '').slice(0, 300));
    return r?.result?.value;
  };

  await send('Emulation.setDeviceMetricsOverride',
    { width:W, height:H, deviceScaleFactor: PHONE ? 3 : 1, mobile: PHONE });
  await send('Page.navigate', { url: BASE + '/index.html?3d=1' });
  await sleep(14000);
  /* **시작화면은 안 누른다.** 누르면 프롤로그 컷신과 근로계약서로 들어가고, 그동안
     화면은 시네마틱이 잡고 있다 — 여기서 볼 것은 평상시 사무실이다.
     시작화면은 게임 위에 얹힌 판일 뿐이라 그 아래 시뮬은 이미 돌고 있다
     (verify-game.js 도 같은 이유로 안 누른다). 판만 걷어 낸다. */
  await ev(`(()=>{const el=document.querySelector('#cctitle');if(el)el.remove();
                  document.body.classList.remove('titleon');return 1})()`);

  /* ── 헤드리스에서는 무대 높이가 0 이다 ──
     #app 은 100dvh 로 서는데(style.css 46 — iOS 주소창 때문에 vh 가 아니라 dvh 다),
     헤드리스 크롬에서 그 값이 0 으로 풀린다. 그래서 #viewport 가 0 높이가 되고
     GL 캔버스는 기본 300×150 에 머문다 — 게임은 정상인데 **검사판만** 무대가 없다.
     아이콘 자리 계산(R3.project)이 그 안에서 돌면 재는 값이 화면과 무관해지므로,
     높이를 못 박고 렌더러에 다시 재게 한다. */
  await ev(`(()=>{
    const st = document.createElement('style');
    st.textContent = '#app{height:${H}px !important}';
    document.head.appendChild(st);
    if (typeof fitWorld === 'function') fitWorld();
    if (window.R3 && R3.fit) R3.fit();
    return 1;
  })()`);
  await sleep(900);
  const stage = await ev(`(()=>{const v=document.getElementById('viewport'),g=document.getElementById('gl');
    const r=v.getBoundingClientRect();return {h:r.height|0,gw:g.width,gh:g.height}})()`);
  if (stage.h < 100) throw new Error('무대가 안 섰다: ' + JSON.stringify(stage));
  console.log('  무대: ' + stage.h + 'px · 캔버스 ' + stage.gw + '×' + stage.gh);
  if (!await ev(`!!(typeof R3!=='undefined'&&R3&&R3.ready)`)) throw new Error('3D 가 안 올라왔다');
  /* ── 판을 깐다 ──
     새 저장은 **1등급 사무실에 고양이 한 마리**다. 그 상태로는 마주 보기를 아예 못 재고
     (짝이 되려면 둘이 필요하다) 커피머신도 없다. 그래서 사무실을 올리고 둘째를 들인다 —
     verify-game.js 가 BIG 으로 하는 것과 같은 손이다. */
  const fix = await ev(`(()=>{
    S.tier = Math.min(TIERS.length - 1, 8);
    S.anchovy = 999999;
    SHOP.forEach(it => { if (it.tier <= S.tier) S.shop[it.id] = true; });
    buildWorld(true);
    while (S.cats.length < 4) hire();
    renderTiles();
    return { cats:S.cats.length, W:W.W+'x'+W.H,
             fac:Object.keys(W.facilities).map(k => k+':'+(W.facilities[k]||[]).length).join(' ') };
  })()`);
  await sleep(2500);
  if (!fix || fix.cats < 2) throw new Error('고양이를 못 늘렸다: ' + JSON.stringify(fix));
  console.log('  판: ' + fix.W + ' · 고양이 ' + fix.cats + ' · ' + fix.fac);

  /* 폰 배치가 실제로 걸렸나. 안 걸렸는데 「폰에서 됩니다」라고 적으면 그건 거짓말이다. */
  const lay = await ev(`(()=>{
    const a = document.getElementById('app');
    if (a.classList.contains('tabbar')){ a.dataset.col = 'stage'; if (typeof colApply === 'function') colApply(); }
    return { tabbar: a.classList.contains('tabbar'), col: a.dataset.col || '', w: innerWidth };
  })()`);
  await sleep(600);
  console.log('  배치: ' + (lay.tabbar ? '폰(tabbar) · 탭 ' + lay.col : '데스크톱') + ' · ' + lay.w + 'px');
  ok('폰이면 폰 배치로 뜬다', PHONE ? lay.tabbar === true : lay.tabbar === false,
      lay.tabbar ? 'tabbar' : '3열');

  /* ---------- 1. 표에 빠진 갈래 ---------- */
  const miss = await ev(`(()=>{
    const need = Object.keys(DOING);
    return need.filter(k => !ICON_SVG[k] && k !== 'social2');
  })()`);
  ok('DOING 의 갈래마다 그림이 있다', miss.length === 0, miss.length ? '빠짐: ' + miss.join(',') : Object.keys(await ev('ICON_SVG')).length + '종');

  /* ---------- 2. 근무 중에는 아무것도 없다 ---------- */
  const idleN = await ev(`(()=>{
    S.cats.forEach(c => { c.act = { s:'work', t:0 }; });
    syncBubbles();
    return { ico: document.querySelectorAll('.bubble.ico').length,
             bub: document.querySelectorAll('.bubble').length };
  })()`);
  ok('근무 중인 머리 위는 비어 있다', idleN.ico === 0, `아이콘 ${idleN.ico} · 말풍선 ${idleN.bub}`);

  /* ---------- 3·4. 가구를 쓰면 그 그림이 뜬다 ----------
     칸을 직접 찾아 act.use 에 꽂는다. 없는 가구는 건너뛴다(사무실마다 다르다). */
  const kinds = await ev(`(()=>{
    /* 재는 동안 **나머지 냥은 자리에 앉힌다.** 시뮬이 계속 돌아서 다른 냥이 가구를 쓰면
       그쪽에도 풍선이 생기고, querySelector('.bubble.ico') 가 남의 것을 집는다 —
       검사가 사무실 사정에 따라 붙었다 떨어졌다 한다(실제로 그렇게 깨졌다). */
    /* NPC 도 풍선을 갖는다(syncBubbles 는 S.cats.concat(NPCS) 를 돈다).
       법무팀·냥찰이 마침 가구를 쓰고 있으면 남의 풍선이 하나 더 떠서
       「풍선 하나」를 세는 검사가 사무실 사정에 따라 흔들린다. 재는 동안엔 비운다. */
    const park = () => { NPCS.length = 0; S.cats.forEach(c => { c.act = { s:'work', t:0 }; c._with = null; }); };
    const want = { coffee:'coffee', litter:'litter', sleep:'sleep', social:'social', play:'play' };
    const out = [];
    for (const use in want){
      const list = W.facilities[use];
      if (!list || !list.length) continue;
      const f = (use === 'social' ? chatSpots()[0] : list[0]);
      if (!f) continue;
      const spot = adjacentFree(W, f)[0];
      if (!spot) continue;
      park();
      const c = S.cats[0];
      c.x = spot.x; c.y = spot.y;
      c.act = use === 'sleep' ? { s:'sleep', t:0, use:f } : { s:'use', t:0, use:f };
      syncBubbles();
      const el = document.querySelector('.bubble.ico');
      out.push({ use, kind: el ? el.className.replace('icobub ','') : null,
                 svg: !!(el && el.querySelector('svg')), want: doingKind(c) });
    }
    return out;
  })()`);
  ok('가구를 쓰면 아이콘이 뜬다', kinds.length > 0 && kinds.every(k => k.svg),
      kinds.map(k => k.use).join(' · ') || '잡담 가구가 없다');
  ok('갈래마다 맞는 그림', kinds.every(k => k.want), kinds.map(k => k.use + '→' + k.want).join(' · '));

  /* ---------- 5·6·7·8. 마주 보기 ---------- */
  const pair = await ev(`(()=>{
    /* **쥬크박스가 아니라 진짜 잡담 가구**를 고른다 — 쓰임이 social 이어도 그 앞에서
       하는 일이 다른 가구가 섞여 있다(sim.js isChat). 거기서는 짝이 안 생기는 게 맞다. */
    const f = chatSpots()[0];
    if (!f) return { skip:true, reason:'잡담 가구가 없다' };
    const spots = adjacentFree(W, f);
    if (spots.length < 2) return { skip:true, reason:'진입로가 하나뿐' };
    NPCS.length = 0;                                                       // 남의 풍선을 지운다
    S.cats.forEach(c => { c.act = { s:'work', t:0 }; c._with = null; });   // 나머지는 자리에
    const [a, b] = S.cats;
    a.x = spots[0].x; a.y = spots[0].y; a.act = { s:'use', t:0, use:f };
    b.x = spots[1].x; b.y = spots[1].y; b.act = { s:'use', t:0, use:f };

    /* 회복량은 **같은 판에서 둘 다** 잰다. 「혼자면 9」 는 표의 값이지 화면의 값이 아니다 —
       비품 배수(shopMul)가 곱해지므로 사무실마다 다르고, 그 둘을 비교하면 배수를 재게 된다. */
    /* 혼자일 때를 재려면 **짝을 치워야 한다** — simTick 이 맨 앞에서 pairUp 을 다시
       돌리므로 _with 만 지워 놓으면 같은 틱에 도로 짝이 된다(그게 이 설계의 요점이다). */
    b.act = { s:'work', t:0 };
    a.needs.fun = 40;
    const f0 = a.needs.fun; simTick(1); const alone = a.needs.fun - f0;
    a.x = spots[0].x; a.y = spots[0].y; a.act = { s:'use', t:0, use:f };
    b.x = spots[1].x; b.y = spots[1].y; b.act = { s:'use', t:0, use:f };
    a.needs.fun = 40; b.needs.fun = 40;
    const f1 = a.needs.fun; simTick(1); const gained = a.needs.fun - f1;

    /* 돌아서는 데 시간이 걸린다 — setHeading 은 프레임마다 조금씩 튼다(제자리에서
       홱 도는 고양이는 고장으로 보인다). 한 프레임만 돌리면 「반쯤 돈 각도」를 재게 된다. */
    for (let i = 0; i < 90; i++) R3.sync(S.cats.concat(NPCS), DOCS, 0.05);
    syncBubbles();
    const dbg = R3.debug().cats;
    const ya = dbg.find(x => x.id === a.id), yb = dbg.find(x => x.id === b.id);
    /* 서로를 보고 있나 — 상대 쪽 각도와 실제 yaw 의 차 */
    const aim = (from, to) => Math.atan2(to.x - from.x, to.y - from.y);
    const dif = (u, v) => { let d = Math.abs(u - v) % (Math.PI * 2); return d > Math.PI ? Math.PI * 2 - d : d; };
    return { skip:false, aw:a._with, bw:b._with, ida:a.id, idb:b.id, gained, alone,
      icon: document.querySelector('.bubble.ico') ? document.querySelector('.bubble.ico').innerHTML.length : 0,
      hearts: [...document.querySelectorAll('.bubble.ico')].filter(e => e.className.includes('ic-beat')).length,
      offA: ya ? dif(ya.yaw, aim(a, b)) : null,
      offB: yb ? dif(yb.yaw, aim(b, a)) : null };
  })()`);
  if (pair.skip){
    ok('같은 가구에 둘 → 짝', false, '잡담 가구/진입로가 모자라 못 쟀다 ' + (pair.reason || ''));
  } else {
    ok('같은 가구에 둘 → 서로 짝이 된다', pair.aw === pair.idb && pair.bw === pair.ida,
        `${pair.ida}↔${pair.aw} · ${pair.idb}↔${pair.bw}`);
    ok('짝이면 그림이 하트로', pair.hearts === 2, `하트 ${pair.hearts}/2`);
    ok('둘이 서로를 향해 돈다', pair.offA != null && pair.offA < 0.5 && pair.offB < 0.5,
        `빗나감 ${(pair.offA ?? -1).toFixed(2)} · ${(pair.offB ?? -1).toFixed(2)} rad`);
    ok('짝이면 회복이 더 크다', pair.gained > pair.alone,
        `같은 판에서 혼자 +${pair.alone.toFixed(1)} → 둘이 +${pair.gained.toFixed(1)}`);
  }

  /* ---------- 9. 한쪽이 일어서면 풀린다 ---------- */
  const unpair = await ev(`(()=>{
    const [a, b] = S.cats;
    b.act = { s:'walk', t:0 };
    pairUp(); syncBubbles();
    return { aw:a._with, bw:b._with,
             hearts:[...document.querySelectorAll('.bubble.ico')].filter(e=>e.className.includes('ic-beat')).length };
  })()`);
  ok('한쪽이 일어서면 짝이 풀린다', !unpair.aw && !unpair.bw && unpair.hearts === 0,
      `짝 ${unpair.aw||'없음'}/${unpair.bw||'없음'} · 하트 ${unpair.hearts}`);

  /* ---------- 10·11. 같은 풍선이 문장과 그림을 번갈아 담는다 ---------- */
  const say = await ev(`(()=>{
    NPCS.length = 0;
    S.cats.forEach(x => { x.act = { s:'work', t:0 }; x._with = null; });
    const f = (W.facilities.coffee || chatSpots() || [])[0];
    const c = S.cats[0];
    if (f){ const s = adjacentFree(W, f)[0]; c.x = s.x; c.y = s.y; c.act = { s:'use', t:0, use:f }; }
    syncBubbles();
    const el0 = document.querySelector('.bubble');
    const wasIcon = !!(el0 && el0.classList.contains('ico') && el0.querySelector('svg'));
    sayAt(c.id, '테스트');
    syncBubbles();
    const el1 = document.querySelector('.bubble');
    return { wasIcon, n: document.querySelectorAll('.bubble').length,
             nowText: !!(el1 && !el1.classList.contains('ico') && el1.textContent === '테스트') };
  })()`);
  ok('말하면 그 풍선이 문장으로 바뀐다', say.wasIcon && say.nowText && say.n === 1,
      `그림→문장 ${say.wasIcon}→${say.nowText} · 풍선 ${say.n}개`);

  await sleep(3000);
  /* 3초 사이에 시뮬이 계속 돌아서 그 고양이는 이미 다른 일을 하고 있다. 다시 앉혀 놓고
     본다 — 여기서 볼 것은 「말이 끝나면 그림으로 돌아오나」이지 「3초 뒤에도 커피를
     마시고 있나」가 아니다. */
  const after = await ev(`(()=>{
    NPCS.length = 0;
    S.cats.forEach(x => { x.act = { s:'work', t:0 }; x._with = null; });
    const f = (W.facilities.coffee || chatSpots() || [])[0];
    const c = S.cats[0];
    if (f){ const s = adjacentFree(W, f)[0]; c.x = s.x; c.y = s.y; c.act = { s:'use', t:0, use:f }; }
    syncBubbles();
    const el = document.querySelector('.bubble');
    return { n: document.querySelectorAll('.bubble').length,
             back: !!(el && el.classList.contains('ico') && el.querySelector('svg')) };
  })()`);
  ok('2.6초 뒤 같은 풍선이 그림으로 돌아온다', after.back && after.n === 1,
      `그림 복귀 ${after.back} · 풍선 ${after.n}개`);

  /* ---------- 그림 한 장 ----------
     ── 왜 시뮬만 세우나 ──
     고양이를 가구에 앉혀 놓고 찍으려 하면, 찍기 전에 시뮬이 한 번 더 돌아서 절반이
     자리를 떠난다(decide 가 0.6초마다 돈다 — 실제로 아이콘 넷이 400ms 만에 하나로 줄었다).
     처음엔 rAF 사슬을 끊었다(loopGen++). **다시 살아났다** — 감시 타이머(main.js watchdog)와
     창 복귀 처리가 루프를 도로 잇는다. 그게 옳은 동작이고, 검사가 그걸 이길 이유가 없다.
     그래서 그리는 것은 그대로 두고 **시뮬만** 세운다: simTick 을 빈 함수로 갈아 둔다.
     화면은 계속 돌아서 GL 에 그림이 남고, 자리 계산(syncBubbles)도 계속 돌지만
     고양이는 앉은 자리에 머문다.

     ── 왜 낮으로 돌리나 ──
     이 게임의 기본 그림체는 어둡다(eerie). 밤 칸에서 찍으면 아이콘만 떠 있는
     검은 판이 나오고, 그러면 「겹쳐도 읽히나」를 볼 수가 없다. */
  await ev(`(()=>{
    window.__simTick = simTick; simTick = () => {};   // 시뮬만 정지 (그리기는 그대로)
    setSkyForce(''); setSkyAt(13.5); renderNight();
    R3.followOn(false);
    R3.camSet({ follow:false, center:true, zoom:${PHONE ? 0.78 : 0.62}, el:0.62, az:0.72 });
    R3.fit();
    /* 전원을 가구에 붙인다 — 보기 좋으라고가 아니라 **한 화면에 여러 아이콘이
       겹쳤을 때 읽히나**가 이 항목의 판정이다. */
    const uses = ['coffee','play','sleep','litter'].filter(u => (W.facilities[u]||[]).length);
    const chat = chatSpots();
    S.cats.forEach((c, i) => {
      /* 앞의 둘은 같은 잡담 가구에 앉힌다 — 하트가 화면에 있어야 한다 */
      if (i < 2 && chat.length){
        const sp = adjacentFree(W, chat[0]);
        if (sp.length > 1){ const s = sp[i]; c.x = s.x; c.y = s.y; c.act = { s:'use', t:0, use:chat[0] }; return; }
      }
      const u = uses[i % uses.length], f = W.facilities[u][0];
      const sp = adjacentFree(W, f); const s = sp[i % sp.length];
      c.x = s.x; c.y = s.y;
      c.act = u === 'sleep' ? { s:'sleep', t:0, use:f } : { s:'use', t:0, use:f };
    });
    pairUp();
    /* 돌아서는 데 프레임이 걸린다(setHeading 은 조금씩 튼다) */
    for (let i = 0; i < 90; i++) R3.sync(S.cats.concat(NPCS), DOCS, 0.05);
    R3.draw();
    syncBubbles();
    return { ico: document.querySelectorAll('.bubble.ico').length,
             hearts: [...document.querySelectorAll('.bubble.ico')].filter(e=>e.className.includes('ic-beat')).length,
             acts: S.cats.map(c => (c.act&&c.act.s) + '/' + (c.act&&c.act.use ? doingKind(c) : '-') + (c._with?'+짝':'')) };
  })()`);
  await sleep(400);

  /* ── WebGL 은 스크린샷에 안 잡힌다 ──
     이 무대는 preserveDrawingBuffer 없이 만들어져서 그림틀이 다음 프레임으로 넘어가면
     비어 있고, CDP 의 captureScreenshot 은 늘 다른 태스크에서 돈다
     (verify-cozy.js 머리말이 같은 함정을 적어 뒀다 — 거기서는 지표를 재려고 같은 호출
     안에서 2D 캔버스로 옮겼다). 여기서 필요한 건 지표가 아니라 **GL(방) 위에
     DOM(아이콘)이 얹힌 그림**이고, DOM 은 래스터로 뜰 수 없으니 반대로 한다:
     같은 호출 안에서 GL 을 PNG 로 떠서 그림 한 장으로 깔고 캔버스를 감춘다.
     아이콘 층(#fx3d)은 그 위에 그대로 있으므로 찍으면 둘이 합쳐진 한 장이 된다. */
  const compose = await ev(`(()=>{
    /* 한 마리는 말을 시킨다 — **문장 풍선과 그림 풍선이 한 화면에** 있어야
       「같은 물건이냐」를 눈으로 볼 수 있다. 찍기 직전에 시킨다: 앞 호출에서 시켜 두면
       그 사이에 도는 프레임이 수명(2.6초)을 다 써 버릴 수 있다. */
    sayAt(S.cats[S.cats.length - 1].id, DOING.litter[0]);
    R3.draw();
    const gl = document.getElementById('gl');
    const url = gl.toDataURL('image/png');
    let im = document.getElementById('__glshot');
    if (!im){ im = document.createElement('img'); im.id = '__glshot';
      im.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:1';
      gl.parentElement.appendChild(im); }
    im.src = url;
    gl.style.visibility = 'hidden';
    syncBubbles();
    return { len:url.length, ico: document.querySelectorAll('.bubble.ico').length,
             /* **화면 안에 있나**로 센다. project 는 뷰포트 밖의 점도 돌려주므로
                (숨기는 건 null 일 때뿐이다) visibility 만 보면 왼쪽 밖으로 나간
                아이콘까지 「보인다」로 세게 된다 — 실제로 하트 둘이 x=-44 에 있었다. */
             vis: [...document.querySelectorAll('.bubble.ico')].filter(e => e.style.visibility !== 'hidden'
                    && parseInt(e.style.left) > 0 && parseInt(e.style.left) < innerWidth
                    && parseInt(e.style.top) > 0 && parseInt(e.style.top) < innerHeight).length,
             at: [...document.querySelectorAll('.bubble.ico')].map(e =>
                   e.className.replace(/.*ic-/,'') + '@' + parseInt(e.style.left) + ',' + parseInt(e.style.top)
                   + (e.style.visibility === 'hidden' ? ' (숨음)' : '')) };
  })()`);
  await sleep(350);
  const shot = await send('Page.captureScreenshot', { format:'png' });
  fs.writeFileSync(path.join(OUT, PHONE ? 'icons-phone.png' : 'icons.png'), Buffer.from(shot.data, 'base64'));
  ok('한 화면에 여러 아이콘이 같이 뜬다', compose.vis >= 3,
      `${compose.vis}/${compose.ico} · ` + compose.at.join(' '));

  ok('콘솔 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | ') || '0');

  ws.close(); chrome.kill();
  const pass = rows.filter(r => r.pass).length;
  for (const r of rows) console.log(`  ${r.pass ? 'OK ' : 'X  '} ${r.name.padEnd(34)} ${r.note || ''}`);
  console.log(`\n  ${pass}/${rows.length}   그림 → spike/dist/shots/icons.png`);
  process.exit(pass === rows.length ? 0 : 1);
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
