/* 첫 출근 안내의 **가구 클로즈업 넷**.  node spike/serve.js 먼저.

   프롤로그가 끝나면 사람은 결재함만 본다 — 벽에 걸린 달력과 게시판은 끝까지 그림으로
   남는다. 그래서 안내가 하나씩 클로즈업해 준다(💿 · 📅 · 📌 · 🛋️).

   재는 것:
     · 걸음이 아홉이고, 다섯 번째부터 여덟 번째가 가구다
     · 클로즈업이 **그 가구를 실제로 본다** (카메라 시선이 그 칸으로 간다)
     · 고리가 무대 안 그 자리에 놓인다 (투사한 좌표)
     · **진짜로 열어야** 다음으로 간다 (juke:open · cal:open · board:open · edit:on)
     · 안내가 끝나면 카메라가 **되돌아온다** (전체 보기 · 추적 다시 켜짐)
     · 마지막 경고가 **새 규칙**을 말한다 (분기가 아니라 ⏰ 기한)
     · 3D 가 없는 화면에서는 클로즈업을 건너뛰고 문구만 남는다
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9652;
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

  /* 카메라가 멎을 때까지 기다린다 — 활강 중에 재면 지나가는 좌표를 재게 된다 */
  /* 활강이 **끝났다고 안내가 말할 때까지** 기다린다. 좌표가 두 번 같은지로 재면
     프레임 사이에 우연히 같은 값이 두 번 나올 수 있고, 실제로 그렇게 지나가는 좌표를
     쟀다(측정이 틀렸던 것이고 카메라는 멀쩡했다). */
  const settle = async () => {
    for (let i = 0; i < 30; i++){
      const busy = await ev(`!!(typeof TUT !== 'undefined' && TUT && TUT.glide)`);
      if (!busy) break;
      await sleep(120);
    }
    await sleep(240);
  };

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
  await sleep(3000);

  /* 프롤로그 뒤에 안내가 저절로 뜬다(main.js). 뜬 걸 확인하고 걸음을 센다. */
  const start = JSON.parse(await ev(`(() => {
    const p = document.querySelector('.coach');
    return JSON.stringify({ 떴나:!!p, 걸음: p ? p.querySelector('.cstep').textContent : '',
      제목: p ? p.querySelector('b').textContent : '' });
  })()`));
  ok(start.떴나 && /1 \/ 9/.test(start.걸음), '첫 출근 안내가 아홉 걸음이다', start.걸음 + ' · ' + start.제목);

  /* 1·2 걸음은 실제로 올리고 체크해야 넘어간다 */
  await ev(`(() => { const i = document.querySelector('#todoInput'); i.value = '안내 시험';
    document.querySelector('#btnAdd').click(); })()`);
  await sleep(1200);
  await ev(`(() => { const b = document.querySelector('#todoList .todo [data-act="toggle"]'); if (b) b.click(); })()`);
  await sleep(1400);
  let step = await ev(`document.querySelector('.coach .cstep').textContent`);
  ok(/3 \/ 9/.test(step), '올리고 체크하면 세 걸음까지 온다', step);

  /* 3(시점)은 시간이 지나면 넘어가고, 4(도장)는 고양이가 도장을 찍으면 넘어간다.
     둘 다 기다리는 걸음이라 넉넉히 준다. */
  for (let i = 0; i < 30; i++){
    step = await ev(`document.querySelector('.coach') ? document.querySelector('.coach .cstep').textContent : ''`);
    if (/5 \/ 9/.test(step)) break;
    await sleep(1000);
  }
  ok(/5 \/ 9/.test(step), '도장이 찍히면 다섯 걸음 — 가구 안내가 시작된다', step);

  console.log('\n── 💿 CD 플레이어 ──');
  /* 클로즈업은 0.5초 동안 미끄러진다 — 멎은 뒤에 재야 한다 */
  await settle();
  const juke = JSON.parse(await ev(`(() => {
    const d = R3.debug(), cell = tutCell.juke();
    const sp = document.querySelector('.tutspot'), ring = document.querySelector('.coachring');
    const vp = document.querySelector('#viewport').getBoundingClientRect();
    const rb = ring.getBoundingClientRect();
    return JSON.stringify({ cell, look:d.look, zoom:d.cam.zoom, follow:d.follow,
      spot: sp && sp.style.display, 고리안: rb.left > vp.left && rb.right < vp.right && rb.top > vp.top && rb.bottom < vp.bottom,
      제목: document.querySelector('.coach b').textContent });
  })()`));
  ok(/CD/.test(juke.제목), '다섯 걸음은 CD 플레이어다', juke.제목);
  ok(juke.cell && Math.abs(juke.look[0] - (juke.cell.x + 0.5)) < 0.6
     && Math.abs(juke.look[2] - (juke.cell.y + 0.5)) < 0.6,
     '카메라가 그 가구를 본다', `칸 ${JSON.stringify(juke.cell)} · 시선 ${JSON.stringify(juke.look)}`);
  /* 추적(FOLLOW.zoom=0.30)보다 멀고 전체 보기(1.0)보다 가깝다 — 그 사이가 클로즈업이다.
     그리고 추적이 꺼져 있어야 카메라가 그 자리에 머문다. */
  ok(juke.zoom > 0.3 && juke.zoom < 0.8 && juke.follow === false,
     '클로즈업이다 (전체 보기보다 가깝고 추적은 꺼진다)', 'zoom ' + juke.zoom);
  ok(juke.spot === 'block' && juke.고리안 === true, '고리가 무대 안 그 자리에 있다');

  /* 진짜로 열어야 넘어간다 */
  await ev(`showJuke()`);
  await sleep(1200);
  await ev(`document.querySelectorAll('.veil').forEach(v => v.remove())`);
  await sleep(300);
  step = await ev(`document.querySelector('.coach .cstep').textContent`);
  ok(/6 \/ 9/.test(step), 'CD 플레이어를 열면 다음으로 간다', step);

  console.log('\n── 📅 달력 · 📌 게시판 ──');
  await settle();
  const cal = JSON.parse(await ev(`(() => {
    const d = R3.debug(), cell = tutCell.cal();
    return JSON.stringify({ cell, look:d.look, el:d.cam.el, 제목: document.querySelector('.coach b').textContent });
  })()`));
  ok(/달력|calendar|カレンダー/i.test(cal.제목), '여섯 걸음은 벽걸이 달력이다', cal.제목);
  ok(cal.cell && Math.abs(cal.look[0] - (cal.cell.x + 0.5)) < 0.6
     && Math.abs(cal.look[2] - (cal.cell.y + 0.5)) < 0.6 && cal.look[1] > 1,
     '카메라가 벽에 걸린 그 달력을 본다 (눈높이까지)', `시선 ${JSON.stringify(cal.look)}`);
  await ev(`showCalendar()`);
  await sleep(1200);
  await ev(`document.querySelectorAll('.veil').forEach(v => v.remove())`);
  await sleep(400);
  await settle();
  const board = JSON.parse(await ev(`(() => {
    const d = R3.debug(), cell = tutCell.board();
    return JSON.stringify({ step: document.querySelector('.coach .cstep').textContent,
      cell, look:d.look, 제목: document.querySelector('.coach b').textContent });
  })()`));
  ok(/7 \/ 9/.test(board.step) && /게시판|board|掲示板/i.test(board.제목),
     '달력을 열면 게시판으로 간다', board.step + ' · ' + board.제목);
  ok(board.cell && Math.abs(board.look[0] - (board.cell.x + 0.5)) < 0.6
     && Math.abs(board.look[2] - (board.cell.y + 0.5)) < 0.6,
     '카메라가 그 게시판을 본다', `시선 ${JSON.stringify(board.look)}`);

  await ev(`showBoard()`);
  await sleep(1400);
  await ev(`document.querySelectorAll('.veil').forEach(v => v.remove())`);
  await sleep(300);

  console.log('\n── 🛋️ 배치 모드 ──');
  const edit = JSON.parse(await ev(`(() => {
    const ring = document.querySelector('.coachring').getBoundingClientRect();
    const btn = document.querySelector('#btnEdit').getBoundingClientRect();
    return JSON.stringify({ step: document.querySelector('.coach .cstep').textContent,
      제목: document.querySelector('.coach b').textContent,
      고리가버튼에: Math.abs(ring.left - btn.left) < 12 && Math.abs(ring.top - btn.top) < 12,
      고리:[Math.round(ring.left),Math.round(ring.top),Math.round(ring.width),Math.round(ring.height)],
      버튼:[Math.round(btn.left),Math.round(btn.top),Math.round(btn.width),Math.round(btn.height)] });
  })()`));
  ok(/8 \/ 9/.test(edit.step), '게시판을 열면 배치 모드로 간다', edit.step + ' · ' + edit.제목);
  ok(edit.고리가버튼에 === true, '고리가 🛋️ 버튼에 걸린다 (들어가는 문이 거기다)',
     '고리 ' + JSON.stringify(edit.고리) + ' · 버튼 ' + JSON.stringify(edit.버튼));

  await ev(`toggleEdit(true)`);
  await sleep(1200);
  const last = JSON.parse(await ev(`(() => {
    const p = document.querySelector('.coach');
    return JSON.stringify({ step: p ? p.querySelector('.cstep').textContent : '',
      본문: p ? p.querySelector('p').textContent.replace(/\s+/g,' ') : '' });
  })()`));
  ok(/9 \/ 9/.test(last.step), '배치 모드에 들어가면 마지막 경고로 간다', last.step);
  ok(/기한|deadline|期限/.test(last.본문) && !/분기가 넘어갈/.test(last.본문),
     '마지막 경고가 새 규칙(⏰ 기한)을 말한다', last.본문.slice(0, 46));

  console.log('\n── 끝내고 나면 ──');
  await ev(`(() => { toggleEdit(false); document.querySelector('.coach [data-tut="next"]').click(); })()`);
  await sleep(1500);
  const after = JSON.parse(await ev(`(() => {
    const d = R3.debug();
    return JSON.stringify({ 판:!!document.querySelector('.coach'), 손잡이:!!document.querySelector('.tutspot'),
      follow:d.follow, zoom:d.cam.zoom, look:d.look, tutor:S.tutor });
  })()`));
  ok(after.판 === false && after.손잡이 === false, '안내가 끝나면 판과 손잡이가 사라진다');
  /* 추적이 다시 켜지는 것이 「돌아왔다」다 — 추적 중에는 줌이 FOLLOW.zoom 으로 고정되므로
     줌으로는 판정할 수 없다. 시선이 벽에 걸린 물건이 아니라 고양이 눈높이에 있는지 본다. */
  ok(after.follow === true && after.look[1] < 1.1,
     '카메라가 고양이 추적으로 돌아온다 (벽만 보이는 채로 안 남는다)',
     `follow ${after.follow} · 시선 ${JSON.stringify(after.look)}`);
  ok(after.tutor === 1, '한 번 봤다고 저장에 남는다');

  /* 예전에는 `?3d=0` 으로 껐다. 48번에서 도트판을 지우면서 그 손잡이도 같이 없앴다 —
     **떨어질 데가 없는 비상구는 비상구가 아니다.** 그래서 3D 가 없는 화면은 이제
     「끄는 것」이 아니라 「못 켜는 것」이고, 그걸 실제로 만드는 방법은 하나다:
     file:// 에서 열면 ES 모듈이 막혀 렌더러가 아예 안 온다(verify-fallback 과 같은 길). */
  console.log('\n── 3D 가 없는 화면 (file:// — 모듈이 막힌다) ──');
  await send('Page.navigate', { url: require('url').pathToFileURL(require('path').resolve(__dirname, '..', 'index.html')).href });
  await sleep(9000);
  await ev(`(() => { document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
  await ev(`(() => { S.tutor = 0; startTutor();
    for (let i = 0; i < 3; i++) tutorNext(); })()`);
  await sleep(600);          // 고리는 rAF 로 따라간다 — 한 프레임은 줘야 한다
  const flat = JSON.parse(await ev(`(() => {
    void 0;
    const p = document.querySelector('.coach');
    const vp = document.querySelector('#viewport').getBoundingClientRect();
    const rb = document.querySelector('.coachring').getBoundingClientRect();
    const out = { is3d: is3d(), step: p.querySelector('.cstep').textContent,
      제목: p.querySelector('b').textContent,
      손잡이: (document.querySelector('.tutspot') || {}).style ? document.querySelector('.tutspot').style.display : '없음',
      고리: [Math.round(rb.width), Math.round(rb.height)], 무대: [Math.round(vp.width), Math.round(vp.height)],
      무대전체: Math.abs(rb.width - (vp.width + 12)) < 6 };
    return JSON.stringify(out);
  })()`));
  ok(flat.is3d === false, '3D 가 꺼진 화면이다');
  ok(/CD/.test(flat.제목), '가구 안내는 그대로 나온다 (없는 것처럼 굴지 않는다)', flat.step + ' · ' + flat.제목);
  ok(flat.손잡이 !== 'block' && flat.무대전체 === true,
     '클로즈업은 건너뛰고 고리를 무대 전체에 두른다',
     JSON.stringify({ 손잡이:flat.손잡이, 고리:flat.고리, 무대:flat.무대 }));

  console.log('\n오류: ' + (errs.length ? errs.slice(0, 4).join(' | ') : '없음'));
  if (errs.length) fail++;
  console.log(fail ? `\n${fail}건 실패` : '\n전부 통과');
  ws.close(); chrome.kill(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
