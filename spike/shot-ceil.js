/* 천장등과 블라인드를 눈으로 확인한다.  node spike/serve.js 먼저.

   네 장을 찍는다: 큰 사무실(냥타워)에서 천장등 켜짐/꺼짐, 밤과 낮.
   끈 화면이 필요한 이유 — 스위치는 **끈 뒤의 화면이 볼 만해야** 값어치가 있다.
   불을 끄면 그냥 안 보이는 방이 되는 거면 그건 스위치가 아니라 고장이다.

   실행: node spike/shot-ceil.js
   출력: C:/tmp/copycat-tone/ceil-{on|off}-{day|night}.png
*/
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9715, OUT = 'C:/tmp/copycat-tone/', W = 1400, H = 860;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-ceil-' + process.pid);
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
  await send('Emulation.setDeviceMetricsOverride', { width:W, height:H, deviceScaleFactor:1, mobile:false });
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;

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
  await sleep(900);
  console.log(await ev(`(() => {
    S.tier = 4; S.seed = 4242; S.anchovy = 999999;
    SHOP.forEach(it => { if (it.tier <= S.tier) S.shop[it.id] = 1; });
    buildWorld(true);
    while (S.cats.length < 20 && deskCount() > S.cats.length){
      const c = newCat('냥' + S.cats.length); c.rec = newRecord(1); S.cats.push(c);
    }
    assignDesks(); renderTiles();
    S.cats.forEach(c => { c.needs.energy=85; c.needs.bladder=85; c.needs.caffeine=85; c.needs.fun=85; });
    document.querySelectorAll('.panel,#topbar,#colTabs,.stagefoot,.clockchip,.foldbtn,.cambtn')
      .forEach(e => e.style.display='none');
    const vp=document.getElementById('viewport'); vp.style.position='fixed'; vp.style.inset='0'; vp.style.zIndex='9999';
    R3.camReset(false); R3.camSet({ zoom:0.62 }); R3.fit();
    return JSON.stringify({ 사무실:W.W+'×'+W.H, 고양이:S.cats.length, 천장등:R3.ceiling() });
  })()`));
  await sleep(5000);

  /* 스위치가 화면 어디에 찍혔는지 — 크롭해서 눈으로 확인하려면 좌표가 필요하다.
     방마다 자리가 다르므로(서쪽 벽 남쪽 끝) 게임에게 직접 물어본다. */
  console.log('  스위치: ' + await ev(`JSON.stringify((() => {
    const w = R3.switchAt(); if (!w) return null;
    const p = R3.project(w.x, w.z, w.y);
    return { 방:[+w.x.toFixed(2), +w.z.toFixed(2)], 화면: p ? [Math.round(p.x), Math.round(p.y)] : null };
  })())`));

  for (const [t, tl] of [['day','day'], ['night','night']]){
    await ev(`setSkyForce('${t}')`); await sleep(900);
    for (const on of [true, false]){
      await ev(`R3.setCeiling(${on}); renderNight(); R3.draw();`);
      await sleep(700);
      await ev(`R3.draw()`);
      const p = await send('Page.captureScreenshot', { format:'png', clip:{x:0,y:0,width:W,height:H,scale:1} });
      const f = OUT + `ceil-${on ? 'on' : 'off'}-${tl}.png`;
      fs.writeFileSync(f, Buffer.from(p.data,'base64'));
      console.log('  ' + path.basename(f));
    }
  }
  if (errs.length) console.log('에러:', [...new Set(errs)].slice(0,5));
  ws.close(); chrome.kill(); process.exit(0);
})();
