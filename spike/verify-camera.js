/* 카메라 좌·우 뒤집기 검증.  node spike/serve.js 먼저.

   안내문만 고치고 동작을 안 고치면 화면이 하는 말과 손이 하는 일이 갈린다.
   그래서 실제로 누르고 끌어 보고 **카메라 상태가 어느 쪽으로 움직였는지** 잰다:

     look(x,z)  이 움직였다  → 팬
     cam.az/el  이 움직였다  → 회전

   기대:
     왼쪽 드래그        팬
     오른쪽 드래그      회전
     Shift+왼쪽 드래그  회전
     한 손가락          팬
     두 손가락          회전 (+ 벌리면 줌)
     움직임 없는 왼쪽 클릭 → 아무것도 안 움직인다 (쓰다듬기가 살아 있다)
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9640;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-cam-' + process.pid);
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page; for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
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

  await send('Emulation.setDeviceMetricsOverride', { width:1400, height:860, deviceScaleFactor:1, mobile:false });
  await send('Page.navigate', { url:'http://localhost:8123/index.html?3d=1' });
  await sleep(12000);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1200);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1200);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2200);
  await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click();
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e=>e.remove()); })()`);
  await sleep(1500);

  /* 추적이 켜져 있으면 카메라가 스스로 움직여서 측정이 안 된다 */
  await ev(`R3.followOn(false)`);
  await sleep(600);

  const state = async () => JSON.parse(await ev(`(() => { const d = R3.debug();
    return JSON.stringify({ look:[+d.look[0].toFixed(3), +d.look[2].toFixed(3)],
      az:+d.cam.az.toFixed(4), el:+d.cam.el.toFixed(4), zoom:+d.cam.zoom.toFixed(4) }); })()`));

  const X = 900, Y = 470;                      // 기둥 패널을 피해 무대 오른쪽
  const mouse = (type, x, y, button, mods) => send('Input.dispatchMouseEvent',
    { type, x, y, button: button || 'none', buttons: type === 'mouseMoved' && button ? (button === 'right' ? 2 : 1) : (button === 'right' ? 2 : button === 'left' ? 1 : 0),
      clickCount: type === 'mousePressed' ? 1 : 0, modifiers: mods || 0 });
  const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts });

  const runs = [];
  const drag = async (label, fn) => {
    const a = await state();
    await fn();
    await sleep(400);
    const b = await state();
    const dLook = Math.hypot(b.look[0] - a.look[0], b.look[1] - a.look[1]);
    const dRot = Math.abs(b.az - a.az) + Math.abs(b.el - a.el);
    const dZoom = Math.abs(b.zoom - a.zoom);
    runs.push({ label, dLook:+dLook.toFixed(3), dRot:+dRot.toFixed(4), dZoom:+dZoom.toFixed(4) });
    return { dLook, dRot, dZoom };
  };
  const mdrag = (button, mods) => async () => {
    await mouse('mousePressed', X, Y, button, mods);
    for (let i = 1; i <= 6; i++) await mouse('mouseMoved', X - i * 14, Y + i * 5, button, mods);
    await mouse('mouseReleased', X - 84, Y + 30, button, mods);
  };

  let fail = 0;
  const ok = (c, label, extra) => { if (!c) fail++; console.log(`  ${c ? 'OK  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`); };

  console.log('\n── 마우스 ──');
  let r = await drag('왼쪽 드래그', mdrag('left'));
  ok(r.dLook > 0.3 && r.dRot < 0.0005, '왼쪽 드래그 = 팬', `look ${r.dLook.toFixed(2)} / rot ${r.dRot.toFixed(4)}`);

  r = await drag('오른쪽 드래그', mdrag('right'));
  ok(r.dRot > 0.05 && r.dLook < 0.05, '오른쪽 드래그 = 회전', `look ${r.dLook.toFixed(2)} / rot ${r.dRot.toFixed(4)}`);

  r = await drag('Shift+왼쪽', mdrag('left', 8));    // 8 = Shift
  ok(r.dRot > 0.05 && r.dLook < 0.05, 'Shift+왼쪽 = 회전', `look ${r.dLook.toFixed(2)} / rot ${r.dRot.toFixed(4)}`);

  r = await drag('가만히 왼쪽 클릭', async () => {
    await mouse('mousePressed', X, Y, 'left');
    await mouse('mouseReleased', X, Y, 'left');
  });
  ok(r.dLook < 0.01 && r.dRot < 0.0005, '안 움직인 클릭은 카메라를 안 건드린다 (쓰다듬기 살아 있음)');

  console.log('\n── 터치 ──');
  r = await drag('한 손가락', async () => {
    await touch('touchStart', [{ x:X, y:Y, id:1 }]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x:X - i * 14, y:Y + i * 5, id:1 }]);
    await touch('touchEnd', []);
  });
  ok(r.dLook > 0.3 && r.dRot < 0.0005, '한 손가락 = 팬', `look ${r.dLook.toFixed(2)} / rot ${r.dRot.toFixed(4)}`);

  r = await drag('두 손가락(평행 이동)', async () => {
    await touch('touchStart', [{ x:X - 60, y:Y, id:1 }, { x:X + 60, y:Y, id:2 }]);
    for (let i = 1; i <= 6; i++)
      await touch('touchMove', [{ x:X - 60 - i * 12, y:Y + i * 4, id:1 }, { x:X + 60 - i * 12, y:Y + i * 4, id:2 }]);
    await touch('touchEnd', []);
  });
  ok(r.dRot > 0.05 && r.dLook < 0.05, '두 손가락 = 회전', `look ${r.dLook.toFixed(2)} / rot ${r.dRot.toFixed(4)}`);

  r = await drag('두 손가락(벌리기)', async () => {
    await touch('touchStart', [{ x:X - 40, y:Y, id:1 }, { x:X + 40, y:Y, id:2 }]);
    for (let i = 1; i <= 6; i++)
      await touch('touchMove', [{ x:X - 40 - i * 14, y:Y, id:1 }, { x:X + 40 + i * 14, y:Y, id:2 }]);
    await touch('touchEnd', []);
  });
  ok(r.dZoom > 0.005, '벌리면 줌', `zoom ${r.dZoom.toFixed(4)}`);

  console.log('\n── 안내문이 동작과 같은 말을 하나 ──');
  const txt = await ev(`(() => {
    $('#btnHelp').click();
    const t = document.querySelector('.veil .mbody').textContent;
    document.querySelector('.veil [data-close]').click();
    return t;
  })()`);
  ok(/드래그<?\/?b?>?로\s*화면을 끌어 옮기|드래그.{0,12}화면을 끌어 옮기/.test(txt.replace(/\s+/g, ' '))
     || txt.includes('화면을 끌어 옮기고'), '사규: 드래그 = 이동');
  ok(txt.includes('시점을 돌립니다'), '사규: 오른쪽 드래그 = 회전');
  const tip = await ev(`(() => { const b = document.querySelector('#btnCam'); return b ? b.title : ''; })()`);
  ok(!/드래그 회전/.test(tip), '🎥 버튼 설명에 옛 문구가 안 남았다', tip.slice(0, 46));

  console.log('\n측정값: ' + JSON.stringify(runs));
  console.log('오류: ' + (errs.length ? errs.slice(0, 3).join(' | ') : '없음'));
  if (errs.length) fail++;
  console.log(fail ? `\n${fail}건 실패` : '\n전부 통과');
  ws.close(); chrome.kill(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
