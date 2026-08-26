/* 사내 소식 — 사보에 오는 잡담이 **실제로 뜨는지**, 이름이 진짜 이름인지.

   난수로 뿌리는 게 아니라 `cat:use`(가구에 **도착한 순간**)에 붙어 있으므로,
   검사도 가구에 도착시켜서 잰다. 두 마리짜리 줄은 **같은 칸에 둘이 있을 때만**
   나와야 한다 — 그게 「둘이 야차를 떴다」를 참으로 만드는 조건이다.

   node spike/serve.js 를 먼저 띄운다.  node spike/verify-gossip.js */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const PORT = 9607;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (n, good, d) => { (good ? pass++ : fail++); console.log(`  ${good ? '✅' : '❌'} ${n}${d === undefined ? '' : '   ' + d}`); };

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-gossip');
  fs.rmSync(dir, { recursive:true, force:true });
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });
  let page; for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch{}
    if (!page) await sleep(250);
  }
  if (!page){ console.log('크롬을 못 띄웠다'); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl); let id = 0; const pend = new Map();
  let errs = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => { const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errs.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' ')); });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => (await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true })).result?.value;
  await send('Emulation.setDeviceMetricsOverride', { width:1400, height:900, deviceScaleFactor:1, mobile:false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try { localStorage.clear(); } catch(e){}' });
  await send('Page.navigate', { url: BASE + '/index.html?3d=1&debug=1' });
  for (let i = 0; i < 200; i++){ if (await ev(`document.body.classList.contains('r3ready')`)) break; await sleep(200); }
  await sleep(1500);
  await ev(`(() => { if (window.CCOpen && CCOpen.playing()) CCOpen.jump('letter'); })()`);
  await sleep(1100);
  await ev(`(() => { const b=document.querySelector('#oLetterGo'); if (b) b.click(); })()`);
  await sleep(1100);
  await ev(`(() => { const g=document.querySelector('#cnGo'); if (g) g.click(); })()`);
  await sleep(2200);
  await ev(`(() => { const b=document.querySelector('.coach [data-tut="skip"]'); if (b) b.click(); })()`);
  await sleep(800);
  await ev(`(() => {
    S.tier = 3; S.anchovy = 9999999;
    buildWorld(true);
    while (S.cats.length < 4 && deskCount() > S.cats.length){
      const c = newCat('냥' + S.cats.length); c.rec = newRecord(1); S.cats.push(c);
    }
    /* 받침 있는 이름과 없는 이름을 하나씩 — 조사가 갈리는지 본다 */
    S.cats[0].name = '치즈'; S.cats[1].name = '냥1';
    ['snack','feeder','copier','game','scratch','tower','meeting'].forEach(x => { try { buyItem(x); } catch(e){} });
    [TILE.SNACK, TILE.COPIER, TILE.SCRATCH, TILE.MEETING].forEach(t => {
      if (W.grid.includes(t)) return;
      for (let y = 2; y < W.H-2; y++) for (let x = 2; x < W.W-2; x++)
        if (W.grid[y*W.W+x] === TILE.FLOOR && !W.desks.some(d => d.seat.x===x && d.seat.y===y)){
          W.grid[y*W.W+x] = t; return;
        }
    });
    snapshotWorld();
    assignDesks(); renderTiles();
    document.querySelectorAll('.veil,.coach,.coachring').forEach(e => e.remove());
    return 1;
  })()`);
  await sleep(1200);

  console.log('\n── 사내 소식 ──');
  const one = await ev(`(() => {
    const cellOf = t => { for (let y=0;y<W.H;y++) for (let x=0;x<W.W;x++)
      if (W.grid[y*W.W+x] === t) return { x, y }; return null; };
    const out = [];
    for (const [name, tile] of [['간식바',TILE.SNACK],['복사기',TILE.COPIER],['스크래처',TILE.SCRATCH]]){
      const cell = cellOf(tile);
      if (!cell){ out.push({ name, 가구:'없음' }); continue; }
      const c = S.cats[0];
      let hit = null;
      for (let i = 0; i < 60 && !hit; i++){
        gossipAt = 0;
        c.act = { s:'use', t:0, use:cell };
        const before = S.log.length;
        bus.emit('cat:use', { cat:c, tile });
        if (S.log.length > before) hit = S.log[S.log.length-1].t;
      }
      out.push({ name, 줄: hit });
    }
    return JSON.stringify(out);
  })()`);
  const O = JSON.parse(one);
  O.forEach(r => console.log('   ' + r.name + ' → ' + (r.줄 || r.가구 || '안 뜸')));
  ok('한 마리짜리 잡담이 뜬다', O.every(r => r.줄), O.filter(r => !r.줄).map(r => r.name).join(' ') || '');
  ok('실제 이름이 들어간다', O.some(r => r.줄 && r.줄.indexOf('치즈') >= 0));
  ok('조사가 받침을 본다 (치즈**가**)', O.some(r => r.줄 && /치즈<\/b>가/.test(r.줄)),
     (O.find(r => r.줄 && r.줄.indexOf('치즈') >= 0) || {}).줄);

  /* 두 마리짜리 — 회의 탁자에 둘을 같이 보낸다. 혼자면 안 떠야 한다 */
  const two = await ev(`(() => {
    const cellOf = t => { for (let y=0;y<W.H;y++) for (let x=0;x<W.W;x++)
      if (W.grid[y*W.W+x] === t) return { x, y }; return null; };
    const cell = cellOf(TILE.MEETING);
    if (!cell) return JSON.stringify({ 가구:false });
    const a = S.cats[0], b = S.cats[1];
    b.act = { s:'idle', t:0, use:null };
    let alone = 0;
    for (let i = 0; i < 60; i++){
      gossipAt = 0;
      a.act = { s:'use', t:0, use:cell };
      const n = S.log.length;
      bus.emit('cat:use', { cat:a, tile: TILE.MEETING });
      if (S.log.length > n) alone++;
    }
    b.act = { s:'use', t:0, use:cell };
    let both = null;
    for (let i = 0; i < 60 && !both; i++){
      gossipAt = 0;
      const n = S.log.length;
      bus.emit('cat:use', { cat:a, tile: TILE.MEETING });
      if (S.log.length > n) both = S.log[S.log.length-1].t;
    }
    return JSON.stringify({ 가구:true, 혼자: alone, 둘: both });
  })()`);
  const T = JSON.parse(two);
  console.log('   ' + JSON.stringify(T));
  ok('회의 탁자에 혼자면 안 뜬다', T.가구 && T.혼자 === 0, '뜬 횟수 ' + T.혼자);
  ok('둘이 붙어 있으면 뜬다', T.가구 && !!T.둘, T.둘);
  ok('둘 다 실제 이름이 들어간다', !!T.둘 && T.둘.indexOf('치즈') >= 0 && T.둘.indexOf('냥1') >= 0);
  ok('받침 없는 이름에 「와」가 붙는다 (치즈와)', !!T.둘 && /치즈<\/b>와/.test(T.둘));

  /* 자주 안 뜬다 — 한 번 뜨면 한동안 조용해야 한다 */
  const gap = await ev(`(() => {
    const cellOf = t => { for (let y=0;y<W.H;y++) for (let x=0;x<W.W;x++)
      if (W.grid[y*W.W+x] === t) return { x, y }; return null; };
    const cell = cellOf(TILE.SNACK);
    gossipAt = 0;
    const c = S.cats[0];
    c.act = { s:'use', t:0, use:cell };
    let n = 0;
    for (let i = 0; i < 400; i++){
      const before = S.log.length;
      bus.emit('cat:use', { cat:c, tile: TILE.SNACK });
      if (S.log.length > before) n++;
    }
    return n;
  })()`);
  console.log('   400번 도착시켜 뜬 줄 ' + gap + '개');
  ok('한 번 뜨면 한동안 조용하다', gap === 1, gap + '개');

  const bad = errs.filter(e => !/favicon|Failed to load resource/i.test(e));
  ok('콘솔 오류 0', bad.length === 0, bad.slice(0,2).join(' | '));
  console.log(`\n${pass} 통과 · ${fail} 실패`);
  ws.close(); chrome.kill();
  process.exit(fail ? 1 : 0);
})();
