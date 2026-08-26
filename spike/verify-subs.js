/* 루틴과 세부 업무 — 27번이 세운 날짜 위에 얹은 둘.  node spike/serve.js 먼저.

   재는 것:

   세부 업무(29)
     · ＋ 로 붙이면 묶음이 되고, 잎은 **부모의 날**에 산다
     · 부모에는 체크 칸이 없다 — 도장은 잎에서만 찍힌다(같은 일로 두 번 받지 않게)
     · 마지막 잎이 끝나면 부모는 **저절로** 닫히고, 그때 서류는 안 나간다
     · 부모를 미루면 잎도 같이 가고, 부모를 지우면 잎도 같이 간다
     · 손자는 안 생긴다 (두 층이면 목록이고 세 층이면 문서다)

   루틴(28)
     · 그 요일이면 아침에 올라오고, **하루에 한 번만** 올라온다
     · **기한이 안 걸린다** — 한 번 걸면 매일 새기 때문이다
     · **지난 날 몫은 소급해서 안 올라온다** (사흘 만에 켜도 오늘 것만)
     · 루틴을 지워도 이미 올라온 줄은 남는다
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9651;
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

  await send('Emulation.setDeviceMetricsOverride', { width:1400, height:900, deviceScaleFactor:1, mobile:false });
  await send('Page.navigate', { url: BASE + '/index.html' });
  await sleep(11000);
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/재생|Play|再生/.test(x.textContent||'')); if (b) b.click(); })()`);
  await sleep(900);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1200);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1200);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2400);
  await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
  await sleep(1500);

  await ev(`window.__t = {
    reset(){ S.todos.length = 0; S.routines = []; S.penalty = 0; S.dueDay = null; DOCS.length = 0; renderTodos(); },
    put(text, opt){ opt = opt || {}; const t = addTodo(text, opt.size || 's',
      { due: addDays(bizKey(), opt.d || 0), alarm: !!opt.alarm, parent: opt.parent }); return t.id; },
    rows(){ return S.todos.map(t => ({ x:t.text, id:t.id, p:t.parent || null, due:t.due,
      done:!!t.done, al:!!t.alarm, late:t.late|0, rt:t.rt || null })); },
    dom(){ const el = document.querySelector('#todoList');
      return { rows:[...el.querySelectorAll('.todo')].map(r => ({
        id:r.dataset.id, kid:r.classList.contains('kid'), group:r.classList.contains('group'),
        chk:!!r.querySelector('.chk'), fold:!!r.querySelector('.fold'),
        sub:!!r.querySelector('[data-act="sub"]'), txt:r.querySelector('.txt').textContent.replace(/\s+/g,' ').trim() })) };
    },
  }`);

  console.log('── 묶음이 된다 ──');
  const g1 = JSON.parse(await ev(`(() => {
    __t.reset();
    const p = __t.put('대청소', { size:'l', d:1 });          // 내일 칸에 부모를 둔다
    const a = __t.put('빨래하기', { parent:p });
    const b = __t.put('거실 물청소', { parent:p, size:'m' });
    renderTodos();
    return JSON.stringify({ rows: __t.rows(), kids: kidsOf(p).length, isP: isParent(S.todos[0]) });
  })()`));
  ok(g1.kids === 2 && g1.isP === true, '＋ 로 붙인 줄이 잎이 된다', `잎 ${g1.kids}`);
  ok(g1.rows.slice(1).every(r => r.due === g1.rows[0].due),
     '잎은 부모의 날에 산다 (묶음은 하루의 일이다)', g1.rows.map(r => r.due).join(' '));

  const dom1 = JSON.parse(await ev(`(() => { S.todos.forEach(t => t.due = bizKey()); renderTodos();
    return JSON.stringify(__t.dom()); })()`));
  const par = dom1.rows.find(r => r.group), kid = dom1.rows.find(r => r.kid);
  ok(par && !par.chk && par.fold, '부모에는 체크 칸이 없고 접기 손잡이가 있다', JSON.stringify(par));
  ok(kid && !kid.sub, '잎에는 ＋ 가 없다 (손자를 안 만든다)');
  ok(/남은 2건/.test(par.txt), '부모 줄은 보상 대신 남은 수를 적는다', par.txt.slice(0, 40));

  const grand = await ev(`(() => { const k = S.todos.find(t => t.parent);
    const g = addTodo('손자', 's', { parent: k.id }); return !g.parent; })()`);
  ok(grand === true, '잎에 붙이려 해도 손자는 안 생긴다 (제자리 줄이 된다)');

  console.log('\n── 도장은 잎에서만 ──');
  const st = JSON.parse(await ev(`(() => {
    __t.reset();
    const p = __t.put('대청소', { size:'l' });
    const a = __t.put('빨래', { parent:p }), b = __t.put('물청소', { parent:p });
    const d0 = DOCS.length;
    const okP = completeTodo(p);                         // 부모를 직접 닫으려 해 본다
    completeTodo(a);
    const midParent = S.todos.find(t => t.id === p).done;
    completeTodo(b);
    const rows = __t.rows();
    return JSON.stringify({ okP, midParent, d0, docs: DOCS.length,
      parentDone: rows.find(r => r.id === p).done, kidsDone: rows.filter(r => r.p).every(r => r.done) });
  })()`));
  ok(st.okP === false, '부모는 손으로 닫히지 않는다');
  ok(st.midParent === false, '잎 하나가 끝나도 부모는 안 닫힌다');
  ok(st.parentDone === true && st.kidsDone === true, '마지막 잎이 끝나면 부모가 저절로 닫힌다');
  ok(st.docs === 2, '서류는 잎 수만큼만 나간다 (부모 몫이 따로 없다)', `서류 ${st.docs}장`);

  console.log('\n── 묶음은 같이 움직이고 같이 사라진다 ──');
  const mv = JSON.parse(await ev(`(() => {
    __t.reset();
    const p = __t.put('대청소');
    __t.put('빨래', { parent:p }); __t.put('물청소', { parent:p });
    setDue(p, addDays(bizKey(), 2), true);
    const rows = __t.rows();
    return JSON.stringify({ dues: rows.map(r => r.due), alarms: rows.map(r => r.al),
      결재함: openTodos().length });
  })()`));
  ok(mv.dues.every(d => d === mv.dues[0]), '부모를 미루면 잎도 같이 간다', mv.dues.join(' '));
  ok(mv.alarms[0] === true && !mv.alarms[1] && !mv.alarms[2],
     '기한은 부모에만 걸린다 (잎마다 걸면 하루에 셋이 샌다)');
  ok(mv.결재함 === 0, '앞날로 옮긴 묶음은 오늘 결재함에서 사라진다');

  const del = JSON.parse(await ev(`(() => {
    __t.reset();
    const p = __t.put('대청소');
    __t.put('빨래', { parent:p }); __t.put('물청소', { parent:p });
    const n = delTodo(p);
    return JSON.stringify({ n, left: S.todos.length });
  })()`));
  ok(del.n === 3 && del.left === 0, '부모를 지우면 잎도 같이 간다', `지운 줄 ${del.n}`);

  const fold = JSON.parse(await ev(`(() => {
    __t.reset();
    const p = __t.put('대청소');
    __t.put('빨래', { parent:p }); renderTodos();
    const before = document.querySelectorAll('#todoList .todo').length;
    const t = S.todos.find(x => x.id === p); t.fold = true; save(); renderTodos();
    const after = document.querySelectorAll('#todoList .todo').length;
    const saved = JSON.parse(localStorage.getItem('copycat.save.v1')).todos.find(x => x.id === p).fold;
    return JSON.stringify({ before, after, saved });
  })()`));
  ok(fold.before === 2 && fold.after === 1 && fold.saved === true,
     '접으면 잎이 화면에서 빠지고 그 상태가 저장에 남는다', JSON.stringify(fold));

  console.log('\n── 루틴 ──');
  const rt1 = JSON.parse(await ev(`(() => {
    __t.reset();
    const today = bizKey(), dow = dowOf(today);
    addRoutine('아침 스트레칭', 's', [dow]);              // 오늘 요일만
    addRoutine('주간 보고', 'm', [(dow + 3) % 7]);         // 오늘이 아닌 요일
    const n1 = runRoutines();
    const n2 = runRoutines();                             // 두 번 불러도
    const rows = __t.rows();
    return JSON.stringify({ n1, n2, rows, dow });
  })()`));
  ok(rt1.n1 === 1 && rt1.rows.length === 1 && rt1.rows[0].x === '아침 스트레칭',
     '오늘 요일인 루틴만 올라온다', JSON.stringify(rt1.rows.map(r => r.x)));
  ok(rt1.n2 === 0, '하루에 한 번만 올라온다 (두 번 불러도 한 줄)');
  ok(rt1.rows[0].rt && rt1.rows[0].al === false,
     '루틴이 놓은 줄이라고 표시되고 기한은 안 걸려 있다', JSON.stringify(rt1.rows[0]));

  /* 기한이 없으니 다음 날로 넘어가도 안 샌다 — 매일 아침 벌점을 예약해 두지 않는다 */
  const leak = JSON.parse(await ev(`(() => {
    S.todos.forEach(t => { t.due = addDays(bizKey(), -1); });
    S.dueDay = null; S.penalty = 0;
    const r = settleDue();
    return JSON.stringify({ pen:S.penalty, leaked: r.leaked ? r.leaked.count : 0, still: openTodos().length });
  })()`));
  ok(leak.pen === 0 && leak.leaked === 0 && leak.still === 1,
     '어제 몫을 안 했어도 루틴은 안 샌다 (목록에는 남는다)', JSON.stringify(leak));

  const back = JSON.parse(await ev(`(() => {
    __t.reset();
    const dow = dowOf(bizKey());
    const r = addRoutine('물 주기', 's', DOW_ALL);
    r.last = addDays(bizKey(), -3);                       // 사흘 전에 마지막으로 찍었다
    const n = runRoutines();
    return JSON.stringify({ n, rows: __t.rows().map(x => x.due), today: bizKey() });
  })()`));
  ok(back.n === 1 && back.rows.length === 1 && back.rows[0] === back.today,
     '사흘 만에 켜도 오늘 것만 올라온다 (소급 없음)', JSON.stringify(back.rows));

  const gone = JSON.parse(await ev(`(() => {
    const r = S.routines[0];
    delRoutine(r.id);
    return JSON.stringify({ rs: S.routines.length, rows: __t.rows().length });
  })()`));
  ok(gone.rs === 0 && gone.rows === 1, '루틴을 지워도 이미 올라온 줄은 남는다');

  const hand = JSON.parse(await ev(`(() => {
    const t = S.todos[0];
    const okSet = setDue(t.id, null, true);
    return JSON.stringify({ okSet, al: S.todos[0].alarm });
  })()`));
  ok(hand.okSet === true && hand.al === true,
     '루틴이 놓은 줄에도 손으로 ⏰ 를 걸 수 있다 (그건 그날의 내가 정한 것)');

  console.log('\n── 화면에서 손으로 ──');
  /* 자료층만 재면 화면이 그 문을 안 열어 뒀는지 모른다. 실제로 눌러서 만든다. */
  const uiSub = JSON.parse(await ev(`(() => {
    __t.reset();
    __t.put('대청소', { size:'l' });
    renderTodos();
    document.querySelector('#todoList [data-act="sub"]').click();
    const box = document.querySelector('#subBody');
    const inp = box.querySelector('#subInput');
    inp.value = '화장실 청소';
    box.querySelector('#subAdd').click();
    const rows = __t.rows();
    const list = box.querySelectorAll('.calrow').length;
    document.querySelectorAll('.veil').forEach(v => v.remove());
    renderTodos();
    return JSON.stringify({ rows, list, dom: __t.dom().rows.length });
  })()`));
  ok(uiSub.rows.length === 2 && uiSub.rows[1].p && uiSub.list === 1,
     '결재함의 ＋ 를 눌러 세부 업무를 적을 수 있다', JSON.stringify(uiSub.rows.map(r => r.x)));
  ok(uiSub.dom === 2, '적은 줄이 결재함에 잎으로 붙는다');

  const uiRt = JSON.parse(await ev(`(() => {
    __t.reset();
    showCalendar();
    const body = document.querySelector('#calBody');
    /* 루틴 칸은 접혀 있는 게 기본이다 — 달력의 본업은 날짜다. 펼쳐서 본다. */
    const folded = !body.querySelector('#rtInput');
    body.querySelector('#rtFold').click();
    const had = folded && !!body.querySelector('#rtInput');
    body.querySelector('#rtInput').value = '이메일 확인';
    /* 요일 칩을 하나 껐다가 「평일」로 되돌린다 — 칩이 곧 자료 구조인지 본다 */
    body.querySelector('[data-dow="3"]').click();
    const off = (calDows || DOW_ALL).length;
    body.querySelector('[data-preset="week"]').click();
    const wk = (calDows || []).join(',');
    body.querySelector('#rtInput').value = '이메일 확인';
    body.querySelector('#rtAdd').click();
    const r = (S.routines || [])[0];
    const shown = document.querySelector('#calBody').textContent.includes('이메일 확인');
    document.querySelectorAll('.veil').forEach(v => v.remove());
    return JSON.stringify({ had, off, wk, r, shown, todos: __t.rows().map(x => x.x) });
  })()`));
  ok(uiRt.had === true, '달력의 루틴 칸은 접혀 있고, 눌러야 펼쳐진다');
  ok(uiRt.off === 6 && uiRt.wk === '1,2,3,4,5', '요일 칩이 곧 자료 구조다 (매일→6개→평일)', uiRt.wk);
  ok(uiRt.r && uiRt.r.text === '이메일 확인' && uiRt.r.dows.join(',') === '1,2,3,4,5',
     '달력에서 루틴을 만들 수 있다', JSON.stringify(uiRt.r && uiRt.r.dows));
  ok(uiRt.shown === true, '만든 루틴이 그 자리에 바로 보인다');

  console.log('\n오류: ' + (errs.length ? errs.slice(0, 4).join(' | ') : '없음'));
  if (errs.length) fail++;
  console.log(fail ? `\n${fail}건 실패` : '\n전부 통과');
  ws.close(); chrome.kill(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
