/* 결재함 입력 — 조합 중의 엔터.  node spike/serve.js 먼저.

   신고: "결재함에 업무 작성시 마지막 단어가 잘려서 업무로 하나 더 올라감."
   원인은 keydown 에서 곧바로 올린 것이었다. 조합 중에 누른 엔터는 "보내기"가 아니라
   "이 글자로 확정"이고, 그때 input.value 에 마지막 음절이 들어와 있는지는 브라우저와
   입력기마다 다르다. 안 들어와 있으면 앞부분만 올라가고 확정된 꼬리가 칸에 남는다.

   재는 것: **엔터 한 번 = 한 줄, 글자는 온전하게, 칸은 비어 있게.**

   기계마다 순서가 다르므로 네 가지로 돌린다.
     · compositionend → keyup   (크롬/윈도)
     · keyup → compositionend   (안드로이드 입력기)
     · keydown 이 아예 안 온다   (입력기가 엔터를 먹고 확정만 시킨다 — 실측된 경로)
     · 조합 중에 「결재 상신」 버튼
   그리고 **일본어는 규칙이 다르다**(조합 중 엔터 = 변환 확정). ja 로 다시 띄워서
   그 엔터가 서류를 올리지 않는지, 다음 엔터가 올리는지 따로 본다.
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9647;
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

  /* ---------- 입력기 흉내 ----------
     조합 중인 음절은 value 에 **아직 없다**(신고된 기계가 그랬다). 확정은 compositionend
     에서 들어온다. 그 둘 사이에 엔터가 온다.

     버튼 경로는 el.blur 를 감싼다. 헤드리스 크롬은 문서에 포커스가 없으면 blur 이벤트를
     아예 안 던지는데(실측), 브라우저가 blur 에서 조합을 확정한다는 사실 자체는 그대로다 —
     이벤트가 아니라 **그 동작**을 흉내 내야 버튼 경로가 진짜로 재진다. */
  const inject = () => ev(`window.__ime = (base, tail, order) => {
    const el = document.querySelector('#todoInput');
    el.focus();
    el.value = '';
    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles:true }));
    el.value = base;
    el.dispatchEvent(new InputEvent('input', { bubbles:true, isComposing:true }));
    el.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles:true, data:tail }));
    const down = () => el.dispatchEvent(new KeyboardEvent('keydown',
      { key:'Enter', keyCode:13, isComposing:true, bubbles:true }));
    const up = () => el.dispatchEvent(new KeyboardEvent('keyup',
      { key:'Enter', keyCode:13, isComposing:false, bubbles:true }));
    const end = () => {
      el.value = base + tail;
      el.dispatchEvent(new CompositionEvent('compositionend', { bubbles:true, data:tail }));
      el.dispatchEvent(new InputEvent('input', { bubbles:true }));
    };
    if (order === 'button'){
      const real = el.blur.bind(el);
      el.blur = () => { real(); end(); };
      document.querySelector('#btnAdd').click();
      el.blur = real;
      return;
    }
    if (order === 'no-keydown'){ end(); up(); return; }   // 입력기가 엔터를 먹었다
    down();
    if (order === 'end-first'){ end(); up(); } else { up(); end(); }
  };
  window.__plain = (text, hold) => {
    const el = document.querySelector('#todoInput');
    el.focus(); el.value = text;
    el.dispatchEvent(new InputEvent('input', { bubbles:true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', keyCode:13, bubbles:true }));
    if (hold) for (let i=0;i<3;i++) el.dispatchEvent(new KeyboardEvent('keydown',
      { key:'Enter', keyCode:13, repeat:true, bubbles:true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key:'Enter', keyCode:13, bubbles:true }));
  };
  window.__enter = () => {
    const el = document.querySelector('#todoInput');
    el.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', keyCode:13, bubbles:true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key:'Enter', keyCode:13, bubbles:true }));
  };
  window.__clear = () => { S.todos.length = 0; save(); renderTodos();
    const el = document.querySelector('#todoInput'); el.value = ''; };
  window.__read = () => JSON.stringify({ 줄: S.todos.map(t => t.text),
    남은글자: document.querySelector('#todoInput').value, 언어: LANG });`);

  /* 프롤로그와 첫 출근 안내를 지나간다 — 안내가 떠 있으면 입력칸이 가려진다 */
  const boot = async () => {
    await sleep(11000);
    await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
    await sleep(1200);
    await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
    await sleep(1200);
    await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
    await sleep(2400);
    await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
      document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
    await sleep(1200);
    await inject();
  };

  const read = async () => JSON.parse(await ev(`__read()`));
  const run = async (label, expr, want) => {
    await ev(`__clear()`);
    await ev(expr);
    await sleep(500);
    const r = await read();
    ok(r.줄.length === 1 && r.줄[0] === want && r.남은글자 === '', label, JSON.stringify(r));
    return r;
  };

  await send('Emulation.setDeviceMetricsOverride', { width:1400, height:900, deviceScaleFactor:1, mobile:false });
  await send('Page.navigate', { url: BASE + '/index.html' });
  await boot();

  console.log('── 한국어 (조합 중 엔터 = 그 한 번으로 올린다) ──');
  await run('평범한 엔터', `__plain('기획서 초안')`, '기획서 초안');
  await run('엔터를 꾹 눌러도 한 줄', `__plain('회의록 정리', true)`, '회의록 정리');
  await run('조합 중 엔터 · compositionend 먼저 (크롬/윈도)',
            `__ime('대청소 빨래하', '기', 'end-first')`, '대청소 빨래하기');
  await run('조합 중 엔터 · keyup 먼저 (안드로이드 입력기)',
            `__ime('대청소 빨래하', '기', 'up-first')`, '대청소 빨래하기');
  await run('입력기가 keydown 을 먹은 경우',
            `__ime('거실 물청소하', '기', 'no-keydown')`, '거실 물청소하기');
  await run('조합 중 「결재 상신」 버튼',
            `__ime('화장실 청소하', '기', 'button')`, '화장실 청소하기');

  /* 빈 칸 엔터는 아무 것도 올리지 않는다 — 첫 출근 안내가 이걸로 다음 단계를 판단한다 */
  await ev(`__clear()`);
  await ev(`__plain('')`);
  await sleep(400);
  let r = await read();
  ok(r.줄.length === 0, '빈 칸 엔터는 안 올라간다', JSON.stringify(r));

  /* ---------- 진짜 IME ----------
     CDP 가 렌더러에 실제 조합 상태를 만든다. 합성 이벤트로는 못 보는 것이 여기서 보인다 —
     **크롬은 조합 중인 음절을 이미 value 에 넣어 둔다.** 그래서 옛 코드(keydown 에서 바로
     올리기)는 여기서 「대청소 빨래하기」를 올리고 칸을 비웠고, 그 순간 살아 있던 조합이
     빈 칸에 「기」를 다시 찍었다 — 신고된 "업무가 하나 더" 가 이 자리다.

     실측된 이벤트 순서(조합이 열려 있는 동안 엔터):
       keydown Enter isComposing=true → keyup Enter isComposing=true, compositionend 없음
     즉 그 엔터로는 **아무 것도 확정되지 않는다.** 확정은 그 다음에 온다. */
  console.log('');
  console.log('── 진짜 IME (Input.imeSetComposition) ──');
  await ev(`__clear()`);
  const box = JSON.parse(await ev(`(() => { const el = document.querySelector('#todoInput');
    el.scrollIntoView({ block:'center' }); const b = el.getBoundingClientRect();
    return JSON.stringify({ x:Math.round(b.x + b.width/2), y:Math.round(b.y + b.height/2) }); })()`));
  const enter = async () => {
    await send('Input.dispatchKeyEvent', { type:'keyDown', key:'Enter', code:'Enter',
      windowsVirtualKeyCode:13, nativeVirtualKeyCode:13 });
    await send('Input.dispatchKeyEvent', { type:'keyUp', key:'Enter', code:'Enter',
      windowsVirtualKeyCode:13, nativeVirtualKeyCode:13 });
  };
  await send('Input.dispatchMouseEvent', { type:'mousePressed', x:box.x, y:box.y, button:'left', clickCount:1 });
  await send('Input.dispatchMouseEvent', { type:'mouseReleased', x:box.x, y:box.y, button:'left', clickCount:1 });
  await sleep(300);
  await send('Input.insertText', { text:'대청소 빨래하' });
  await sleep(200);
  await send('Input.imeSetComposition', { text:'기', selectionStart:1, selectionEnd:1 });
  await sleep(300);
  await enter();
  await sleep(700);
  r = await read();
  ok(r.줄.length === 0 && r.남은글자 === '대청소 빨래하기',
     '조합이 열려 있는 동안은 안 올리고 글자도 안 잃는다', JSON.stringify(r));

  /* 확정(입력기가 글자를 넣는다) → 그 다음 엔터가 올린다 */
  await send('Input.insertText', { text:'기' });
  await sleep(300);
  await enter();
  await sleep(700);
  r = await read();
  ok(r.줄.length === 1 && r.줄[0] === '대청소 빨래하기' && r.남은글자 === '',
     '확정된 뒤의 엔터: 한 줄, 글자 온전', JSON.stringify(r));

  /* ---------- 일본어 ----------
     조합 중의 엔터는 **변환 확정**이다. 그걸로 올리면 한자를 고르는 순간 서류가 올라간다. */
  console.log('\n── 日本語 (조합 중 엔터 = 변환 확정, 올리지 않는다) ──');
  await ev(`localStorage.setItem('copycat.lang','ja')`);
  await send('Page.navigate', { url: BASE + '/index.html' });
  await boot();
  r = await read();
  ok(r.언어 === 'ja', '언어가 ja 로 떴다', JSON.stringify({ 언어: r.언어 }));

  await ev(`__clear()`);
  await ev(`__ime('そうじ せんたく', 'する', 'end-first')`);
  await sleep(500);
  r = await read();
  ok(r.줄.length === 0 && r.남은글자 === 'そうじ せんたくする',
     '변환 확정 엔터로는 안 올라간다 (칸에 그대로 남는다)', JSON.stringify(r));

  /* 확정된 뒤의 다음 엔터가 올린다 — 그게 그 입력기의 규약이다 */
  await ev(`__enter()`);
  await sleep(500);
  r = await read();
  ok(r.줄.length === 1 && r.줄[0] === 'そうじ せんたくする' && r.남은글자 === '',
     '그 다음 엔터가 올린다', JSON.stringify(r));

  console.log('\n오류: ' + (errs.length ? errs.slice(0, 3).join(' | ') : '없음'));
  if (errs.length) fail++;
  console.log(fail ? `\n${fail}건 실패` : '\n전부 통과');
  ws.close(); chrome.kill(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
