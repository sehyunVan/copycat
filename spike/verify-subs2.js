/* 29번 세부 업무 — 2026-08-26 에 고친 둘.

     3. 잎을 지웠는데 부모가 **닫을 방법 없는 줄**로 남던 것
        (끝난 잎 하나 + 열린 잎 하나에서 열린 쪽을 지우면, 부모는 잎이 남아 있으니
         계속 묶음이고 열린 잎이 없으니 completeTodo 도 안 받았다)
     4. 부모를 체크하면 **밑의 줄이 한 번에** 끝나는 것 (반대 방향은 원래 됐다)

   판정은 상태와 화면에서 읽는다. node spike/serve.js 를 먼저 띄운다. */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9613;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (n, good, d) => { (good ? pass++ : fail++); console.log(`  ${good ? '✅' : '❌'} ${n}${d === undefined ? '' : '   ' + d}`); };

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-subs2');
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
  ws.addEventListener('message', e => { const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errs.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' ')); });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;
  await send('Emulation.setDeviceMetricsOverride', { width:1400, height:900, deviceScaleFactor:1, mobile:false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try { localStorage.clear(); } catch(e){}' });
  await send('Page.navigate', { url: BASE + '/index.html?3d=1&debug=1' });
  for (let i = 0; i < 200; i++){ if (await ev(`document.body.classList.contains('r3ready')`)) break; await sleep(200); }
  await sleep(1500);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1100);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1100);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2200);
  await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click(); })()`);
  await sleep(900);
  await ev(`(() => { document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); S.todos = []; renderTodos(); return 1; })()`);

  console.log('\n── 3. 잎을 지우면 부모가 갇히지 않는가 ──');
  const a = JSON.parse(await ev(`(() => {
    S.todos = [];
    const p = addTodo('대청소', 'l');
    const k1 = addTodo('빨래하기', 's', { parent: p.id });
    const k2 = addTodo('거실 물청소', 's', { parent: p.id });
    completeTodo(k1.id);                       // 잎 하나는 끝내고
    delTodo(k2.id);                            // 남은 열린 잎을 지운다
    renderTodos();
    const pp = S.todos.find(t => t.id === p.id);
    const row = document.querySelector('.todo[data-id="' + p.id + '"]');
    return JSON.stringify({
      부모있나: !!pp, 부모끝남: !!(pp && pp.done),
      잎수: S.todos.filter(t => t.parent === p.id).length,
      화면: row ? { 묶음: row.classList.contains('group'), 끝남: row.classList.contains('done'),
                    체크칸: !!row.querySelector('.chk') } : null });
  })()`));
  console.log('   ' + JSON.stringify(a));
  ok('마지막 열린 잎을 지우면 부모가 닫힌다', a.부모있나 && a.부모끝남 === true);
  ok('끝난 잎은 남아 있다 (지운 건 지운 것만)', a.잎수 === 1);

  /* 잎이 하나도 안 남으면 **보통 업무로 돌아간다** — 닫지 않는다 */
  const b = JSON.parse(await ev(`(() => {
    S.todos = [];
    const p = addTodo('대청소', 'l');
    const k = addTodo('빨래하기', 's', { parent: p.id });
    delTodo(k.id);                             // 하나뿐인 잎을 지운다
    renderTodos();
    const pp = S.todos.find(t => t.id === p.id);
    const row = document.querySelector('.todo[data-id="' + p.id + '"]');
    return JSON.stringify({ 끝남: !!(pp && pp.done),
      체크칸: !!(row && row.querySelector('.chk')),
      묶음: !!(row && row.classList.contains('group')),
      눌러서끝남: (completeTodo(p.id), !!S.todos.find(t => t.id === p.id).done) });
  })()`));
  console.log('   ' + JSON.stringify(b));
  ok('잎이 하나도 없으면 부모는 안 닫힌다 (보통 업무로 돌아간다)', b.끝남 === false);
  ok('그리고 체크 칸이 돌아온다', b.체크칸 === true && b.묶음 === false);
  ok('눌러서 끝낼 수 있다', b.눌러서끝남 === true);

  console.log('\n── 4. 부모를 체크하면 잎이 한 번에 ──');
  const c = JSON.parse(await ev(`(() => {
    S.todos = []; DOCS.length = 0;
    const p = addTodo('대청소', 'l');
    const k1 = addTodo('빨래하기', 's', { parent: p.id });
    const k2 = addTodo('거실 물청소', 's', { parent: p.id });
    const k3 = addTodo('화장실 청소', 's', { parent: p.id });
    renderTodos();
    const row = document.querySelector('.todo[data-id="' + p.id + '"]');
    const chk = row && row.querySelector('.chk');
    const before = DOCS.length;
    if (chk) chk.click();
    const all = [k1, k2, k3].map(k => S.todos.find(t => t.id === k.id));
    return JSON.stringify({
      부모에체크칸: !!chk,
      접기도있나: !!(row && row.querySelector('.foldi')),
      잎다끝남: all.every(k => k && k.done),
      부모끝남: !!S.todos.find(t => t.id === p.id).done,
      서류: DOCS.length - before });
  })()`));
  console.log('   ' + JSON.stringify(c));
  ok('부모 줄에 체크 칸이 있다', c.부모에체크칸 === true);
  ok('접기 손잡이도 그대로 있다', c.접기도있나 === true);
  ok('부모를 누르면 잎이 전부 끝난다', c.잎다끝남 === true);
  ok('그리고 부모도 닫힌다', c.부모끝남 === true);
  ok('서류는 **잎 수만큼** 나간다 (부모 몫은 없다)', c.서류 === 3, c.서류 + '건');

  /* 반대 방향 — 잎을 다 끝내면 부모가 닫힌다(원래 되던 것. 회귀만 본다) */
  const d = JSON.parse(await ev(`(() => {
    S.todos = [];
    const p = addTodo('대청소', 'l');
    const ks = ['a','b'].map(n => addTodo(n, 's', { parent: p.id }));
    ks.forEach(k => completeTodo(k.id));
    return JSON.stringify({ 부모끝남: !!S.todos.find(t => t.id === p.id).done });
  })()`));
  ok('잎을 다 끝내도 부모가 닫힌다 (회귀)', d.부모끝남 === true);

  /* 끝난 잎도 지울 수 있어야 한다 — 없으면 묶음에 영영 남는다.
     **부모가 열려 있는 동안**이 이 경로가 닿는 유일한 때다: 잎이 다 끝나면 부모가
     닫히고, 닫힌 부모는 showSubs 가 안 연다(그때는 부모 줄의 ✕ 가 통째로 지운다). */
  const e2 = JSON.parse(await ev(`(() => {
    S.todos = [];
    const p = addTodo('대청소', 'l');
    const k = addTodo('빨래하기', 's', { parent: p.id });
    addTodo('거실 물청소', 's', { parent: p.id });     // 열린 잎 하나를 남겨 둔다
    completeTodo(k.id);
    showSubs(p.id);
    const body = document.querySelector('#subBody');
    /* 끝난 잎의 ✕ 를 집는다 — 첫 줄이 그 잎이다 */
    const rows = body ? [...body.querySelectorAll('.calrow')] : [];
    const doneRow = rows.find(r => r.classList.contains('done'));
    const del = doneRow && doneRow.querySelector('[data-del]');
    const had = !!del;
    if (del) del.click();
    const left = S.todos.filter(t => t.parent === p.id).length;
    document.querySelectorAll('.veil').forEach(v => v.remove());
    return JSON.stringify({ 지우기버튼: had, 남은잎: left });
  })()`));
  console.log('   ' + JSON.stringify(e2));
  ok('끝난 잎에도 ✕ 가 있다', e2.지우기버튼 === true);
  ok('눌러서 지워진다 (열린 잎은 그대로)', e2.남은잎 === 1);

  const bad = errs.filter(x => !/favicon|Failed to load resource/i.test(x));
  ok('콘솔 오류 0', bad.length === 0, bad.slice(0,2).join(' | '));
  console.log(`\n${pass} 통과 · ${fail} 실패`);
  ws.close(); chrome.kill();
  process.exit(fail ? 1 : 0);
})();
