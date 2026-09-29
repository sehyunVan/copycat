/* 게시판이 **없는 지점 넷을 잠깐 보여 주던 것.**  node spike/serve.js 먼저.

   제보(2026-09-21): 게시판을 누르면 보리·흑임자·감자·만두가 떴다가 사라진다.
   흉내 자료(js/friends.js MOCK)는 **서버가 없는 판**을 위한 것이었는데, 화면이
   「아직 대답을 못 받았다」와 「서버가 없다」를 같은 것으로 읽어서 서버가 올 판에서도
   흉내를 먼저 그렸다. 그리고 sync 가 돌아오는 순간 지웠다 — 잠깐 떴다 사라지는
   사람 넷은 구경거리가 아니라 고장이다.

   서버를 진짜로 세우지 않고 본다. 필요한 것은 통신이 아니라 **갈림길**이고, 그건
   CLOUD.state() 한 줄로 갈린다 — 그래서 그 줄만 바꿔 끼우고 세 판을 다 본다:

     1  서버가 올 판(state.on) — **흉내 지점이 한 칸도 안 뜬다.** 「불러오는 중」이다
     2  몇 번 두드려도 못 받으면 — 「못 받아 왔습니다」로 바뀐다 (영영 도는 물레가 아니다)
     3  부팅 중(why 'init') 에도 흉내를 안 보여준다 — 로그인은 게임보다 늦게 붙는다
     4  **서버가 없는 판에서는 흉내가 그대로 나온다** — 미리보기 띠까지 (이건 안 고쳤다)
     5  콘솔 오류 없음
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const TAG = process.pid + '-' + Math.floor(Math.random() * 1e6);
const PORT = 9700 + Math.floor(Math.random() * 200);
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
if (!CHROME) throw new Error('크롬을 못 찾았다');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let bad = 0;
const ok = (t, pass, note) => { if (!pass) bad++;
  console.log(`${pass ? '✅' : '❌'} ${t}${note ? '   ' + note : ''}`); };

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-bwait-' + TAG);
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
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;

  /* 서버로 나가는 길을 막는다 — 이 검사가 재는 것은 **화면의 갈림길**이고,
     진짜 계정을 만들면 그 판은 남의 서버에 줄을 하나 남긴다. */
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*supabase*', '*jsdelivr*'] });
  await send('Emulation.setDeviceMetricsOverride', { width:390, height:844, deviceScaleFactor:2, mobile:true });
  await send('Page.addScriptToEvaluateOnNewDocument', { source:'try { localStorage.clear(); } catch(e){}' });
  await send('Page.navigate', { url: BASE + '/index.html' });
  await sleep(11000);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1200);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1200);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2400);
  await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
    const t=document.querySelector('#cctitle'); if (t) t.remove();
    document.body.classList.remove('titleon');
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
  await sleep(1500);

  /* 계정층을 바꿔 끼운다. **한 줄이다** — 게시판이 보는 것이 이것뿐이라는 게
     이 고침의 요점이기도 하다(js/friends.js coming). */
  const asCloud = (on, why) => ev(`(() => {
    window.CLOUD = window.CLOUD || {};
    CLOUD.state = () => ({ on:${on}, why:${JSON.stringify(why || '')} });
    CLOUD.sb = () => null;                 // 손잡이는 없다 — sync 는 곧장 false 다
    return FRIENDS.source();
  })()`);
  /* 지금 게시판에 뭐가 떠 있나. 흉내 이름은 **글자로** 찾는다 — 화면에 그 이름이
     보이는지가 제보의 내용이고, 칸 수만 세면 「비었는데 글자는 남았다」를 놓친다. */
  const onScreen = () => ev(`(() => {
    const b = document.querySelector('#boardBody');
    if (!b) return JSON.stringify({ open:false });
    const tx = b.textContent || '';
    return JSON.stringify({ open:true, rows:b.querySelectorAll('.pola').length,
      mock:['보리','흑임자','감자','만두'].filter(n => tx.includes(n)),
      pre: !!b.querySelector('.prebadge'),
      load: tx.includes('불러오는 중'), fail: tx.includes('못 받아'),
      link: !!b.querySelector('#brAdd'),
      later: tx.includes('서버가 온 뒤') });
  })()`);
  const shut = () => ev(`document.querySelectorAll('.veil').forEach(v => v.remove())`);

  console.log('── 1. 서버가 올 판 ──');
  console.log('   source = ' + await asCloud(true, ''));
  await ev(`showBoard()`);
  /* 제보는 「잠깐 보였다 사라진다」였다. 그러니 **여는 순간부터 촘촘히** 본다 —
     1초 뒤에 한 번만 보면 깜빡임은 이미 지나가 있다. */
  const shots = [];
  for (let i = 0; i < 12; i++){ shots.push(JSON.parse(await onScreen())); await sleep(120); }
  const everMock = shots.filter(s => s.mock.length);
  ok('흉내 지점이 **한 순간도** 안 뜬다', everMock.length === 0,
     everMock.length ? `${everMock.length}/12 번 보였다: ${everMock[0].mock.join(',')}`
                     : `12번 들여다봄 · 칸 ${shots.map(s => s.rows).join('')}`);
  ok('대신 「불러오는 중」이라고 말한다', shots.some(s => s.load), JSON.stringify(shots[0]));
  ok('「서버가 온 뒤입니다」는 안 적는다 (곧 묶기 칸이 뜰 판이다)',
     shots.every(s => !s.later));
  ok('미리보기 띠도 없다', shots.every(s => !s.pre));

  console.log('\n── 2. 여섯 번 두드려도 못 받으면 ──');
  await sleep(9000);                       // 1.2초 × 6번 + 여유
  const late = JSON.parse(await onScreen());
  ok('「못 받아 왔습니다」로 바뀐다 — 영영 도는 물레가 아니다', late.fail && !late.load,
     JSON.stringify(late));
  ok('그래도 흉내는 안 나온다', late.mock.length === 0 && late.rows === 0);
  await shut();

  console.log('\n── 3. 아직 부팅 중일 때 (로그인이 게임보다 늦게 붙는다) ──');
  console.log('   source = ' + await asCloud(false, 'init'));
  await ev(`showBoard()`);
  await sleep(600);
  const boot = JSON.parse(await onScreen());
  ok('부팅 중에도 흉내를 안 보여준다', boot.mock.length === 0 && boot.load,
     JSON.stringify(boot));
  await shut();

  console.log('\n── 4. 서버가 없는 판 (file:// · 설정 없음) ──');
  console.log('   source = ' + await asCloud(false, 'file:// — 출처가 없어 로그인이 안 된다'));
  await ev(`showBoard()`);
  await sleep(1200);
  const mock = JSON.parse(await onScreen());
  ok('여기서는 흉내 지점 넷이 그대로 나온다', mock.rows === 4 && mock.mock.length === 4,
     JSON.stringify({ rows:mock.rows, mock:mock.mock }));
  ok('미리보기 띠와 「서버가 온 뒤입니다」도 그대로다', mock.pre && mock.later);
  await shut();

  ok('콘솔 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | ') || '0');
  console.log('\n' + (bad ? `${bad}건 실패` : '전부 통과'));
  ws.close(); chrome.kill();
  process.exit(bad ? 1 : 0);
})();
