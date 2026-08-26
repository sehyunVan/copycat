/* ============================================================
   verify-open.js — 프롤로그가 실제로 도는지 확인한다.

   컷신은 눈으로만 확인되는 종류의 코드라서, 장(章)마다 한 장씩 찍어 둔다.
   그리고 눈으로 안 보이는 것 셋을 같이 검사한다:
     1) 편지 → 근로계약서로 이어지는가
     2) 계약서에서 정한 이름이 1번 사원에 박히는가
     3) 새로고침하면 오프닝이 **다시 안 뜨는가** (S.intro 저장)

   모듈이라 file:// 로는 못 열고 서버가 필요하다:
     node spike/serve.js &   node spike/verify-open.js
   출력: spike/dist/open/*.png
   ============================================================ */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9357, W = 1440, H = 810;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
/* 인자가 file: 이나 http: 로 시작하면 그 주소를 그대로 연다 —
   배포본(dist/copycat.html)을 file:// 로 여는 게 실제 사용자의 경로다. */
const ARG = process.argv[2] || '?3d=1';
const URL_ = /^(file|http)/.test(ARG) ? ARG : BASE + '/index.html' + ARG;
const OUT = path.join(__dirname, 'dist', 'open');

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe',
].find(p => p && fs.existsSync(p));
if (!CHROME) throw new Error('크롬을 못 찾았다');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  /* 프로필을 매번 새로 만든다 — localStorage 가 남아 있으면 첫 실행이 아니게 되고,
     첫 실행이 아니면 검사할 것이 사라진다. */
  const profile = path.join(process.env.TEMP || '/tmp', 'cdp-open-' + Date.now());
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
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error')
      errors.push(m.params.entry.text + ' ' + (m.params.entry.url || ''));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width:W, height:H, deviceScaleFactor:1.5, mobile:false });

  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true })).result?.value;
  const shot = async name => {
    const r = await send('Page.captureScreenshot', { format:'png' });
    if (r && r.data) fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64'));
  };

  await send('Page.navigate', { url: URL_ });
  /* 배포본(단일 HTML, 1.4MB)은 모듈을 blob 으로 다시 올리느라 부팅이 더 걸린다 */
  await sleep(Number(process.env.BOOT_MS) || 6000);

  console.log('부팅:', await ev(`JSON.stringify({
    open: !!window.CCOpen,
    overlay: !!document.querySelector('.opening'),
    gate: !!document.querySelector('.ogate .ogo'),
    intro: (typeof S !== 'undefined' && S) ? S.intro : '-',
    cat0: (typeof S !== 'undefined' && S && S.cats[0]) ? S.cats[0].name : '-',
  })`));
  await shot('0-gate');

  console.log('재생 시작:', await ev(`(() => {
    const b = document.querySelector('.ogate .ogo');
    if (!b) return '게이트 없음';
    b.click();
    return CCOpen.playing() ? '돈다' : '안 돈다';
  })()`));

  /* 장마다 한 장. 실시간으로 기다리지 않고 그 장의 "자막이 나오는 시각"으로 바로 간다 —
     소프트웨어 렌더는 초당 두 프레임이라 실시간으로는 12초짜리 장을 볼 수 없다. */
  for (const [i, [ch, at]] of [['rain',7.4],['flyer',11.6],['call',15.2],['dark',4.0],['desk',13.4]].entries()){
    await ev(`CCOpen.jump('${ch}', ${at})`);
    await sleep(1400);
    const s = await ev(`JSON.stringify(CCOpen.state())`);
    const sub = await ev(`(document.querySelector('.osub span')||{}).textContent || ''`);
    console.log(`  ${i+1}. ${ch} — ${s} · DOM 자막: ${JSON.stringify(sub)}`);
    await shot(`${i+1}-${ch}`);
  }

  await ev(`CCOpen.jump('letter')`);
  await sleep(1600);
  console.log('편지:', await ev(`JSON.stringify({
    on: !!document.querySelector('.oletter.on'),
    items: document.querySelectorAll('.olist li').length,
    btn: (document.querySelector('#oLetterGo')||{}).textContent,
  })`));
  await shot('6-letter');

  await ev(`document.querySelector('#oLetterGo').click()`);
  await sleep(1200);
  console.log('계약서:', await ev(`JSON.stringify({
    head: !!document.querySelector('.mhead.contract'),
    closable: !!document.querySelector('.veil [data-close]'),
    name: (document.querySelector('#cnName')||{}).value,
    looks: document.querySelectorAll('.veil .swatch').length,
    overlayGone: !document.querySelector('.opening'),
  })`));
  await shot('7-contract');

  console.log('서명:', await ev(`(() => {
    const el = document.querySelector('#cnName');
    if (!el) return '계약서 없음';
    el.value = '나비';
    const sw = document.querySelectorAll('.veil .swatch');
    if (sw[1]) sw[1].click();
    document.querySelector('#cnGo').click();
    return JSON.stringify({ name:S.cats[0].name, founder:!!S.cats[0].founder,
                            intro:S.intro, modals:document.querySelectorAll('.veil').length,
                            log:(S.log[0]||{}).t });
  })()`));
  await sleep(1800);
  /* 계약서에서 고른 그림이 실제로 사무실에 서 있는 그림인가.
     배우(빌보드)는 계약서를 쓰기 전에 이미 만들어져 있어서, 여기서 안 맞으면
     플레이어가 고른 고양이와 스폰되는 고양이가 다르다. */
  console.log('고른 그림 = 서 있는 그림:', await ev(`(() => {
    const me = S.cats[0];
    const out = { name: me.name,
                  tags: [...document.querySelectorAll('#actors .tagname, #tags3d .tag3d')].map(e => e.textContent) };
    if (typeof R3 !== 'undefined' && R3.ready){
      const d = R3.debug().cats.find(c => c.id === me.id);
      out.picked = me.draw; out.drawn = d && d.drawn;
      out.match = !!d && (d.drawn || 0) === (me.draw || 0);
    } else {
      out.mode = '도트'; out.fur = me.fur; out.hue = me.hue;
    }
    return JSON.stringify(out);
  })()`));
  await shot('8-game');

  /* 다시 부팅 — 저장이 있으면 오프닝은 뜨지 않아야 한다 */
  await send('Page.navigate', { url: URL_ });
  await sleep(5000);
  console.log('재부팅:', await ev(`JSON.stringify({
    overlay: !!document.querySelector('.opening'),
    intro: S.intro, cat0: S.cats[0].name,
  })`));
  await shot('9-reboot');

  /* 🗑️ 처음부터 — 저장을 지우고 오프닝부터 다시 시작해야 한다.
     confirm 은 헤드리스에서 멈추므로 눌리기 전에 갈아 끼운다. */
  await ev(`window.confirm = () => true`);
  await ev(`document.getElementById('btnReset').click()`);
  await sleep(2500);
  console.log('처음부터:', await ev(`JSON.stringify({
    overlay: !!document.querySelector('.opening'),
    gate: !!document.querySelector('.ogate .ogo'),
    intro: S.intro, cats: S.cats.length, cat0: S.cats[0].name,
  })`));
  await shot('10-reset');

  console.log(errors.length ? '오류:\n  ' + errors.slice(0, 12).join('\n  ') : '오류 없음');
  console.log('스크린샷:', OUT);
  ws.close(); chrome.kill();
  process.exit(0);
})();
