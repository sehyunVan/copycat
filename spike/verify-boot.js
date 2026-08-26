/* 부팅 순간의 도트 깜빡임을 잰다.  node spike/serve.js 먼저.

   기전(코드를 읽어 얻은 가설):
     클래식 스크립트(assets…main.js)는 **동기**로 돌고 boot() 이 renderTiles() 를 부른다.
     그때 R3 가 아직 없어서 is3d() 가 false → **도트 렌더러가 그린다.**
     render3d.js 는 type="module" 이라 클래식이 전부 끝난 뒤에 평가되고,
     거기서 R3.ready 를 세우고 renderTiles() 를 다시 부른다 → 그때 3D 로 바뀐다.
     그 사이가 깜빡임이다.

   그래서 재는 것은 **그 사이의 길이**와, 그 동안 화면에 실제로 도트가 있었는지다.
   두 번째 방문(세이브 있음)으로 잰다 — 첫 방문은 프롤로그의 검은 화면이 덮어 주기 때문에
   증상이 안 보이고, 사용자가 보는 것은 재방문 쪽이다. */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9680;
const OUT = path.resolve(__dirname, 'ui') + path.sep;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-boot-' + process.pid);
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

  /* ── 1차: 세이브를 만든다 (프롤로그를 넘긴다) ── */
  console.log('세이브를 만든다 (1차 방문, 프롤로그 통과)');
  await send('Page.navigate', { url:'http://localhost:8123/index.html?3d=1' });
  await sleep(13000);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1200);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1200);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2500);
  await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click(); })()`);
  await sleep(1500);
  await ev(`save()`);
  console.log('  세이브: ' + await ev(`!!localStorage.getItem('copycat.save.v1')`));

  /* ── 2차: 사용자가 보는 부팅 ── */
  console.log('\n2차 방문 — 사용자가 보는 부팅. 40ms 마다 상태를 찍는다');
  const t0 = Date.now();
  await send('Page.navigate', { url:'http://localhost:8123/index.html?3d=1' });

  const log = [];
  let dotFirst = -1, r3First = -1, shot = null;
  for (let i = 0; i < 320; i++){
    const st = await ev(`(() => {
      try {
        const gl = document.getElementById('gl'), wd = document.getElementById('world');
        const tiles = document.getElementById('tiles');
        const intro = document.body.classList.contains('introwait');
        const dotOn = !!(wd && getComputedStyle(wd).display !== 'none' && tiles && tiles.children.length > 0);
        return JSON.stringify({
          t: Math.round(performance.now()),
          도트: dotOn, 타일수: tiles ? tiles.children.length : -1,
          glBoin: !!(gl && getComputedStyle(gl).display !== 'none'),
          R3: typeof R3 !== 'undefined' && !!(R3 && R3.ready),
          검은막: intro, 화면보임: !intro && getComputedStyle(document.getElementById('app')).opacity !== '0',
        });
      } catch(e){ return null; }
    })()`);
    if (st){
      const s = JSON.parse(st);
      if (s.도트 && s.화면보임 && dotFirst < 0) dotFirst = s.t;
      if (s.R3 && r3First < 0){
        r3First = s.t;
        log.push(s);
        break;
      }
      if (log.length < 400) log.push(s);
      /* 깜빡임이 실제로 화면에 있는지 — 한가운데쯤에서 한 장 찍는다 */
      if (s.도트 && s.화면보임 && !shot){
        const p = await send('Page.captureScreenshot', { format:'png', clip:{ x:0, y:0, width:1280, height:760, scale:1 } });
        fs.writeFileSync(OUT + 'boot-dot.png', Buffer.from(p.data, 'base64'));
        shot = true;
      }
    }
    await sleep(40);
  }

  const seen = log.filter(s => s.도트 && s.화면보임);
  console.log(`  도트가 화면에 보인 첫 시각: ${dotFirst < 0 ? '없음' : dotFirst + 'ms'}`);
  console.log(`  R3.ready 가 된 시각:        ${r3First < 0 ? '안 됐다' : r3First + 'ms'}`);
  console.log(`  → 깜빡임 창: ${dotFirst >= 0 && r3First >= 0 ? (r3First - dotFirst) + 'ms' : '측정 안 됨'}`);
  console.log(`  도트가 보인 표본 ${seen.length}개 / 전체 ${log.length}개`);
  if (seen.length) console.log('  예: ' + JSON.stringify(seen[Math.floor(seen.length/2)]));
  if (shot) console.log('  그림: spike/ui/boot-dot.png  ← 깜빡임의 실물');

  ws.close(); chrome.kill();
  process.exit(seen.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
