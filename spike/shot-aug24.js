/* 41 · 36 · 42 를 눈으로 확인하는 그림. node spike/serve.js 먼저.
   재는 것은 spike/verify-aug24.js 가 한다 — 이 파일은 **모양**을 보는 것이다:
   오락기가 오락기로 읽히는지, 말풍선이 머리 위에 뜨는지, 아침이 어슴푸레한지. */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9526;
const OUT = path.resolve(__dirname, 'ui') + path.sep;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-shot24');
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
  ws.addEventListener('message', e => { const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); } });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;
  const W = 1400, H = 880;
  const shot = async name => {
    const s = await send('Page.captureScreenshot', { format:'png', clip:{x:0,y:0,width:W,height:H,scale:1} });
    fs.writeFileSync(OUT + name, Buffer.from(s.data, 'base64'));
    console.log('  ' + name);
  };

  await send('Emulation.setDeviceMetricsOverride', { width:W, height:H, deviceScaleFactor:1, mobile:false });
  await send('Page.navigate', { url:'http://localhost:8123/index.html?3d=1&debug=1' });
  await sleep(11000);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1200);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1200);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2200);
  await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click(); })()`);
  await sleep(800);

  /* 오락기를 문 맞은편 벽 앞에 놓고, 고양이 셋을 그 앞에 세운다.
     격자를 직접 만지는 이유: 상점의 배치기는 자리를 난수로 고르므로
     같은 그림이 다시 안 나온다(그림은 다시 찍을 수 있어야 그림이다). */
  await ev(`(() => {
    S.tier = 4; S.anchovy = 999999;
    while (S.cats.length < 4 && deskCount() > S.cats.length){
      const c = newCat('냥' + S.cats.length); c.rec = newRecord(1); S.cats.push(c);
    }
    assignDesks();
    /* 위쪽 벽에 붙은 빈 바닥 한 칸 */
    let cell = null;
    for (let x = 2; x < W.W - 2 && !cell; x++)
      if (W.grid[1*W.W+x] === TILE.FLOOR) cell = { x, y:1 };
    if (cell){
      W.grid[cell.y*W.W+cell.x] = TILE.GAME;
      /* 시설 목록에도 손으로 넣는다 — 상점의 placeFurniture 가 하는 그 일이다.
         안 넣으면 고양이가 이 가구를 못 찾고, 그러면 말풍선 그림도 못 찍는다. */
      const use = TILE_INFO[TILE.GAME].use;
      (W.facilities[use] = W.facilities[use] || []).push({ x:cell.x, y:cell.y });
    }
    renderTiles();
    window.__gcell = cell;
    return cell;
  })()`);
  await sleep(1600);

  /* 카메라를 오락기 앞으로 — 32번(첫 출근 안내)이 쓰는 방식과 같은 각 */
  await ev(`(() => {
    const c = window.__gcell;
    if (!c) return;
    R3.followOn(false);
    const az = Math.atan2(W.H/2 - (c.y+0.5), W.W/2 - (c.x+0.5));
    R3.camSet({ az, el:0.52, zoom:0.42, at:{ x:c.x, y:c.y, up:0.7 } });
    R3.draw();
  })()`);
  await sleep(900);
  await shot('aug24-arcade.png');

  /* 말풍선 — 고양이 셋을 오락기·CD 플레이어·자는 자리에 세우고 동시에 말하게 한다 */
  await ev(`(async () => {
    const cellOf = t => { for (let y=0;y<W.H;y++) for (let x=0;x<W.W;x++)
      if (W.grid[y*W.W+x] === t) return { x, y }; return null; };
    const g = window.__gcell;
    const spots = [g, cellOf(TILE.JUKE), cellOf(TILE.COOLER)].filter(Boolean);
    S.cats.forEach((c, i) => {
      const s = spots[i % spots.length];
      /* 오락기·CD 플레이어 앞 칸에 세운다 — 가구 칸 자체가 아니라 그 앞이다 */
      c.x = s.x; c.y = Math.min(W.H - 2, s.y + 1);
      c.act = { s:'use', t:0, use:{ x:s.x, y:s.y } };
      c._bubble = 0;
    });
    syncActors();
    R3.draw();
    await new Promise(r => requestAnimationFrame(r));
    S.cats.forEach(c => sayDoing(c));
    R3.camSet({ zoom:0.62 });
    R3.draw();
  })()`);
  await sleep(700);
  await ev(`R3.draw()`);
  const said = await ev(`JSON.stringify([...document.querySelectorAll('.bubble')].map(b => b.textContent))`);
  console.log('  말풍선: ' + said);
  await shot('aug24-bubbles.png');

  /* 37 — 직원 카드의 막대 이름. 하나는 일부러 낮춰서 붉어지는 것까지 본다 */
  await ev(`(() => {
    S.tier = 4; S.anchovy = 999999;
    while (S.cats.length < 3 && deskCount() > S.cats.length){
      const c = newCat('냥' + S.cats.length); c.rec = newRecord(1); S.cats.push(c);
    }
    assignDesks();
    S.cats[0].needs.energy = 14;
    if (S.cats[1]) S.cats[1].needs.bladder = 21;
    setCol('staff'); renderRight();
  })()`);
  await sleep(600);
  await shot('aug24-needbars.png');

  /* 42 — 아침과 낮을 같은 각에서 나란히 */
  for (const k of ['morning', 'day', 'night']){
    await ev(`(async () => { setSkyForce('${k}'); renderNight(); R3.draw();
      await new Promise(r => requestAnimationFrame(r)); R3.draw(); })()`);
    await sleep(500);
    await shot('aug24-sky-' + k + '.png');
  }
  await ev(`setSkyForce(null); renderNight();`);

  ws.close(); chrome.kill();
  process.exit(0);
})();
