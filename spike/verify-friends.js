/* 제휴 게시판 — 남의 사무실을 구경하는 틀.  node spike/serve.js 먼저.

   **서버를 일부러 막고 돈다**(Network.setBlockedURLs). 여기서 재는 것은 통신이 아니라
   **틀과 선**이고, 그건 흉내 자료 위에서 본다 — 서버가 붙은 뒤로 진짜 목록(비어 있다)이
   와서 이 검사가 떨어졌었다. 서버로 도는 한 바퀴는 `verify-journey.js` 가 본다.
   덤으로 **서버가 없을 때도 게임이 도는가**가 여기서 확인된다.

   화면은 데스크톱(1400×900)으로 본다 — 여기서만 진짜 마우스를 쓰기 때문이다(회전).
   그래서 시작 화면과 폰 전용 조작을 먼저 걷어낸다. 안 걷으면 그것들이 마우스를
   가로채고, 카메라가 고장 난 것처럼 보인다:

     · 벽에 게시판이 걸려 있고(옛 저장에도), 눌러서 열린다
     · 지점 목록에서 실시간으로 움직이는 값은 「불이 켜져 있나」 하나다
     · 저쪽 결재함은 **읽기 전용**이다 — 체크 칸도 지우기도 없다
     · 인사(🐟)는 하루에 한 번이고 **경제를 1도 건드리지 않는다**
     · 내가 남에게 올리는 것(FRIENDS.mine)에 멸치·성과·혐의가 **없다**
     · 화면에 달성률·연속 일수 같은 말이 없다

   마지막 둘이 제일 중요하다. 서버를 세운 뒤에는 형식을 못 바꾸고, 남의 진도를 숫자로
   만드는 화면은 한 줄만 새어도 이 게임이 파는 것(같이 있다는 신호)을 뒤집는다.
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
/* 포트를 실행마다 다르게 잡는다 — 앞 실행의 크롬이 아직 안 죽었을 때 같은 포트를
   다시 잡으면 남의 브라우저에 붙거나 아예 못 뜬다(연속으로 돌리면 실제로 그랬다). */
