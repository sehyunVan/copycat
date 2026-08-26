/* 무대가 **안 오는** 환경에서 빈 화면에 갇히지 않는지 잰다.  node spike/serve.js 먼저.

   "무대가 올 예정이면 아무것도 안 그린다" 는 상태가 있고, 거기서 안 빠져나오면
   **영영 빈 무대**가 된다. 그게 이 시험이 막는 것이다.

   도트 렌더러를 지운 뒤로(2026-08-24) 떨어질 곳이 「말해 주는 판」(.nogl) 하나다.
   그래서 재는 것이 「도트로 내려갔나」에서 「못 그렸다고 말했나」로 바뀌었다.

   재는 둘:
     1. file:// 소스 트리  모듈이 CORS 로 막힌다 — onerror 가 떠서 .nogl 이 나와야 한다
     2. 배포본 file://     모듈이 HTML 안에 접혀 있다 — 무대가 서야 한다(preload 링크도 없어야)
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9690;
const ROOT = path.resolve(__dirname, '..');
const fileURL = p => 'file:///' + path.resolve(ROOT, p).split(path.sep).join('/');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CASES = [
  { name:'file:// 소스 트리 (모듈 막힘)', url:fileURL('index.html'),       want:'못그림말함' },
  { name:'file:// 배포본 (모듈 접힘)',    url:fileURL('dist/copycat.html'), want:'무대' },
];

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-fb-' + process.pid);
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page; for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl); let id = 0; const pend = new Map();
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); } });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;

  await send('Emulation.setDeviceMetricsOverride', { width:1280, height:760, deviceScaleFactor:1, mobile:false });
  let fail = 0;
  for (const c of CASES){
    await send('Page.navigate', { url: c.url });
    /* 프롤로그가 있으면 넘긴다 — 여기서 재려는 것은 무대가 결국 그려지는가다 */
    await sleep(9000);
    await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
    await sleep(1000);
    await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
    await sleep(1000);
    await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
    await sleep(2500);
    await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
      document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
    await sleep(2500);

    const st = await ev(`(() => {
      const r3 = typeof R3 !== 'undefined' && !!(R3 && R3.ready);
      const said = !!document.querySelector('.nogl');
      return JSON.stringify({
        모드: r3 ? '무대' : (said ? '못그림말함' : '빈화면'),
        기다리는중: document.body.classList.contains('r3wait'),
        실패신호: !!window.__r3fail,
        preload남음: document.querySelectorAll('link[rel=modulepreload]').length,
      });
    })()`);
    const S = JSON.parse(st);
    const ok = S.모드 === c.want && !S.기다리는중
      && (c.name.indexOf('배포본') < 0 || S.preload남음 === 0);
    if (!ok) fail++;
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${c.name}  →  ${JSON.stringify(S)} (기대 ${c.want})`);
  }
  console.log(fail ? `\n${fail}건 실패` : '\n전부 통과 — 무대가 안 와도 빈 화면에 갇히지 않는다');
  ws.close(); chrome.kill(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
