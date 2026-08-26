/* 유튜브 재생만 잰다.  node spike/serve.js 먼저.

   왜 따로 있나: 앞선 측정이 두 번 헛돌았다. 링크를 넣어 두고 잠깐 쉬면 그 사이에
   onYTFail 이 쥬크박스를 다시 그리면서 **넣은 값을 지운다.** 그래서 값 넣기와
   좌표 재기와 누르기를 한 틱에 몰아 넣는다. 그리고 「걸기」는 CDP 마우스 입력으로
   진짜로 누른다 — 자동재생 정책이 원인이었으므로 사용자 활성화 없이 부르면
   측정하려는 것을 측정하지 않게 된다. */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9540;
const URL_IN = process.argv[2] || 'https://youtu.be/jNQXAC9IVRw';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // 프로필 디렉터리는 실행마다 새로 — 앞 실행의 크롬이 아직 물고 있으면 rm 이 EPERM 으로 죽는다
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-yt-' + process.pid);
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars',
    '--autoplay-policy=document-user-activation-required',
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
  const click = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type:'mousePressed', x, y, button:'left', clickCount:1 });
    await send('Input.dispatchMouseEvent', { type:'mouseReleased', x, y, button:'left', clickCount:1 });
  };

  await send('Emulation.setDeviceMetricsOverride', { width:1400, height:900, deviceScaleFactor:1, mobile:false });
  await send('Page.navigate', { url:'http://localhost:8123/index.html' });
  await sleep(11000);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1200);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1200);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2400);
  await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
  await sleep(800);

  console.log('링크: ' + URL_IN);
  await ev(`showJuke()`);
  await sleep(4000);                                  // ytWarm 이 스크립트를 받는 동안
  console.log('스크립트 도착: ' + await ev(`!!(window.YT && window.YT.Player)`));

  const btn = await ev(`(() => {
    const b = document.querySelector('#ytGo'), u = document.querySelector('#ytUrl');
    if (!b || !u) return null;
    b.scrollIntoView({ block:'center' });
    u.value = ${JSON.stringify(URL_IN)};              // 값·좌표·누르기를 한 틱에
    const r = b.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return null;
    return JSON.stringify({ x:Math.round(r.x + r.width/2), y:Math.round(r.y + r.height/2), 값:u.value });
  })()`);
  console.log('걸기: ' + btn);
  if (!btn){ console.log('❌ 「걸기」 버튼을 화면에서 못 찾았다'); ws.close(); chrome.kill(); process.exit(1); }
  const { x, y } = JSON.parse(btn);
  await click(x, y);

  let won = false;
  for (let i = 0; i < 8; i++){
    await sleep(2200);
    const st = await ev(`(() => {
      const f = document.getElementById('ytbox');
      const s = music.ytStatus();
      return JSON.stringify({ 초:${(i+1)*2.2}, 곡:music.now().id, 소리남:music.playing(),
        유튜브재생:s.playing, 실패:s.failed, 이유:s.why, 코드:s.code, 고른것:s.picked, 영상만:s.onlyVideo, 건너뜀:s.skipped,
        읽은링크:s.parsed, 상자:f ? f.tagName + ' ' + Math.round(f.getBoundingClientRect().width)
          + '×' + Math.round(f.getBoundingClientRect().height) : '없음' });
    })()`);
    console.log('  ' + st);
    if (/"유튜브재생":true/.test(st)){ won = true; break; }
    if (/"실패":true/.test(st)) break;
  }
  console.log(won ? '\n✅ 유튜브가 실제로 재생됐다' : '\n❌ 재생까지 못 갔다 — 위 이유를 본다');
  ws.close(); chrome.kill(); process.exit(won ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
