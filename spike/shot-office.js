/* ============================================================
   shot-office.js — 프롤로그의 한 장만 골라 찍는다.

   verify-open.js 는 오프닝 전체(게이트 → 골목 → 통화 → 암전 → 사무실 → 편지 →
   계약서 → 재부팅 → 리셋)를 한 번에 도는 검사라 한 번 돌리는 데 30초가 넘는다.
   조명·구도를 만지는 동안에는 그 대기 시간이 곧 시행 횟수라서, 「사무실 장면만
   여러 시각으로」 찍는 짧은 것을 따로 둔다. 검사가 아니라 **눈으로 볼 것**을 만드는
   스크립트다 — 통과/실패를 안 판정한다.

     node spike/serve.js &
     node spike/shot-office.js            desk 장을 시각별로 + letter
     node spike/shot-office.js 6.0        desk 의 한 시각만 (빠른 왕복)
     node spike/shot-office.js rain@7.4   다른 장도 — 조명을 두 세트에 맞출 때 쓴다

   출력: spike/dist/office/*.png
   ============================================================ */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9361, W = 1440, H = 810;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
/* 인자는 셋 중 하나다: 없음 / 초(desk 의 그 시각) / `장@초`.
   장 이름은 opening.js 의 CH 와 같다 — rain · flyer · call · dark · desk · letter. */
const ARG = process.argv[2] || null;
const ONLY = ARG ? (ARG.includes('@') ? [ARG.split('@')[0], Number(ARG.split('@')[1])]
                                      : ['desk', Number(ARG)]) : null;
const OUT = path.join(__dirname, 'dist', 'office');

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe',
].find(p => p && fs.existsSync(p));
if (!CHROME) throw new Error('크롬을 못 찾았다');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const profile = path.join(process.env.TEMP || '/tmp', 'cdp-office-' + Date.now());
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, 'about:blank'], { stdio:'ignore' });

  let page;
  for (let i = 0; i < 60 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
    if (!page) await sleep(250);
  }
  if (!page) throw new Error('크롬이 안 뜬다');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); const errors = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errors.push('console: ' + m.params.args.map(a => a.value || a.description || '').join(' '));
    if (m.method === 'Runtime.exceptionThrown')
      errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width:W, height:H, deviceScaleFactor:1.5, mobile:false });

  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true })).result?.value;
  const shot = async name => {
    const r = await send('Page.captureScreenshot', { format:'png' });
    if (r && r.data) fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64'));
  };

  await send('Page.navigate', { url: BASE + '/index.html?3d=1' });
  /* 게이트가 뜨는 시각은 부팅 속도에 달렸다 — 고정 대기로는 빠른 기계에서만 맞는다.
     떠 있을 때까지 기다린 뒤 누르고, **눌렸는지 확인**한다. */
  let ok = '';
  for (let i = 0; i < 40 && ok !== '돈다'; i++){
    await sleep(400);
    ok = await ev(`(() => {
      if (typeof CCOpen === 'undefined' || !CCOpen.playing()) return '아직';
      const b = document.querySelector('.ogate .ogo');
      if (b) b.click();
      const s = CCOpen.state();
      return s && s.started ? '돈다' : '게이트 대기';
    })()`);
  }
  console.log('재생:', ok);
  if (ok !== '돈다'){
    /* 게이트를 못 눌렀으면 십중팔구 모듈이 안 뜬 것이다 — 그 이유는 콘솔에 있다.
       여기서 안 찍으면 "게이트를 못 눌렀다" 한 줄만 보고 무슨 일인지 다시 뒤져야 한다. */
    console.log('게이트를 못 눌렀다');
    errors.slice(0, 8).forEach(e => console.log('  ' + e));
    if (!errors.length) console.log('  콘솔 오류는 없다 — 서버나 부팅 속도를 본다');
    ws.close(); chrome.kill(); process.exit(1);
  }
  /* 자막과 스킵 버튼을 지운다 — 조명을 볼 때는 글자가 방해다.
     (자막이 뜨는지는 verify-open.js 가 본다) */
  await ev(`(() => {
    const s = document.createElement('style');
    s.textContent = '.osub,.oskip,.ohint,.obar{display:none!important}';
    document.head.appendChild(s);
  })()`);

  /* 소프트웨어 렌더는 초당 두 프레임이라 실시간으로 기다릴 수 없다 — 그 장의 그 시각으로
     바로 뛴다. 형광등 깜빡임이 난수가 아니라 시간 함수라서(opening.js flick) 같은
     시각이면 같은 그림이 나온다. */
  const shots = ONLY ? [ONLY]
    : [['desk', 0.1], ['desk', 3.0], ['desk', 6.4], ['desk', 6.9], ['desk', 10.0], ['desk', 14.0]];
  for (const [ch, at] of shots){
    await ev(`CCOpen.jump('${ch}', ${at})`);
    await sleep(1500);
    const name = `${ch}-${String(at).replace('.', '_')}`;
    console.log(' ', name, await ev(`JSON.stringify(CCOpen.debug())`));
    await shot(name);
  }
  if (!ONLY){
    await ev(`CCOpen.jump('letter')`);
    await sleep(1800);
    console.log('  letter', await ev(`JSON.stringify(CCOpen.debug())`));
    await shot('letter');
  }

  console.log(errors.length ? '오류:\n  ' + errors.slice(0, 8).join('\n  ') : '오류 없음');
  console.log('→', OUT);
  ws.close(); chrome.kill();
  process.exit(0);
})();