const PORT = 9600 + (process.pid % 90);
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
if (!CHROME) throw new Error('크롬을 못 찾았다');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-ime-' + process.pid);
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page; for (let i = 0; i < 160 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  if (!page) throw new Error(`크롬이 ${PORT} 에서 안 떴다 — 남은 크롬을 닫고 다시`);
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
  /* **서버를 막고 본다.** 이 검사가 재는 것은 통신이 아니라 틀과 선이고, 그 틀은
     흉내 자료(MOCK) 위에서 그려진다 — 서버가 붙으면 진짜 목록(비어 있다)이 와서
     `f1` 같은 흉내 지점이 사라지고, 검사는 제품이 아니라 **서버가 생겼다는 사실**
     때문에 떨어진다(2026-09-02 백엔드 이후 실제로 그랬다).
     막아 두면 겸사겸사 **서버 없이도 게임이 도는가**를 같이 보게 된다. */
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*supabase*', '*jsdelivr*'] });
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;

  let fail = 0;
  const ok = (cond, name, extra) => {
    if (!cond) fail++;
    console.log(`${cond ? '✅' : '❌'} ${name}${extra ? '   ' + extra : ''}`);
  };

  await send('Emulation.setDeviceMetricsOverride', { width:1400, height:900, deviceScaleFactor:1, mobile:false });
  await send('Page.navigate', { url: BASE + '/index.html' });
  await sleep(11000);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1200);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1200);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2400);
  await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
    /* 시작 화면(2026-09-02 추가)은 z-index 9999 로 **화면을 통째로 덮는다.** JS 로 부르는
       것은 그래도 되지만 마우스 이벤트는 거기서 막힌다 — 이 검사에서 유일하게 진짜
       마우스를 쓰는 곳이 아래 드래그라, 이걸 안 걷으면 그것만 조용히 떨어진다. */
    const t=document.querySelector('#cctitle'); if (t) t.remove();
    document.body.classList.remove('titleon');
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
  await sleep(1500);

  console.log('── 벽에 걸린 게시판 ──');
  /* **집히는지를 묻지 않는다.** 예전에는 `unitAt` 이 벽 물건도 돌려줬고 이 검사도
     그걸 봤는데, 그 뒤로 벽에 걸린 것은 아예 안 집기로 정했다(js/edit.js 「벽은 방의
     일부다」 — 줄 단위로 채운 것이라 한 칸만 빼면 줄이 어긋나고 되돌릴 자리도 없다).
     제품이 바뀐 자리에 검사만 옛 기대값으로 남아서, 고칠 것이 없는데 매번 빨갛게
     떴다(2026-09-21). 지금 물어야 하는 것은 둘이다: **한 장 걸려 있나**,
     그리고 **안 집히나**. 뒤엣것이 그날 내린 결정이므로 같이 박아 둔다. */
  const wall = JSON.parse(await ev(`(() => {
    const b = (W.wallDecor || []).filter(d => d.tile === TILE.BOARD);
    const u = b.length ? unitAt(b[0].x, b[0].y) : null;
    return JSON.stringify({ n:b.length, 집힘:!!u,
      name:(TILE_INFO[TILE.BOARD]||{}).n, cal:(W.wallDecor||[]).filter(d => d.tile === TILE.CAL).length });
  })()`));
  ok(wall.n === 1, '사무실 벽에 게시판이 하나 걸려 있다', JSON.stringify(wall));
  ok(wall.집힘 === false, '그리고 안 집힌다 — 벽은 방의 일부다 (배치 모드가 못 떼 간다)');
  ok(wall.cal === 1, '달력도 그대로 한 장 (둘이 서로 자리를 안 먹는다)');

  const retro = JSON.parse(await ev(`(() => {
    const keep = W.wallDecor.map(d => ({ ...d }));
    W.wallDecor.forEach(d => { if (d.tile === TILE.BOARD){ d.tile = TILE.DECOR; d.v = 4; } });
    const had = W.wallDecor.some(d => d.tile === TILE.BOARD);
    const added = ensureBoard(W);
    const got = W.wallDecor.find(d => d.tile === TILE.BOARD);
    const out = { had, added, v: got ? got.v : null,
                  n: W.wallDecor.filter(d => d.tile === TILE.BOARD).length };
    W.wallDecor = keep;
    return JSON.stringify(out);
  })()`));
  /* `v` 를 **4 인지** 묻지 않고 **코르크로 읽히는지**(v%9===4) 묻는다. 승격 규칙이
     그렇게 적혀 있고(js/world.js ensureBoard), 방은 판마다 새로 생성되므로 벽에
     코르크 액자가 둘일 수 있다 — 그때 `find` 는 앞엣것을 집어서 v 가 31 로 나온다
     (31 % 9 === 4, 같은 그림이다). 4 로 못박아 두면 **방이 어떻게 생겼느냐에 따라**
     떴다 말았다 하는 검사가 되고, 그건 무엇도 못 지킨다(2026-09-21). */
  ok(retro.had === false && retro.added === true && retro.n === 1
     && (retro.v | 0) % 9 === 4,
     '게시판이 없는 옛 저장에는 코르크 그림이던 액자를 승격시킨다', JSON.stringify(retro));

  console.log('\n── 목록 ──');
  await ev(`showBoard()`);
  await sleep(900);
  const list = JSON.parse(await ev(`(() => {
    const b = document.querySelector('#boardBody');
    const cards = [...b.querySelectorAll('[data-go]')];
    return JSON.stringify({
      n: cards.length,
      lit: cards.filter(c => c.classList.contains('lit')).length,
      도면: cards.filter(c => (c.querySelector('img.shot')||{}).src && c.querySelector('img.shot').src.startsWith('data:image')).length,
      코드: (b.querySelector('.codebox code')||{}).textContent,
      띠: !!b.querySelector('.prebadge'),
      본문: b.textContent.replace(/\s+/g,' '),
    });
  })()`));
  ok(list.n === 4 && list.도면 === 4, '지점 넷과 도면 넷', `n=${list.n} 도면=${list.도면}`);
  ok(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(list.코드 || ''), '내 지점 코드가 있다', list.코드);
  ok(list.띠 === true, '흉내라고 화면에 적어 뒀다 (서버가 붙으면 저절로 사라진다)');
  ok(!/%|연속|달성률|랭킹|순위/.test(list.본문), '목록에 달성률·연속·순위 같은 말이 없다');

  /* 불빛은 근무 시간에서 나온다 — 목록에서 유일하게 실시간으로 움직이는 값 */
  const lit = JSON.parse(await ev(`JSON.stringify(FRIENDS.list().map(f => ({ id:f.id, on:f.working })))`));
  const litExpect = JSON.parse(await ev(`(() => {
    const m = nowMin();
    const on = s => { const st = ((s.start%24)+24)%24*60, len = (((s.end-s.start+24)%24)||24)*60;
                      return (((m - st) % 1440 + 1440) % 1440) < len; };
    return JSON.stringify([{ id:'f1', on:on({start:9,end:18}) }, { id:'f2', on:on({start:22,end:6}) },
                           { id:'f3', on:on({start:13,end:19}) }, { id:'f4', on:on({start:8,end:17}) }]);
  })()`));
  ok(JSON.stringify(lit) === JSON.stringify(litExpect),
     '불빛이 그쪽 근무 시간에서 나온다', JSON.stringify(lit));

  console.log('\n── 한 지점 ──');
  await ev(`(() => { document.querySelector('[data-go="f1"]').click(); })()`);
  await sleep(900);
  const br = JSON.parse(await ev(`(() => {
    const b = document.querySelector('#brBody');
    const rows = [...b.querySelectorAll('.calrow')];
    return JSON.stringify({
      도면: !!b.querySelector('img.plan'),
      줄: rows.length,
      끝낸줄: rows.filter(r => r.classList.contains('done')).length,
      체크칸: b.querySelectorAll('.chk,[data-act]').length,
      지우기: b.querySelectorAll('.del,[data-del]').length,
      인사칸: !!b.querySelector('#brSend'),
      본문: b.textContent.replace(/\s+/g,' '),
    });
  })()`));
  ok(br.도면 && br.줄 === 3, '도면과 저쪽 오늘 결재함 세 줄', `줄=${br.줄}`);
  ok(br.체크칸 === 0 && br.지우기 === 0, '읽기 전용이다 — 남의 할 일에 손댈 수 있는 건 없다');
  ok(!/%|연속|달성률|\d+\s*\/\s*\d+/.test(br.본문), '「몇 건 중 몇 건」도 안 적는다');
  ok(br.인사칸 === true, '인사 칸이 있다');

  console.log('\n── 인사는 하루 한 번, 경제는 안 건드린다 ──');
  /* 멸치는 고양이들이 실시간으로 벌고 있어서 가만히 있어도 조금씩 는다 —
     그래서 "1도 안 변했다"가 아니라 **선물이 얹히지 않았다**를 잰다(1초 벌이보다 작다).
     성과와 혐의는 도장·기한에서만 움직이므로 그쪽은 정확히 같아야 한다. */
  const before = JSON.parse(await ev(`JSON.stringify({ 멸치:S.anchovy, 성과:S.kpi, 혐의:S.penalty, 초당:totalRate() })`));
  const first = await ev(`(() => { const n = document.querySelector('#brNote'); if (n) n.value = '오늘도 무사히';
    document.querySelector('#brSend').click(); return true; })()`);
  await sleep(700);
  const after = JSON.parse(await ev(`JSON.stringify({ 멸치:S.anchovy, 성과:S.kpi, 혐의:S.penalty,
    보낸것:S.friends.sent.f1, 다시:!!document.querySelector('#brSend'),
    적힘: document.querySelector('#brBody').textContent.includes('오늘도 무사히') })`));
  ok(first === true && after.보낸것 && after.보낸것.kind === 'fish' && after.보낸것.note === '오늘도 무사히',
     '인사가 저장에 남는다 (쪽지까지)', JSON.stringify(after.보낸것));
  ok(after.다시 === false && after.적힘 === true, '오늘은 다시 못 보낸다 — 보낸 쪽지가 대신 보인다');
  /* 멸치는 고양이들이 실시간으로 벌고 있어서 두 번 읽는 사이에도 는다. 그래서 재는 방법을
     바꾼다: **한 번의 동기 호출 안에서** 전후를 읽는다 — 그 사이에는 틱이 끼어들 수 없으므로
     "인사가 경제를 건드리지 않는다"를 흔들림 없이 잰다. */
  const clean = JSON.parse(await ev(`(() => {
    const b = { a:S.anchovy, k:S.kpi, p:S.penalty };
    const done = FRIENDS.react('f2', 'fish', '거기도 무사히');
    const a = { a:S.anchovy, k:S.kpi, p:S.penalty };
    return JSON.stringify({ done, same: b.a === a.a && b.k === a.k && b.p === a.p, a:a.a, k:a.k, p:a.p });
  })()`));
  ok(clean.done === true && clean.same === true,
     '인사는 멸치·성과·혐의를 한 톨도 안 건드린다 (같은 틱 안에서 확인)', JSON.stringify(clean));
  ok((await ev(`FRIENDS.react('f1','fish','또')`)) === false, '자료층도 두 번은 거부한다');

  console.log('\n── 내가 남에게 올리는 것 ──');
  /* 빈 목록으로 재면 아무것도 안 잰 것이 된다 — 한 줄 올려 두고 형식을 본다 */
  await ev(`(() => { S.todos.length = 0; addTodo('올려 보는 서류', 'm', { alarm:true }); })()`);
  const mine = JSON.parse(await ev(`JSON.stringify(FRIENDS.mine())`));
  const raw = await ev(`JSON.stringify(FRIENDS.mine())`);
  ok(Array.isArray(mine.todos) && mine.tier != null && mine.seed != null && Array.isArray(mine.cats),
     '올리는 것: 오늘 결재함 · 사무실 seed · 고양이 이름', Object.keys(mine).join(','));
  ok(!/anchovy|kpi|penalty|referred|rival|stats|멸치/.test(raw),
     '멸치·성과·혐의·경쟁사·통계는 안 올라간다');
  ok(mine.todos.length === 1
     && mine.todos.every(t => Object.keys(t).sort().join(',') === 'alarm,done,late,text')
     && mine.todos[0].text === '올려 보는 서류' && mine.todos[0].alarm === true,
     '할 일은 글·완료·기한·샜음 넷만 나간다 (성과·멸치·id 없이)', JSON.stringify(mine.todos[0] || null));
  const day = await ev(`bizKey()`);
  ok(mine.day === day, '오늘 것만 나간다 (남의 캘린더를 뒤지는 화면이 안 되게)');

  console.log('\n── 코드는 다시 열어도 같다 ──');
  const c1 = await ev(`FRIENDS.code()`);
  await ev(`document.querySelectorAll('.veil').forEach(v => v.remove()); showBoard()`);
  await sleep(700);
  const c2 = await ev(`FRIENDS.code()`);
  const saved = await ev(`JSON.parse(localStorage.getItem('copycat.save.v1')).friends.code`);
  ok(c1 === c2 && c1 === saved, '코드가 저장에 남고 그대로다', `${c1} / ${saved}`);
  await ev(`document.querySelectorAll('.veil').forEach(v => v.remove())`);

  console.log('\n── 남의 사무실에 들어간다 ──');
  await ev(`document.querySelectorAll('.veil').forEach(v => v.remove())`);
  const mineWorld = JSON.parse(await ev(`(() => {
    const d = R3.debug();
    return JSON.stringify({ tier:S.tier, seed:S.seed, actors:d.actors, tags:d.tags ? d.tags.length : null });
  })()`));
  const enter = JSON.parse(await ev(`(() => {
    const okIn = visitStart('f4');
    const d = R3.debug();
    const bar = document.querySelector('#visitBar');
    return JSON.stringify({ okIn, visiting: visiting(), actors:d.actors,
      band: !!bar, bandText: bar ? bar.textContent.replace(/\s+/g,' ').trim() : '',
      body: document.body.classList.contains('visiting'),
      myCats: S.cats.length, catIds: d.cats ? d.cats.map(c => c.id.slice(0,2)) : null });
  })()`));
  ok(enter.okIn === true && enter.visiting === true && enter.band && enter.body,
     '들어가면 무대가 저쪽 방이 되고 띠가 뜬다', enter.bandText.slice(0, 40));
  ok(enter.catIds && enter.catIds.length === 6 && enter.catIds.every(x => x === 'v-'),
     '무대에 선 배우가 저쪽 고양이 여섯으로 갈렸다 (내 고양이는 화면에서 빠진다)',
     JSON.stringify(enter.catIds));
  ok(enter.myCats === (await ev(`S.cats.length`)),
     '내 고양이 목록은 그대로다 — 저장은 한 글자도 안 바뀐다');

  /* 시뮬레이션이 계속 도는지 — 구경하는 동안 내 회사가 멈추면 그건 다른 게임이다 */
  const t0 = JSON.parse(await ev(`JSON.stringify({ a:S.anchovy, c:S.clock })`));
  await sleep(2500);
  const t1 = JSON.parse(await ev(`JSON.stringify({ a:S.anchovy, c:S.clock })`));
  ok(t1.a > t0.a, '구경하는 동안에도 내 사무실은 계속 돌아간다 (벌이가 늘었다)',
     `${t0.a.toFixed(1)} → ${t1.a.toFixed(1)}`);

  /* 끌어서 돌려 본다 — 카메라가 실제로 움직여야 「구경」이다 */
  const camA = JSON.parse(await ev(`JSON.stringify(R3.debug().cam)`));
  /* 끌 자리를 **찾아서** 잡는다. 좌표를 박아 두면 그 위에 단추 하나가 생기는 날
     회전이 안 되는 것처럼 보인다 — 실제로 그랬다(폰 스킨의 화살표가 데스크톱에서
     스타일 없이 떠 있었다). 캔버스가 실제로 잡히는 점을 고른다. */
  const spot = await ev(`(() => {
    for (const p of [[900,500],[700,340],[1080,620],[520,300],[900,260],[1150,380]]) {
      const e = document.elementFromPoint(p[0], p[1]);
      if (e && e.tagName === 'CANVAS') return { x:p[0], y:p[1] };
    }
    return null; })()`);
  if (!spot) console.log('  캔버스가 잡히는 자리를 못 찾았다 — 무엇이 무대를 덮고 있다');
  const DX = spot ? spot.x : 900, DY = spot ? spot.y : 500;
  await send('Input.dispatchMouseEvent', { type:'mousePressed', x:DX, y:DY, button:'right', clickCount:1, buttons:2 });
  for (let i = 1; i <= 6; i++)
    await send('Input.dispatchMouseEvent', { type:'mouseMoved', x:DX - i*16, y:DY, button:'right', buttons:2 });
  await send('Input.dispatchMouseEvent', { type:'mouseReleased', x:DX-96, y:DY, button:'right', buttons:0 });
  await sleep(400);
  const camB = JSON.parse(await ev(`JSON.stringify(R3.debug().cam)`));
  /* 안 돌았으면 **무엇이 가로막고 있었는지** 같이 적는다. 좌표 위에 캔버스가 아니라
     다른 것이 있으면 그건 카메라 고장이 아니라 덮개 이야기다. */
  const over = await ev(`(() => { const e = document.elementFromPoint(${DX}, ${DY});
    if (!e) return 'null';
    /* className 은 SVG 에서 객체다 — 그냥 쓰면 [object Object] 가 찍혀서
       진단이 진단을 못 한다. */
    const nm = n => { const c = typeof n.className === 'string' ? n.className
                        : (n.className && n.className.baseVal) || '';
      return n.tagName + (n.id ? '#' + n.id : '') + (c ? '.' + c : ''); };
    const chain = []; for (let n = e; n && chain.length < 5; n = n.parentElement) chain.push(nm(n));
    return chain.join(' < '); })()`).catch(()=>'?');
  ok(Math.abs(camB.az - camA.az) > 0.05,
     '오른쪽 드래그로 저쪽 방이 돌아간다  [커서 밑: ' + over + ']',
     `az ${camA.az} → ${camB.az}`);

  /* 남의 방에서는 조사도 배치도 없다 */
  const guard = JSON.parse(await ev(`(() => {
    const before = EDIT.on;
    toggleEdit();
    const after = EDIT.on;
    document.querySelectorAll('.veil').forEach(v => v.remove());
    return JSON.stringify({ before, after });
  })()`));
  ok(guard.after === false, '구경 중에는 배치 모드가 안 열린다 (내 가구가 조용히 이사하지 않게)');

  console.log('\n── 나온다 ──');
  const back = JSON.parse(await ev(`(() => {
    visitEnd();
    const d = R3.debug();
    return JSON.stringify({ visiting: visiting(), band: !!document.querySelector('#visitBar'),
      body: document.body.classList.contains('visiting'),
      catIds: d.cats ? d.cats.map(c => c.id.slice(0,2)) : null, actors:d.actors });
  })()`));
  ok(back.visiting === false && !back.band && !back.body, '나오면 띠가 사라진다');
  ok(back.catIds && back.catIds.length && !back.catIds.some(x => x === 'v-'),
     '무대가 내 사무실과 내 고양이로 돌아왔다', JSON.stringify(back.actors));

  console.log('\n── 사진은 진짜 렌더다 ──');
  const shot = JSON.parse(await ev(`(() => {
    const url = branchPhoto(FRIENDS.snapshot('f1'), 260, 168);
    restoreOffice();
    return JSON.stringify({ png: !!url && url.startsWith('data:image/'), kind: url ? url.slice(11, 26) : '',
      len: url ? url.length : 0, cached: branchPhoto(FRIENDS.snapshot('f1'), 260, 168) === url });
  })()`));
  ok(shot.png && shot.len > 3000, '지점 사진이 캔버스에서 나온 그림이다',
     `${shot.kind} · ${Math.round(shot.len/1024)}KB`);
  ok(shot.cached === true, '한 번 찍은 사진은 다시 안 찍는다 (같은 세션 캐시)');
  const stillMine = JSON.parse(await ev(`(() => { const d = R3.debug();
    return JSON.stringify({ ids: d.cats ? d.cats.map(c => c.id.slice(0,2)) : [] }); })()`));
  ok(!stillMine.ids.some(x => x === 'v-'), '사진을 찍은 뒤 무대는 내 사무실로 돌아와 있다');

  /* ---------- 「3D 가 없는 화면」은 걷어냈다 ----------
     여기 다섯 항목이 있었다: `?3d=0` 으로 열어 도면이 사진을 대신하는가, 구경하기가
     눌리기만 하지 않고 「왜 안 되는지」를 말하는가.

     그 길이 **제품에서 없어졌다.** 떨어질 도트판이 사라진 2026-08-24 에 `?3d=0` 도
     같이 지웠다(js/render3d.js autostart 주석). 그 뒤로 이 다섯은 없는 기능을 붙잡고
     빨간 채로 남았고, 헤드리스에서 WebGL 이 우연히 죽는 판에서는 **우연히 통과**하기도
     했다 — 늘 빨갛거나 우연히 초록인 검사는 아무도 안 읽는다.

     WebGL 이 없는 기계에서 무엇이 보이는가는 여전히 볼 값어치가 있다. 다만 그건
     `?3d=0` 이 아니라 **컨텍스트를 못 만드는 상황**을 만들어야 하는 다른 검사다. */


  console.log('\n오류: ' + (errs.length ? errs.slice(0, 4).join(' | ') : '없음'));
  if (errs.length) fail++;
  console.log(fail ? `\n${fail}건 실패` : '\n전부 통과');
  ws.close(); chrome.kill(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
