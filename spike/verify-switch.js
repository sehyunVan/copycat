/* 벽 스위치가 실제로 눌리는가.  node spike/serve.js 먼저.

   눈으로 본 것과 손으로 되는 것은 다른 문제다. 스크린샷에는 스위치가 잘 찍혀 있어도
   광선이 안 맞으면 그건 벽에 그린 그림이다. 그래서 **화면 좌표로 진짜 클릭을 쏜다**
   (Input.dispatchMouseEvent — 게임 코드가 보기에 사람이 누른 것과 구별되지 않는다).

   재는 것 셋:
     1) 눌리는가            R3.ceiling() 이 뒤집히는가
     2) 저장되는가          S.ceil 이 따라가는가 (다시 열었을 때 꺼진 채여야 한다)
     3) 빗나가면 안 눌리는가 스위치에서 먼 벽을 눌렀을 때 그대로인가
        — 이게 없으면 "아무 데나 눌러도 불이 꺼지는" 버그를 통과시킨다
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9716;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-sw-' + process.pid);
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page; for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); const errs = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text);
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width:1400, height:860, deviceScaleFactor:1, mobile:false });
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;
  const click = async (x, y) => {
    for (const type of ['mousePressed', 'mouseReleased'])
      await send('Input.dispatchMouseEvent', { type, x, y, button:'left', clickCount:1 });
    await sleep(450);
  };

  await send('Page.navigate', { url:'http://localhost:8123/index.html?3d=1&debug=1' });
  await sleep(13000);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1200);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1200);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2400);
  await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
  await sleep(1500);

  await ev(`(() => { R3.followOn(false); R3.camReset(false); R3.fit(); R3.draw(); })()`);
  await sleep(900);
  const pos = JSON.parse(await ev(`JSON.stringify((() => {
    const w = R3.switchAt();
    return w && w.onScreen ? { x:Math.round(w.sx), y:Math.round(w.sy) } : null;
  })())`));
  if (!pos){ console.log('스위치를 못 찾았다'); process.exit(1); }
  console.log(`스위치 화면 좌표 (${pos.x}, ${pos.y})`);

  const st = async () => JSON.parse(await ev(`JSON.stringify({ on:R3.ceiling(), saved:S.ceil })`));
  const a = await st();
  await click(pos.x, pos.y);
  const b = await st();
  await click(pos.x, pos.y);
  const c = await st();
  /* 빗나간 클릭 — 스위치에서 화면상 200px 떨어진 곳. 사무실 안이지만 스위치는 아니다. */
  await click(pos.x + 200, pos.y + 60);
  const d = await st();

  const line = (t, s) => console.log(`  ${t.padEnd(16)} 천장등 ${s.on ? '켜짐' : '꺼짐'} · 저장 ${s.saved}`);
  line('처음', a); line('한 번 누름', b); line('두 번 누름', c); line('빗나간 클릭', d);

  const toggles = a.on !== b.on && b.on !== c.on;
  const saves   = (b.saved ? 1 : 0) === (b.on ? 1 : 0) && (c.saved ? 1 : 0) === (c.on ? 1 : 0);
  const misses  = d.on === c.on;
  console.log(String.fromCharCode(10) + `  눌린다 ${toggles ? 'O' : 'X'} · 저장된다 ${saves ? 'O' : 'X'} · 빗나가면 안 눌린다 ${misses ? 'O' : 'X'}`);
  const ok = toggles && saves && misses;
  console.log(`  → ${ok ? '통과' : '실패'}`);
  if (errs.length) console.log('에러:', [...new Set(errs)].slice(0,5));
  ws.close(); chrome.kill(); process.exit(ok ? 0 : 1);
})();
