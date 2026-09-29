/* 상단 빈 띠 — 위쪽 안전영역을 **두 번 내던 것.**  node spike/serve.js 먼저.

   제보(2026-09-21): 안드로이드 앱에서 상단 띠 위에 빈 공간이 남는다.

   원인은 한 줄로 말하면 **같은 값을 두 곳이 낸다**였다. 안드로이드 껍데기는 창을
   이미 상태바 밑에서 시작하게 줄여 놨는데(styles.xml 의 fitsSystemWindows), CSS 도
   env(safe-area-inset-top) 만큼 또 밀었다. 여태 안 보인 이유는 안드로이드의 그 값이
   **상태바가 아니라 디스플레이 컷아웃**(펀치홀·노치)을 재기 때문이다 — 펀치홀 없는
   기기에서는 0 이라 멀쩡했고, 펀치홀 있는 기기에서만 그 높이만큼 띠가 남았다.

   ── 헤드리스에서 env() 는 늘 0 이다 ──
   그래서 「고쳐졌나」를 그냥 보면 **고치기 전에도 통과한다.** 대신 값이 흐르는 길을
   끊어서 본다: `--safet` 을 48px 로 덮어 놓고, 그 값이 상단 띠까지 가는가 / 안
   가는가를 플랫폼별로 확인한다. 실제 기기에서 env() 가 무엇을 돌려주든 결과는 같다.

     아이폰  48px 이 그대로 간다      (껍데기가 화면 끝까지 그린다 — 우리가 내야 한다)
     안드로이드  0 으로 막힌다         (껍데기가 창을 이미 줄였다 — 내면 두 번이다)

   재는 것 다섯:
     1  안드로이드에서 --safet 이 0 으로 덮인다
     2  그 판에서는 48px 을 부어도 상단 띠가 안 밀린다 (두 번 안 낸다)
     3  아이폰에서는 안 덮는다 — 48px 이 상단 띠까지 그대로 간다
     4  CSS 어디에도 env(safe-area-inset-top) 직접 사용이 안 남아 있다 (한 곳 규칙)
     5  콘솔 오류 없음
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const TAG = process.pid + '-' + Math.floor(Math.random() * 1e6);
const PORT = 9250 + Math.floor(Math.random() * 140);
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
if (!CHROME) throw new Error('크롬을 못 찾았다');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let bad = 0;
const ok = (t, pass, note) => { if (!pass) bad++;
  console.log(`${pass ? '✅' : '❌'} ${t}${note ? '   ' + note : ''}`); };

const UA = {
  android: 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
};

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-safet-' + TAG);
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

  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*supabase*', '*jsdelivr*'] });

  /* 한 판을 연다. 시작화면과 컷신을 걷고 사무실 탭으로 — 상단 띠가 보이는 화면이다. */
  async function open(ua){
    await send('Network.setUserAgentOverride', { userAgent: ua });
    await send('Emulation.setDeviceMetricsOverride', { width:390, height:844, deviceScaleFactor:3, mobile:true });
    await send('Page.navigate', { url: BASE + '/index.html?x=' + Math.random() });
    for (let i = 0; i < 250; i++){
      if (await ev(`document.body && document.body.classList.contains('r3ready')`)) break;
      await sleep(200);
    }
    await sleep(1200);
    await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
    await sleep(1000);
    await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
    await sleep(1000);
    await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
    await sleep(2000);
    await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
      document.querySelectorAll('.veil,.coach,.coachring,#cctitle').forEach(e=>e.remove());
      document.body.classList.remove('titleon');
      if (typeof setCol === 'function') setCol('stage'); })()`);
    await sleep(1200);
  }
  /* env() 를 흉내 낸다 — 헤드리스는 늘 0 이라 그냥 보면 아무것도 안 잰다.
     **스타일시트 규칙으로** 부어야 의미가 있다: 안드로이드 쪽은 인라인으로 덮어
     두었으므로 이걸 이기고, 아이폰 쪽은 덮은 게 없으므로 이게 먹는다. */
  const pour = () => ev(`(() => { const s = document.createElement('style');
    s.id = 'pour'; s.textContent = ':root{--safet:48px}';
    document.head.appendChild(s); return 1; })()`);
  const look = async () => JSON.parse(await ev(`(() => {
    const tb = document.querySelector('#topbar');
    const lg = document.querySelector('.brand .logo') || document.querySelector('.brand');
    return JSON.stringify({
      inline: document.documentElement.style.getPropertyValue('--safet').trim(),
      safet: getComputedStyle(document.documentElement).getPropertyValue('--safet').trim(),
      pad: getComputedStyle(tb).paddingTop,
      logoTop: Math.round(lg.getBoundingClientRect().top),
      topb: getComputedStyle(document.querySelector('#app')).getPropertyValue('--topb').trim(),
    });
  })()`));

  console.log('── 안드로이드 ──');
  await open(UA.android);
  const a0 = await look();
  console.log('   ' + JSON.stringify(a0));
  ok('--safet 을 0 으로 덮는다', a0.inline === '0px', `인라인 "${a0.inline}"`);
  await pour(); await sleep(400);
  const a1 = await look();
  console.log('   48px 부은 뒤 ' + JSON.stringify(a1));
  ok('48px 을 부어도 상단 띠가 안 밀린다 (두 번 안 낸다)',
     a1.logoTop === a0.logoTop && a1.pad === a0.pad, `로고 ${a0.logoTop} → ${a1.logoTop}px · 여백 ${a1.pad}`);

  console.log('\n── 아이폰 ──');
  await open(UA.ios);
  const i0 = await look();
  console.log('   ' + JSON.stringify(i0));
  ok('여기서는 안 덮는다', i0.inline === '', `인라인 "${i0.inline}"`);
  await pour(); await sleep(400);
  const i1 = await look();
  console.log('   48px 부은 뒤 ' + JSON.stringify(i1));
  ok('48px 이 상단 띠까지 그대로 간다 (노치를 우리가 비켜 준다)',
     i1.logoTop === i0.logoTop + 48, `로고 ${i0.logoTop} → ${i1.logoTop}px`);
  ok('--topb 도 같이 따라온다', /48px/.test(i1.topb) || parseInt(i1.topb, 10) >= 110, i1.topb);

  /* 한 곳 규칙 — 다시 흩어지면 오늘 고친 것이 조용히 되살아난다. */
  /* **주석을 먼저 지우고 센다.** 안 지우면 「여기 말고 env() 를 직접 쓰지 말라」고
     적어 둔 그 머리말 자체가 걸려서, 규칙을 적은 것이 규칙 위반으로 잡힌다. */
  const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));   // 줄 번호는 지킨다
  const raw = css.split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /env\(\s*safe-area-inset-top/.test(l) && !/--safet\s*:\s*env\(/.test(l));
  ok('CSS 에 위쪽 env() 직접 사용이 안 남아 있다 (--safet 한 곳뿐)',
     raw.length === 0, raw.map(([n]) => 'line ' + n).join(', ') || '0곳');

  ok('콘솔 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | ') || '0');
  console.log('\n' + (bad ? `${bad}건 실패` : '전부 통과'));
  ws.close(); chrome.kill();
  process.exit(bad ? 1 : 0);
})();
