/* 캘린더와 기한 — 혐의가 어디서 나오는지.  node spike/serve.js 먼저.

   바꾼 규칙: 혐의는 **분기 마감**이 아니라 **사람이 정한 기한(⏰)** 에서만 나온다.
   분기는 시간이 아니라 성과(KPI)로 굴러가므로, 전에는 "일을 많이 하면 분기가 빨리
   닫혀서 미처리 건이 더 빨리 새는" 시계였다 — 열심히 한 사람이 먼저 걸렸다.

   그래서 재는 것:
     · 업무일 경계가 근무의 반대편에 있나 (9–18 → 01:30, 22–06 → 14:00)
     · 기한 없는 건은 안 샌다 / ⏰ 건 것만 샌다 / 한 건은 한 번만
     · 큰 건 2점 · 하루 상한 3점
     · 늦게라도 처리하면 그 혐의가 지워진다
     · 어제 기한을 다 지킨 하루는 1점 소멸
     · 앞날 건은 결재함에 안 보이고, 그날이 되면 올라온다
     · 분기 마감은 이제 혐의를 건드리지 않는다
     · 벽에 달력이 걸려 있고(옛 저장에도), 눌러서 앞날에 미리 적을 수 있다
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9649;
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
  let page; for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  if (!page) throw new Error('크롬이 안 뜬다');
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
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
  await sleep(1500);

  /* 시험용 손잡이. 상태를 직접 만들고 정산을 불러 본다 —
     "며칠 기다린다"를 흉내 낼 방법은 이것뿐이다. */
  await ev(`window.__t = {
    reset(){ S.todos.length = 0; S.penalty = 0; S.dueDay = null; S.days = {}; renderTodos(); },
    /* n일 전(음수는 앞날) 칸에 한 건 올린다 */
    put(text, opt){
      opt = opt || {};
      const t = addTodo(text, opt.size || 's', { due: addDays(bizKey(), opt.d || 0), alarm: !!opt.alarm });
      if (opt.done){ t.done = true; t.doneDay = t.due; }
      return t.id;
    },
    settle(){ const r = settleDue(); renderTodos(); return { pen:S.penalty, leaked: r.leaked ? r.leaked.count : 0, cleared:r.cleared }; },
    snap(){ return { pen:S.penalty, open: openTodos().map(t => t.text), rows: S.todos.map(t => ({ x:t.text, due:t.due, al:!!t.alarm, late:t.late|0, done:!!t.done })) }; },
    biz(shift, y, mo, d, h, mi){
      const keep = S.shift; S.shift = shift;
      const k = bizKey(new Date(y, mo - 1, d, h, mi).getTime());
      S.shift = keep; return k;
    },
  }`);

  console.log('── 업무일 경계 (근무의 반대편) ──');
  const b1 = await ev(`JSON.stringify([
    __t.biz({start:9,end:18}, 2026,8,21, 0,30),
    __t.biz({start:9,end:18}, 2026,8,21, 2,0),
    __t.biz({start:9,end:18}, 2026,8,21, 23,0),
    __t.biz({start:22,end:6}, 2026,8,21, 23,0),
    __t.biz({start:22,end:6}, 2026,8,22, 5,0),
    __t.biz({start:22,end:6}, 2026,8,22, 15,0)])`);
  const B = JSON.parse(b1);
  ok(B[0] === '2026-08-20' && B[1] === '2026-08-21' && B[2] === '2026-08-21',
     '9–18 근무: 새벽 0시 반은 어제, 2시는 오늘', B.slice(0,3).join(' / '));
  ok(B[3] === '2026-08-21' && B[4] === '2026-08-21' && B[5] === '2026-08-22',
     '22–06 근무: 밤 근무가 한 하루로 붙어 있다', B.slice(3).join(' / '));
  ok(await ev(`dayKey(new Date(2026,7,7)) === '2026-08-07'`), '날짜 키가 자리를 채운다 (정렬되게)');

  console.log('\n── 기한이 없으면 아무 일도 없다 ──');
  await ev(`__t.reset(); __t.put('기한 없이 어제 올린 것', { d:-1 })`);
  let r = JSON.parse(await ev(`JSON.stringify(__t.settle())`));
  let sn = JSON.parse(await ev(`JSON.stringify(__t.snap())`));
  ok(r.pen === 0 && r.leaked === 0 && sn.open.length === 1,
     '기한 없는 건은 안 샌다 — 목록에 그대로 남는다', JSON.stringify(r));

  console.log('\n── ⏰ 를 건 것만 샌다 ──');
  await ev(`__t.reset(); __t.put('어제까지 냈어야 하는 것', { d:-1, alarm:true })`);
  r = JSON.parse(await ev(`JSON.stringify(__t.settle())`));
  sn = JSON.parse(await ev(`JSON.stringify(__t.snap())`));
  ok(r.pen === 1 && r.leaked === 1, '기한을 넘기면 혐의 +1', JSON.stringify(r));
  ok(sn.open.length === 1 && sn.rows[0].late === 1,
     '샌 건도 목록에서 사라지지 않는다', JSON.stringify(sn.rows[0]));

  r = JSON.parse(await ev(`JSON.stringify(__t.settle())`));
  ok(r.pen === 1, '두 번 정산해도 한 건은 한 번만 샌다', 'pen=' + r.pen);

  await ev(`__t.reset(); __t.put('큰 건', { d:-1, alarm:true, size:'l' })`);
  r = JSON.parse(await ev(`JSON.stringify(__t.settle())`));
  ok(r.pen === 2, '큰 건은 2점', 'pen=' + r.pen);

  await ev(`__t.reset(); for (let i=0;i<5;i++) __t.put('밀린 것 '+i, { d:-1, alarm:true })`);
  r = JSON.parse(await ev(`JSON.stringify(__t.settle())`));
  ok(r.pen === 3, '하루에 샐 수 있는 건 3점까지', 'pen=' + r.pen);

  console.log('\n── 늦게라도 하면 지워진다 ──');
  await ev(`__t.reset(); __t.put('늦은 것', { d:-1, alarm:true })`);
  await ev(`__t.settle()`);
  const before = await ev(`S.penalty`);
  await ev(`(() => { const t = S.todos.find(x => !x.done); completeTodo(t.id); })()`);
  await sleep(400);
  const after = await ev(`S.penalty`);
  ok(before === 1 && after === 0, '늦게 도장을 찍으면 그 건의 혐의가 지워진다', `${before} → ${after}`);

  console.log('\n── 지킨 하루 ──');
  await ev(`__t.reset(); S.penalty = 2; __t.put('어제 냈다', { d:-1, alarm:true, done:true }); S.dueDay = null;`);
  r = JSON.parse(await ev(`JSON.stringify(__t.settle())`));
  ok(r.pen === 1 && r.cleared === 1, '어제 기한을 다 지켰으면 1점 소멸', JSON.stringify(r));
  r = JSON.parse(await ev(`JSON.stringify(__t.settle())`));
  ok(r.pen === 1, '그 소멸은 하루에 한 번뿐', 'pen=' + r.pen);

  console.log('\n── 결재함은 오늘이다 ──');
  await ev(`__t.reset(); __t.put('내일 것', { d:1 }); __t.put('오늘 것', { d:0 }); __t.put('어제 것', { d:-1 })`);
  sn = JSON.parse(await ev(`JSON.stringify(__t.snap())`));
  ok(sn.open.length === 2 && !sn.open.includes('내일 것'),
     '앞날 건은 결재함에 안 보인다 (지난 건은 남는다)', sn.open.join(' · '));
  const rolled = await ev(`(() => { const t = S.todos.find(x => x.text === '내일 것');
    t.due = bizKey(); renderTodos(); return openTodos().some(x => x.text === '내일 것'); })()`);
  ok(rolled === true, '그날이 되면 저절로 올라온다');

  console.log('\n── 지난 기한은 무를 수 없다 ──');
  await ev(`__t.reset(); __t.put('샌 것', { d:-1, alarm:true }); __t.settle();`);
  const moved = await ev(`(() => { const t = S.todos[0]; return setDue(t.id, bizKey(), null); })()`);
  ok(moved === false, '이미 샌 건은 날짜를 옮길 수 없다');

  console.log('\n── 분기 마감은 이제 혐의를 안 건드린다 ──');
  /* 분기 결산의 **무작위 사건**은 여전히 혐의를 건드릴 수 있다(세무조사·낯선 차).
     그건 사건이고 그대로 둔 규칙이다. 여기서 재는 건 **이관 경로가 사라졌나**다 —
     S.referred 는 leakOverdue 에서만 오르고, 샌 건은 목록에서 지워졌었다. */
  const q = JSON.parse(await ev(`(() => {
    __t.reset();
    /* 옛 규칙이라면 정확히 이것이 샜다: 지난 분기에 올려놓고 안 끝낸 건 */
    __t.put('지난 분기에 올려놓고 안 끝낸 것', { d:0 });
    S.todos[0].q = Math.max(1, S.quarter - 1);
    const ref = S.referred, pen = S.penalty;
    closeQuarter();
    return JSON.stringify({ refBefore:ref, refAfter:S.referred, penBefore:pen, penAfter:S.penalty,
                            still: S.todos.length, late: S.todos[0] ? (S.todos[0].late|0) : -1 });
  })()`));
  await sleep(900);
  ok(q.refAfter === q.refBefore && q.still === 1 && q.late === 0,
     '분기가 닫혀도 이관되지 않고 건도 안 사라진다', JSON.stringify(q));
  if (q.penAfter !== q.penBefore)
    console.log(`   (혐의 ${q.penBefore} → ${q.penAfter} — 결산 사건이 건드린 것이고 그건 그대로 둔 규칙이다)`);
  await ev(`document.querySelectorAll('.veil').forEach(v => v.remove())`);

  console.log('\n── 벽에 걸린 달력 ──');
  const wall = JSON.parse(await ev(`(() => {
    const c = (W.wallDecor || []).filter(d => d.tile === TILE.CAL);
    const u = c.length ? unitAt(c[0].x, c[0].y) : null;
    return JSON.stringify({ n:c.length, unit: u ? u.tile : null, name: (TILE_INFO[TILE.CAL]||{}).n });
  })()`));
  ok(wall.n === 1, '사무실 벽에 달력이 한 장 걸려 있다', JSON.stringify(wall));
  ok(wall.unit === (await ev(`TILE.CAL`)), '그 칸을 누르면 달력으로 잡힌다 (배치·조사와 같은 집기)');

  /* 옛 저장 흉내 — 달력이 없는 벽에 ensureCal 이 걸어 주나 */
  const retro = JSON.parse(await ev(`(() => {
    const keep = W.wallDecor.map(d => ({ ...d }));
    W.wallDecor.forEach(d => { if (d.tile === TILE.CAL){ d.tile = TILE.DECOR; d.v = 5; } });
    const had = W.wallDecor.some(d => d.tile === TILE.CAL);
    const added = ensureCal(W);
    const now = W.wallDecor.filter(d => d.tile === TILE.CAL).length;
    const wasPic = W.wallDecor.find(d => d.tile === TILE.CAL);
    W.wallDecor = keep;
    return JSON.stringify({ had, added, now, v: wasPic ? wasPic.v : null });
  })()`));
  ok(retro.had === false && retro.added === true && retro.now === 1,
     '달력이 없는 옛 저장에도 걸어 준다', JSON.stringify(retro));
  ok(retro.v === 5, '이미 달력 그림이던 액자를 승격시킨다 (벽 모양이 안 바뀐다)');

  console.log('\n── 달력을 눌러 앞날에 미리 적기 ──');
  await ev(`__t.reset(); showCalendar()`);
  await sleep(700);
  const opened = JSON.parse(await ev(`(() => {
    const b = document.querySelector('#calBody');
    return JSON.stringify({ 열림:!!b, 칸수: b ? b.querySelectorAll('.ccell[data-key]').length : 0,
      오늘칸: b ? !!b.querySelector('.ccell.today') : false,
      입력칸: b ? !!b.querySelector('#calInput') : false });
  })()`));
  ok(opened.열림 && opened.칸수 >= 28 && opened.오늘칸 && opened.입력칸,
     '달력이 열리고 이번 달과 오늘 칸이 있다', JSON.stringify(opened));

  const wrote = JSON.parse(await ev(`(() => {
    const b = document.querySelector('#calBody');
    const tmr = addDays(bizKey(), 1);
    b.querySelector('.ccell[data-key="' + tmr + '"]').click();
    const inp = b.querySelector('#calInput');
    inp.value = '모레 낼 서류';
    b.querySelector('#calAlarm').click();          // ⏰ 를 켠다
    b.querySelector('#calAdd').click();
    const t = S.todos.find(x => x.text === '모레 낼 서류');
    return JSON.stringify({ 있나:!!t, due:t && t.due, alarm:t && !!t.alarm, tmr,
      결재함: openTodos().some(x => x.text === '모레 낼 서류') });
  })()`));
  ok(wrote.있나 && wrote.due === wrote.tmr && wrote.alarm === true && wrote.결재함 === false,
     '앞날 칸에 ⏰ 를 걸어 적으면 그날 것이 되고 오늘 결재함에는 안 뜬다', JSON.stringify(wrote));

  const past = JSON.parse(await ev(`(() => {
    const b = document.querySelector('#calBody');
    const y = addDays(bizKey(), -1);
    b.querySelector('.ccell[data-key="' + y + '"]').click();
    return JSON.stringify({ 입력칸: !!b.querySelector('#calInput'),
      글: b.querySelector('.calsec') ? b.querySelector('.calsec').textContent.replace(/\s+/g,' ').trim() : '' });
  })()`));
  ok(past.입력칸 === false, '지난 날은 읽기 전용이다 (어제 칸에 오늘 할 일을 적을 수는 없다)', past.글);
  await ev(`document.querySelectorAll('.veil').forEach(v => v.remove())`);

  console.log('\n── 사규가 같은 말을 하나 ──');
  const help = await ev(`(() => { $('#btnHelp').click();
    const t = document.querySelector('.veil .mbody').textContent.replace(/\s+/g,' ');
    document.querySelector('.veil [data-close]').click(); return t; })()`);
  ok(help.includes('기한'), '사규가 기한을 설명한다');
  ok(!/분기 마감 시점에 .{0,20}안 끝낸 건/.test(help), '분기 마감으로 샌다는 옛 문구가 없다');
  ok(help.includes('달력'), '사규가 벽 달력을 알려준다');

  /* ---------- 옛 저장이 넘어오나 ----------
     지금 놀고 있는 사람의 저장에는 day·due·alarm 이 없고, 날짜 키는 자리를 안 채웠고,
     벽에는 달력이 없다. 그 저장을 실제로 만들어서 다시 띄운다 — 여기가 깨지면 고친 게
     신고한 사람에게 가는 순간 그 사람의 회사가 깨진다. */
  console.log('\n── 옛 저장 마이그레이션 ──');
  await ev(`document.querySelectorAll('.veil').forEach(v => v.remove())`);
  const degraded = JSON.parse(await ev(`(() => {
    __t.reset();
    __t.put('옛 저장의 할 일 1', {});
    __t.put('옛 저장의 할 일 2', {});
    /* 옛 모양으로 되돌린다 */
    S.todos.forEach(t => { delete t.day; delete t.due; delete t.alarm; delete t.doneDay; });
    delete S.bizKey; delete S.days; delete S.dueDay;
    S.dateKey = '2026-8-7';                       // 자리를 안 채운 옛 키
    if (S.careDay) S.careDay.date = '2026-8-7';
    if (S.together) S.together.since = '2026-8-7';
    /* 벽에서 달력을 뗀다 — 저장되는 쪽(S.layout)까지 */
    const strip = list => (list || []).forEach(d => { if (d.tile === TILE.CAL){ d.tile = TILE.DECOR; d.v = 5; } });
    strip(W.wallDecor); strip(S.layout && S.layout.wallDecor);
    save();
    const raw = JSON.parse(localStorage.getItem('copycat.save.v1'));
    return JSON.stringify({ todo0: raw.todos[0], dateKey: raw.dateKey,
      cal: (raw.layout.wallDecor || []).filter(d => d.tile === TILE.CAL).length });
  })()`));
  ok(degraded.todo0.due === undefined && degraded.cal === 0 && degraded.dateKey === '2026-8-7',
     '옛 모양 저장을 만들었다 (날짜 없음 · 안 채운 키 · 달력 없음)', JSON.stringify(degraded));

  await send('Page.navigate', { url: BASE + '/index.html' });
  await sleep(12000);
  await ev(`(() => { document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
  await sleep(600);
  const mig = JSON.parse(await ev(`(() => JSON.stringify({
    today: bizKey(),
    rows: S.todos.map(t => ({ x:t.text, day:t.day, due:t.due, al:!!t.alarm })),
    dateKey: S.dateKey, bizKey: S.bizKey, days: !!S.days,
    cal: (W.wallDecor || []).filter(d => d.tile === TILE.CAL).length,
    calV: (W.wallDecor || []).filter(d => d.tile === TILE.CAL).map(d => d.v),
    open: openTodos().length, pen: S.penalty,
    log: S.log.slice(-6).map(l => l.t).join(' | '),
  }))()`));
  ok(mig.rows.length === 2 && mig.rows.every(r => r.due === mig.today && r.day === mig.today && !r.al),
     '옛 투두가 오늘 칸으로 오고 기한은 안 걸린다', JSON.stringify(mig.rows));
  ok(mig.dateKey === mig.today.slice(0, 8) + mig.dateKey.slice(8) && /^\d{4}-\d{2}-\d{2}$/.test(mig.dateKey),
     '안 채운 날짜 키가 채워졌다', mig.dateKey);
  ok(mig.bizKey === mig.today && mig.days === true, '업무일 도장과 날짜별 기록이 생겼다');
  ok(mig.cal === 1 && mig.calV[0] === 5, '벽에 달력이 다시 걸렸다 (달력 그림이던 액자)', JSON.stringify(mig.calV));
  ok(mig.open === 2 && mig.pen === 0, '결재함에 그대로 두 건, 혐의는 안 올랐다',
     `open=${mig.open} pen=${mig.pen}`);
  ok(/달력/.test(mig.log), '달력이 눌린다고 사보에 한 줄 남았다', mig.log.slice(-90));

  console.log('\n오류: ' + (errs.length ? errs.slice(0, 4).join(' | ') : '없음'));
  if (errs.length) fail++;
  console.log(fail ? `\n${fail}건 실패` : '\n전부 통과');
  ws.close(); chrome.kill(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
