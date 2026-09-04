/* d1/d2 를 헤드리스로 찍는다. 서버도 여기서 같이 띄운다.
   node spike/shot-char.js  →  spike/ui/char-*.png

   조형은 눈으로만 판정된다. 그런데 눈으로 보려면 매번 브라우저를 열어야 하고,
   그러면 판정이 느려서 시도 횟수가 준다. 찍어 두면 여섯 칸을 한 장으로 본다. */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9540, WEB = 8137;
const OUT = path.resolve(__dirname, 'ui') + path.sep;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const ONLY = process.argv.slice(2).filter(a => !a.startsWith('-'));
const CASES = [
  { n:'form', url:'d1-char.html?hud',       w:1680, h:1000 },
  { n:'ink',  url:'d1-char.html?hud&ink',   w:1680, h:1000 },
  { n:'sil',  url:'d1-char.html?hud&sil',   w:1680, h:1000 },
  { n:'mood', url:'d2-mood.html?hud',       w:1440, h:900 },
  { n:'calm', url:'d2-mood.html?hud&mood=0', w:900, h:900 },
  { n:'mad',  url:'d2-mood.html?hud&mood=1', w:900, h:900 },
  /* 계기판까지 넣어 찍는 판 — README 에 적을 숫자를 여기서 읽는다 */
  { n:'num1', url:'d1-char.html',            w:1680, h:1000 },
  { n:'num2', url:'d2-mood.html?mood=1',     w:1440, h:900 },
  /* m1 은 이 축이 건드린 sculpt.js 를 그대로 쓴다 — 리팩터가 안 깼는지 보는 자리 */
  { n:'m1',   url:'m1-sculpt.html',          w:1400, h:900 },
];

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const web = spawn(process.execPath, [path.join(__dirname, 'serve.js'), String(WEB)],
    { stdio:'ignore' });
  await sleep(500);

  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-char');
  fs.rmSync(dir, { recursive:true, force:true });
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });

  let page; for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl); let id = 0; const pend = new Map();
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  const logs = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      logs.push(m.params.args.map(a => a.value || a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown')
      logs.push('EXC ' + (m.params.exceptionDetails.exception?.description
        || m.params.exceptionDetails.text));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');

  for (const c of CASES){
    if (ONLY.length && !ONLY.includes(c.n)) continue;
    if (!fs.existsSync(path.join(__dirname, c.url.split('?')[0]))) continue;
    logs.length = 0;
    await send('Emulation.setDeviceMetricsOverride',
      { width:c.w, height:c.h, deviceScaleFactor:1, mobile:false });
    await send('Page.navigate', { url:`http://localhost:${WEB}/spike/${c.url}` });
    await sleep(2600);                       // 깎는 데 시간이 걸린다 (여섯 마리)
    const s = await send('Page.captureScreenshot', { format:'png',
      clip:{ x:0, y:0, width:c.w, height:c.h, scale:1 } });
    if (!s || !s.data){ console.log('  ' + c.n + ' — 실패'); }
    else {
      fs.writeFileSync(OUT + 'char-' + c.n + '.png', Buffer.from(s.data, 'base64'));
      console.log('  char-' + c.n + '.png');
    }
    for (const l of logs.slice(0, 6)) console.log('    ! ' + l);
  }
  ws.close(); chrome.kill(); web.kill();
  process.exit(0);
})();
