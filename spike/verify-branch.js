/* 지점 등록(TODO 59) — 간판을 고르는 창과, 고른 것이 **다시 시작할 때** 첫 화면에 뜨나.
   node spike/serve.js 먼저.

     node spike/verify-branch.js          폰 390×844 (기본 — 주력이 폰이다)
     node spike/verify-branch.js pc       데스크톱 1400×880

   ── 왜 폰이 기본인가 ──
   이 게임의 배포 주력이 폰이고, 헤드리스에서 무대가 제대로 서는 쪽도 폰이다
   (#app 이 100dvh 인데 mobile:false 로 띄우면 그 값이 0 으로 풀린다 — verify-icons.js
   머리말에 적어 뒀다).

   재는 것 아홉:
     1  간판 목록이 실려 있다 (js/logolist.js · 44종)
     2  **계약서에 서명하면** 지점 등록 창이 이어서 뜬다 (설정에 숨어 있지 않다)
     3  창에 간판이 전부 깔리고, 그림이 실제로 붙는다 (경로가 표를 지난다)
     4  고르면 그 칸만 표시된다
     5  같은 것을 다시 누르면 고르기가 풀린다 (글자 로고로 돌아갈 길)
     6  등록하면 저장에 남는다 (S.branch)
     7  지점 이름은 「OO점」으로 읽힌다
     8  **다시 시작하면 시작화면 로고가 그 간판이다** — 이 항목의 본론
     9  콘솔 오류 없음
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PC = process.argv[2] === 'pc';
const PORT = PC ? 9384 : 9385;
const W = PC ? 1400 : 390, H = PC ? 880 : 844;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const OUT = path.join(__dirname, 'dist', 'shots');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
if (!CHROME) throw new Error('크롬을 못 찾았다');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const rows = [];
const ok = (name, pass, note) => rows.push({ name, pass, note });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  /* **프로필을 지우고 시작한다.** 이 검사는 「처음 켠 사람」의 줄(계약서 → 지점 등록)을
     지나야 하는데, 크롬 프로필을 재사용하면 지난번 실행의 저장이 남아서 이미 등록된
     상태로 시작한다 — 실제로 「고르면 표시된다」가 뒤집혀 나왔다(이미 골라져 있어서
     첫 클릭이 해제였다). 8번(다시 시작)도 같은 프로필을 **일부러** 재사용하는 항목이라
     시작 상태가 깨끗해야 뜻이 있다. */
  const PROFILE = path.join(process.env.TEMP || '/tmp', 'cdp-br-' + PORT);
  try { fs.rmSync(PROFILE, { recursive:true, force:true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + PROFILE,
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
  const shoot = async name => {
    const s = await send('Page.captureScreenshot', { format:'png' });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(s.data, 'base64'));
  };

  await send('Emulation.setDeviceMetricsOverride',
    { width:W, height:H, deviceScaleFactor: PC ? 1 : 3, mobile: !PC });
  await send('Page.navigate', { url: BASE + '/index.html?3d=1' });
  await sleep(3000);
  /* **저장을 비우고 다시 연다.** 프로필을 지우고 시작하지만 그것만으로는 못 믿는다 —
     앞선 실행의 크롬이 아직 그 폴더를 붙들고 있으면 rmSync 가 조용히 실패하고,
     그러면 지난번에 등록해 둔 간판이 남은 채로 시작한다(실제로 「고르면 표시된다」가
     뒤집혀 나왔다: 이미 골라져 있어서 첫 클릭이 해제였다). */
  await ev(`(()=>{ try { localStorage.clear(); } catch(e){} return 1 })()`);
  await send('Page.reload', {});
  await sleep(13000);
  /* 클릭 처리기 안에서 터진 예외는 CDP 로 늦게 오거나 안 온다 — 페이지에서 직접 받는다 */
  await ev(`(()=>{ window.__errs=[];
    addEventListener('error', e => __errs.push(String(e.message)));
    addEventListener('unhandledrejection', e => __errs.push('reject: ' + String(e.reason)));
    return 1 })()`);
  await ev(`(()=>{const st=document.createElement('style');
    st.textContent='#app{height:${H}px !important}';document.head.appendChild(st);
    if(typeof fitWorld==='function')fitWorld(); if(window.R3&&R3.fit)R3.fit(); return 1})()`);
  await sleep(600);

  /* ---------- 1 ---------- */
  const list = await ev(`(typeof LOGO_FILES !== 'undefined') ? LOGO_FILES.length : 0`);
  ok('간판 목록이 실려 있다', list >= 10, list + '종');

  /* ---------- 2. 계약서 → 지점 등록 ----------
     첫 부팅의 그 줄을 실제로 지난다. 프롤로그 컷신은 건너뛴다(여기서 볼 것이 아니다) —
     계약서를 직접 열고, 서명 단추를 **눌러서** 다음 창이 열리는지 본다. */
  const chain = await ev(`(()=>{
    const el = document.querySelector('#cctitle'); if (el) el.remove();
    document.body.classList.remove('titleon');
    showContract(() => { window.__afterAll = 1; });
    const c1 = !!document.querySelector('.veil .mhead.contract h3');
    document.querySelector('#cnGo').click();
    const h = document.querySelector('.veil .mhead .q');
    return { contract:c1, next: h ? h.textContent.trim() : '(없음)',
             cells: document.querySelectorAll('.logocell').length,
             afterAll: !!window.__afterAll };
  })()`);
  const pageErrs = await ev(`window.__errs || []`);
  if (pageErrs.length) console.log('  페이지 오류: ' + pageErrs.slice(0, 3).join(' | '));
  ok('서명하면 지점 등록이 이어서 뜬다', chain.contract && chain.next === 'BRANCH REGISTRATION',
      `계약서 ${chain.contract} → ${chain.next}`);
  ok('아직 끝난 게 아니다 (다음 문이 남아 있다)', chain.afterAll === false,
      '계약서 콜백이 등록 뒤로 넘어갔다');

  /* ---------- 3. 그림이 실제로 붙나 ----------
     background-image 문자열이 있는 것만으로는 모른다 — 경로가 틀리면 조용히 빈 칸이다.
     그래서 그 URL 을 실제로 **불러 본다**. */
  const imgs = await ev(`(async ()=>{
    const cells = [...document.querySelectorAll('.logocell span')];
    const url = s => (getComputedStyle(s).backgroundImage.match(/url\\(["']?(.*?)["']?\\)/) || [])[1] || '';
    const three = cells.slice(0, 3).map(url);
    const loaded = await Promise.all(three.map(u => new Promise(res => {
      if (!u) return res(0);
      const im = new Image(); im.onload = () => res(im.naturalWidth); im.onerror = () => res(0); im.src = u;
    })));
    return { n: cells.length, loaded, sample: (three[0] || '').slice(0, 60) };
  })()`);
  ok('간판 그림이 실제로 붙는다', imgs.n === list && imgs.loaded.every(w => w > 20),
      `칸 ${imgs.n} · 앞 세 장 폭 ${imgs.loaded.join('/')}px`);

  /* 마흔네 장이 다 붙기를 기다린 뒤에 찍는다 — 안 기다리면 아직 안 온 칸이 빈칸으로
     찍히고, 그 그림을 보고 「그림이 빠졌다」고 잘못 읽는다(실제로 두 칸이 그랬다). */
  const waited = await ev(`(async ()=>{
    const urls = [...document.querySelectorAll('.logocell span')].map(sp =>
      (getComputedStyle(sp).backgroundImage.match(/url\\(["']?(.*?)["']?\\)/) || [])[1] || '');
    const w = await Promise.all(urls.map(u => new Promise(res => {
      if (!u) return res(0);
      const im = new Image(); im.onload = () => res(1); im.onerror = () => res(0); im.src = u;
    })));
    return { n: w.filter(Boolean).length, cells: urls.length, first: (urls[0] || '(없음)').slice(0, 70) };
  })()`);
  ok('간판 마흔네 장이 전부 붙는다', waited.n === list, `${waited.n}/${list}장 · 칸 ${waited.cells} · ${waited.first}`);
  await sleep(400);
  await shoot(PC ? 'branch.png' : 'branch-phone.png');

  /* ---------- 4·5. 고르기 / 풀기 ---------- */
  const pickOn = await ev(`(()=>{
    const cells = [...document.querySelectorAll('.logocell')];
    cells[6].click();
    return { on: document.querySelectorAll('.logocell.on').length,
             which: cells[6].classList.contains('on'), file: cells[6].dataset.logo };
  })()`);
  ok('고르면 그 칸만 표시된다', pickOn.on === 1 && pickOn.which, `표시 ${pickOn.on}칸 · ${pickOn.file}`);

  const pickOff = await ev(`(()=>{
    [...document.querySelectorAll('.logocell')][6].click();
    return document.querySelectorAll('.logocell.on').length;
  })()`);
  ok('같은 것을 다시 누르면 풀린다', pickOff === 0, '표시 ' + pickOff + '칸');

  /* ---------- 6·7. 등록 ---------- */
  const reg = await ev(`(()=>{
    [...document.querySelectorAll('.logocell')][6].click();
    document.querySelector('#brName').value = '골목';
    document.querySelector('#brGo').click();
    const raw = JSON.parse(localStorage.getItem('copycat.save.v1') || '{}');
    return { logo:S.branch.logo, name:S.branch.name, label:branchLabel(),
             saved: raw.branch, mirror: localStorage.getItem('copycat.logo'),
             closed: !document.querySelector('.logocell'), afterAll: !!window.__afterAll };
  })()`);
  ok('등록하면 저장에 남는다',
      reg.logo === pickOn.file && reg.saved && reg.saved.logo === pickOn.file
        && reg.mirror === pickOn.file && reg.closed && reg.afterAll,
      `${reg.logo} · 저장 ${reg.saved && reg.saved.logo} · 거울 ${reg.mirror}`);
  ok('지점 이름이 「OO점」으로 읽힌다', reg.label === '골목점', reg.label);

  /* ---------- 8. 다시 시작 ----------
     이 항목의 본론이다. 같은 프로필로 다시 열면 시작화면 로고가 고른 간판이어야 한다. */
  await send('Page.navigate', { url: BASE + '/index.html?3d=1' });
  await sleep(9000);
  const again = await ev(`(()=>{
    const im = document.querySelector('#cctitle .logo img');
    if (!im) return { none:true };
    return { cls: im.className, src: im.getAttribute('src').slice(0, 90),
             w: im.naturalWidth, h: im.naturalHeight, up: !!im.complete };
  })()`);
  ok('다시 시작하면 첫 화면이 그 간판이다',
      !again.none && again.cls === 'mark' && again.up && again.w > 20
        && (again.src.indexOf(pickOn.file) >= 0 || again.src.startsWith('data:image/png')),
      again.none ? '시작화면이 없다' : `${again.cls} · ${again.w}×${again.h} · ${again.src.slice(0, 44)}…`);

  await sleep(2500);
  await shoot(PC ? 'branch-title.png' : 'branch-title-phone.png');

  ok('콘솔 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | ') || '0');

  ws.close(); chrome.kill();
  const pass = rows.filter(r => r.pass).length;
  for (const r of rows) console.log(`  ${r.pass ? 'OK ' : 'X  '} ${r.name.padEnd(34)} ${r.note || ''}`);
  console.log(`\n  ${pass}/${rows.length}   그림 → spike/dist/shots/${PC ? 'branch*.png' : 'branch*-phone.png'}`);
  process.exit(pass === rows.length ? 0 : 1);
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
