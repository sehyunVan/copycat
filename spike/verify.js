/* ============================================================
   verify.js — 스파이크 셋이 실제로 뜨는지 헤드리스 크롬으로 확인한다.

   일부러 dist/ 의 단일 파일을 file:// 로 연다. 그래야 배포 경로까지 같이 검증된다.
   (PiP 는 사용자 제스처와 진짜 창이 필요해서 여기선 못 잰다 — 1번은 손으로 볼 것.)

   node spike/pack.js all && node spike/verify.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const HERE = __dirname;
const DIST = path.join(HERE, 'dist');
const SHOTS = path.join(DIST, 'shots');
const PORT = 9347;
const W = 1280, H = 800;

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(p => p && fs.existsSync(p));
if (!CHROME){ console.error('크롬을 못 찾았다'); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 스크린샷에 색이 몇 종류나 있는지. 안 그려진 화면은 배경 한 색뿐이다. */
const { decodePNG } = require('../tools/png.js');
function distinctColors(file){
  const { rgba } = decodePNG(file);
  const seen = new Set();
  for (let i = 0; i < rgba.length; i += 4 * 37){            // 성글게 훑어도 충분하다
    seen.add((rgba[i] >> 3 << 10) | (rgba[i+1] >> 3 << 5) | (rgba[i+2] >> 3));
    if (seen.size > 4096) break;
  }
  return seen.size;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  /* 인자는 파일 하나이거나 접두어다. 접두어로 주면 크롬 한 번만 띄우고 전부 찍는다 —
     파일마다 프로세스를 새로 띄우면 디버깅 포트가 아직 안 풀려서 간헐적으로 죽는다. */
  const arg = process.argv[2];
  const all = fs.readdirSync(DIST).filter(f => f.endsWith('.single.html'));
  const files = !arg ? all
    : arg.endsWith('.html') ? [arg]
    : all.filter(f => f.startsWith(arg));
  if (!files.length){ console.error(`"${arg}" 에 맞는 파일이 없다`); process.exit(1); }
  if (!files.length){ console.error('dist/ 가 비었다 — node spike/pack.js all 을 먼저 돌릴 것'); process.exit(1); }

  const chrome = spawn(CHROME, [
    '--headless=new', '--hide-scrollbars', '--mute-audio',
    // 소프트웨어 래스터라이저로 WebGL 을 켠다. 성능 수치는 여기서 재면 안 되고,
    // "돌아가는가 / 콘솔이 깨끗한가" 만 본다.
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'cdp-spike-' + PORT),
    '--allow-file-access-from-files', 'about:blank',
  ], { stdio: 'ignore' });

  let page;
  for (let i = 0; i < 60 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
    if (!page) await sleep(250);
  }
  if (!page) throw new Error('크롬이 안 뜬다');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  let errors = [], logs = [];
  const send = (m, p = {}) => new Promise(r => {
    const i = ++id; pending.set(i, r);
    ws.send(JSON.stringify({ id: i, method: m, params: p }));
  });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)){ pending.get(m.id)(m.result); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown')
      errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error')
      errors.push(m.params.entry.text);
    if (m.method === 'Runtime.consoleAPICalled')
      logs.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  /* DPR 2 로 띄운다. 1 로 재면 캔버스 CSS 크기를 안 정한 버그가 통과해 버린다
     (드로잉 버퍼 크기와 레이아웃 크기가 우연히 같아져서). */
  const metrics = f => /^[sf]\d/.test(f)
    ? { width: 1660, height: 540 }        // 색·형태 프로토타입은 3패널 가로 배치
    : /^c\d/.test(f)
    ? { width: 1180, height: 800 }        // 배치 프로토타입은 한 화면
    : /^k\d/.test(f)
    ? { width: 2600, height: 700 }        // 고양이 대조대는 한 줄이라 아주 가로로 길게
    : { width: W, height: H };

  const ev = async expr =>
    (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: false })).result?.value;

  let bad = 0;
  for (const f of files){
    errors = []; logs = [];
    const m = metrics(f);
    await send('Emulation.setDeviceMetricsOverride', { ...m, deviceScaleFactor: 2, mobile: false });
    const url = 'file:///' + path.join(DIST, f).replace(/\\/g, '/');
    await send('Page.navigate', { url });
    await sleep(5000);                       // 소프트웨어 렌더라 첫 프레임이 느리다

    const rows = await ev(`JSON.stringify([...document.querySelectorAll('.hud .row')]
      .map(r => r.textContent.replace(/\\s+/g,' ').trim()))`);
    /* 컨텍스트만 보면 안 된다 — 캔버스가 화면을 덮고 있는지도 같이 본다.
       DPR 2 에서 CSS 크기를 안 정하면 여기서 걸린다. */
    const canvasOk = await ev(`(()=>{const c=document.querySelector('canvas');
      if(!c) return 'canvas 없음';
      const gl=c.getContext('webgl2')||c.getContext('webgl');
      if(!gl) return 'gl 컨텍스트 없음';
      if(gl.isContextLost()) return '컨텍스트 손실';
      const s=c.parentElement;
      if(Math.abs(c.clientWidth-s.clientWidth)>2||Math.abs(c.clientHeight-s.clientHeight)>2)
        return \`캔버스 크기 어긋남 \${c.clientWidth}×\${c.clientHeight} vs 스테이지 \${s.clientWidth}×\${s.clientHeight}\`;
      return 'ok';})()`);
    const packLines = logs.filter(l => l.startsWith('[pack]'));
    const packLine = packLines[packLines.length - 1] || '(pack 배지 없음)';
    const packOk = /모듈 OK/.test(packLine);
    const rowCount = await ev(`document.querySelectorAll('.hud .row').length`);

    const shotName = f.replace('.single.html', '.png');
    const r = await send('Page.captureScreenshot', {
      format: 'png', clip: { x:0, y:0, width:m.width, height:m.height, scale:1 } });
    const shotPath = path.join(SHOTS, shotName);
    fs.writeFileSync(shotPath, Buffer.from(r.data, 'base64'));

    /* 로더가 예외를 삼키므로 uncaught 만 봐서는 실패를 놓친다. 제일 확실한 증거는
       "화면에 색이 몇 가지나 있나" 다 — 안 그려졌으면 배경 한 색뿐이다.
       계기판 행 수로 판정하면 계기판을 안 쓰는 페이지가 억울하게 실패한다. */
    const colors = distinctColors(shotPath);
    const ok = errors.length === 0 && canvasOk === 'ok' && packOk && colors >= 64;
    if (!ok) bad++;
    console.log(`\n${ok ? '✅' : '❌'} ${f}`);
    console.log(`   ${packLine}`);
    console.log(`   canvas: ${canvasOk} · 색 ${colors}종 · HUD 행 ${rowCount}`);
    packLines.filter(l => !/모듈 OK/.test(l)).forEach(l => console.log(`   ⚠ ${l.split('\n')[0]}`));
    JSON.parse(rows || '[]').slice(0, 8).forEach(r => console.log(`   · ${r}`));
    errors.slice(0, 6).forEach(e => console.log(`   ⚠ ${String(e).split('\n')[0]}`));
    console.log(`   shot → ${path.relative(process.cwd(), path.join(SHOTS, shotName))}`);
  }

  ws.close();
  chrome.kill();
  console.log(bad ? `\n${bad}개 실패` : '\n전부 통과 (headless/swiftshader 기준 — fps 는 여기 숫자를 믿지 말 것)');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
