/* 게임을 띄워 놓고 아무 식이나 한 줄 물어본다.
   verify-game.js 는 정해진 항목만 보고, 뭔가 이상할 때 캐물을 곳이 없었다.

   node spike/serve.js &
   node spike/probe.js "JSON.stringify(R3.debug())" [대기ms] [?쿼리]

   식은 페이지 안에서 그대로 평가된다. 콘솔 오류도 같이 찍는다 —
   "값이 이상한" 원인이 대개 그 위에서 조용히 터진 예외이기 때문이다. */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
/* 프로필과 포트를 실행마다 다르게 잡는다 — 앞 실행의 크롬이 아직 안 죽었으면
   같은 프로필을 못 열어서 "크롬이 안 뜬다" 로 끝난다. */
const PORT = 9400 + (process.pid % 500);
const EXPR = process.argv[2] || '1';
const WAIT = Number(process.argv[3]) || 2500;
const QUERY = process.argv[4] || '?3d=1';
/* 5번째 인자로 다른 서버를 볼 수 있다 — 배포 zip 을 풀어서 띄운 걸 확인할 때 쓴다.
   소스 트리를 보고 "된다" 고 말하면 zip 에 빠진 파일을 못 잡는다. */
const BASE = process.argv[5] || 'http://localhost:8123';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe',
].find(p => p && fs.existsSync(p));
if (!CHROME) throw new Error('크롬을 못 찾았다');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'cdp-probe-' + process.pid),
    '--window-size=1440,900',
    'about:blank'], { stdio: 'ignore' });

  let page;
  for (let i = 0; i < 60 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
    if (!page) await sleep(250);
  }
  if (!page) throw new Error('크롬이 안 뜬다');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); const log = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.consoleAPICalled')
      log.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    if (m.method === 'Runtime.exceptionThrown')
      log.push('예외: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  /* BASE 가 .html 로 끝나면 그 파일을 그대로 연다 — 단일 파일 배포본(copycat.html) 확인용 */
  await send('Page.navigate', { url: BASE + (BASE.endsWith('.html') ? '' : '/index.html') + QUERY });
  await sleep(WAIT);

  const r = await send('Runtime.evaluate', { expression: EXPR, returnByValue: true, awaitPromise: true });

  /* 식을 평가한 뒤의 화면을 남긴다 — 숫자로 확인한 것을 눈으로도 한 번 본다.
     PROBE_SHOT=파일경로 로 켠다. */
  if (process.env.PROBE_SHOT){
    await sleep(1200);
    const shot = await send('Page.captureScreenshot', { format:'png' });
    if (shot && shot.data){
      fs.mkdirSync(path.dirname(process.env.PROBE_SHOT), { recursive:true });
      fs.writeFileSync(process.env.PROBE_SHOT, Buffer.from(shot.data, 'base64'));
      console.log('shot → ' + process.env.PROBE_SHOT);
    }
  }
  const ex = r.exceptionDetails;
  console.log(r.result?.value ?? (ex ? (ex.exception?.description || ex.text) : r.result));
  if (log.length) console.log('\n--- 콘솔 ---\n' + log.join('\n'));

  await send('Browser.close');    // kill() 은 자식 프로세스를 남긴다
  ws.close(); chrome.kill();
  process.exit(0);
})();
