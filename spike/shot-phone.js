/* 폰 화면 전수 촬영.  node spike/serve.js 먼저.
   node spike/shot-phone.js [접두사]

   검토용이라 **실제로 만질 화면 전부**를 찍는다 — 탭마다 한 장, ⋯ 팝오버, 모달 둘.
   투두는 비어 있으면 아무것도 안 보이므로 몇 건 넣고 하나는 이월시킨다:
   체크 칸과 삭제 칸이 손가락에 맞는지가 이 검토의 핵심이다. */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9590;
const TAG = process.argv[2] || 'ph';
const OUT = path.resolve(__dirname, 'ui') + path.sep;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const W = 390, H = 844;

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-ph-' + process.pid);
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page; for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl); let id = 0; const pend = new Map();
  const errs = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errs.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;
  const shot = async name => {
    await ev(`(() => { if (typeof R3 !== 'undefined' && R3.ready) R3.draw(); })()`);
    const s = await send('Page.captureScreenshot', { format:'png', clip:{ x:0, y:0, width:W, height:H, scale:1 } });
    fs.writeFileSync(OUT + TAG + '-' + name + '.png', Buffer.from(s.data, 'base64'));
    console.log('  →', TAG + '-' + name + '.png');
  };

  await send('Emulation.setDeviceMetricsOverride', { width:W, height:H, deviceScaleFactor:2, mobile:true });
  await send('Page.navigate', { url:'http://localhost:8123/index.html?3d=1' });
  await sleep(12000);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1200);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1200);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2400);
  await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
  await sleep(900);

  /* 회사를 키우고 투두를 채운다 — 빈 목록으로는 손가락 치수를 못 잰다 */
  await ev(`(() => {
    S.tier = 3; S.anchovy = 9999;
    while (S.cats.length < 5 && deskCount() > S.cats.length){
      const c = newCat('냥' + S.cats.length); c.rec = newRecord(1); S.cats.push(c); }
    assignDesks(); renderTiles();
    addTodo('사규 개정안 검토', 'm');
    addTodo('달 지사 임대 계약서', 'l');
    addTodo('간식 주문', 's');
    /* 하나는 이월시켜서 ⚠ 줄과 탭의 붉은 점을 같이 본다 */
    if (S.todos[0]) S.todos[0].q = (S.quarter || 1) - 1;
    renderTodos(); renderTop();
  })()`);
  await sleep(2500);

  console.log('폰 ' + W + '×' + H);
  const tabs = await ev(`JSON.stringify([...document.querySelectorAll('#colTabs button')]
    .filter(b => b.offsetWidth).map(b => b.dataset.col))`);
  console.log('보이는 탭: ' + tabs);

  for (const col of JSON.parse(tabs)){
    await ev(`document.querySelector('#colTabs [data-col="${col}"]').click()`);
    await sleep(col === 'stage' ? 2600 : 900);
    await shot(col);
  }

  /* ⋯ 팝오버 */
  await ev(`(() => { const b = document.querySelector('#btnMore'); if (b) b.click(); })()`);
  await sleep(500);
  await shot('more');
  await ev(`(() => { document.querySelector('#tools').classList.remove('open'); })()`);

  /* 모달 둘 — 폰에서 실제로 열게 되는 것 */
  await ev(`$('#btnSettings').click()`);
  await sleep(800); await shot('settings');
  await ev(`document.querySelector('.veil [data-close]').click()`);
  await sleep(400);
  await ev(`$('#btnCard').click()`);
  await sleep(800); await shot('card');
  await ev(`(() => { const c = document.querySelector('.veil [data-close]'); if (c) c.click(); })()`);
  await sleep(400);

  /* 손가락 치수 — 실제로 눌러야 하는 것들의 픽셀 크기 */
  await ev(`document.querySelector('#colTabs [data-col="inbox"]').click()`);
  await sleep(700);
  console.log('\n손가락 치수 (44px 이 애플 권고, 48dp 가 안드로이드 권고)');
  console.log(await ev(`(() => {
    const R = s => { const e = document.querySelector(s); if (!e) return '없음';
      const b = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return Math.round(b.width) + '×' + Math.round(b.height)
        + (cs.opacity !== '1' ? ' (opacity ' + cs.opacity + ')' : '')
        + (cs.display === 'none' ? ' (숨음)' : ''); };
    return JSON.stringify({
      '체크 칸': R('#todoList .todo .chk'),
      '삭제 칸': R('#todoList .todo .del'),
      '입력 칸': R('#todoInput'),
      '크기 버튼': R('.sizes .size'),
      '상신 버튼': R('#btnAdd'),
      '탭 하나': R('#colTabs [data-col="inbox"]'),
      '⋯': R('#btnMore'),
      '툴바 아이콘': R('#tools .iconbtn'),
    }, null, 1);
  })()`));

  console.log('\n오류: ' + (errs.length ? errs.slice(0, 5).join(' | ') : '없음'));
  ws.close(); chrome.kill(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
