/* 조명 기구를 늘린 게 실제로 「시간대 상관없이 확실하고 아늑하게」인지 잰다.
   node spike/serve.js 먼저.

     node spike/verify-cozy.js          지금 코드
     node spike/verify-cozy.js before   HEAD 의 두 파일로 되돌려서 같은 것을 잰다(끝나면 자동 복구)

   ── 무엇을 재는가 ──

   「아늑하다」를 직접 잴 수는 없다. 대신 레퍼런스 그림에서 뜯어낸 구조를 잰다:
   그 그림이 아늑한 이유는 화면이 밝아서가 아니라 **밝은 덩어리가 여러 군데 흩어져
   있어서**였다.

   **첫 판은 「따뜻하고 밝은 화소」를 셌다가 버렸다.** r−b 로 따뜻함을 재면 밤 칸에서
   0.66% 가 나온다 — 실패가 아니라 **밤 그레이드가 화면을 파랗게 물들이도록 일부러
   짜여 있기 때문**이다(eerie 의 딥 블루 나이트, 듀오톤 tintAmt 0.40). 색은 그레이드가
   가진 손잡이라, 색으로 조명을 재면 조명이 아니라 그레이드를 재게 된다.
   verify-lamp.js 가 「의도한 어둠과 정보 손실을 구별 못 한다」며 2판을 버린 것과
   같은 함정이고, 같은 방향으로 빠져나간다: **장면 제 밝기를 기준으로 잰다.**

     lit    제 중앙값보다 14 이상 밝은 화소의 비율. 14 는 후처리의 색 단계 셋쯤이라
            (화면이 22단계로 눌린다 · eerie uLevels) 「눈에 띄게 밝다」의 하한이다.
            기준이 장면 안에 있으므로 노출·채도를 어떻게 잡든 지표가 안 흔들린다.
     pools  그 화소들이 이루는 **덩어리 수**. lit 이 같아도 한 덩어리면 「밝은 방」이고
            여덟 덩어리면 「등이 여덟 개 켜진 방」이다. 이번 수정의 본론이 여기다.
     spread 밝기 폭(p90−p10). 웅덩이가 생기려면 어두운 데가 남아 있어야 한다 —
            이 값이 같이 안 오르면 등을 늘린 게 아니라 노출을 올린 것이다.
     warm   따뜻하고 밝은 화소 비율. **판정에 안 쓴다** — 위의 이유로 그레이드를
            반영할 뿐이다. 낮 칸에서 등이 실제로 노랗게 도는지 보는 데는 쓸모가 있다.

   ── 판정 ──

   다섯 시간대 **전부**에서 lit ≥ 6% 이고 pools ≥ 6 이면 통과.
   「전부」가 요구사항의 절반이다: 밤에만 예쁜 조명은 이 게임에서 쓸모가 없다.
   spread 는 앞판보다 안 떨어지기만 하면 된다 — 떨어졌다면 등을 늘린 게 아니라
   노출을 올린 것이고, 그러면 웅덩이가 아니라 밝은 방이 된다.

   문 표시등은 이 스크립트가 안 건드린다. 그쪽은 코드에서 한 줄도 안 바뀌었고,
   섞이면 안 되는 물건이라는 판단이 render3d 의 buildCozy 머리말에 적혀 있다.

   출력: C:/tmp/copycat-cozy/*.png
*/
const fs = require('fs'), path = require('path'), { spawn, execSync } = require('child_process');
const BEFORE = process.argv[2] === 'before';
const PORT = 9721, OUT = 'C:/tmp/copycat-cozy/', W = 1400, H = 860;
const FILES = ['js/render3d.js', 'js/three/lowpoly.js'];
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROOT = path.resolve(__dirname, '..');

/* 다섯 단계가 제 모습인 시각 — shot-day.js 와 같은 값이다 */
const PEAKS = [[8.1, '1-아침'], [11.5, '2-오전'], [15.5, '3-오후'], [18.9, '4-더오후'], [23.0, '5-밤']];

/* 화면을 뜯어 지표를 낸다. **캔버스를 3으로 줄여서** 잰다 — 덩어리 세기가 화소 수에
   선형이고, 줄여도 웅덩이는 웅덩이다(오히려 필름 그레인이 죽어서 낫다). */
const MEASURE = `(() => {
  /* **여기서 그린다.** draw 를 딴 호출에 두면 안 된다 — WebGL 캔버스가
     preserveDrawingBuffer 없이 만들어져서 프레임이 넘어가면 그림틀이 비고,
     그러면 drawImage 가 새까만 판을 가져온다(실제로 한 시간대만 0 이 나왔다). */
  R3.draw();
  const cv = document.getElementById('gl');
  const S3 = 3, w = Math.floor(cv.width / S3), h = Math.floor(cv.height / S3);
  const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
  const cx = c2.getContext('2d', { willReadFrequently:true });
  cx.drawImage(cv, 0, 0, w, h);
  const d = cx.getImageData(0, 0, w, h).data;
  const n = w * h;
  const L = new Float32Array(n), warm = new Uint8Array(n);
  for (let i = 0; i < n; i++){
    const r = d[i*4], g = d[i*4+1], b = d[i*4+2];
    L[i] = (0.299*r + 0.587*g + 0.114*b) / 2.55;      // 0~100
    warm[i] = (L[i] >= 55 && (r - b) >= 22) ? 1 : 0;
  }
  const sorted = Float32Array.from(L).sort();
  const q = p => sorted[Math.floor(p * (n - 1))];
  const med = q(0.5), hi = med + 14;                  // 장면 제 밝기를 기준으로
  const lit = new Uint8Array(n);
  for (let i = 0; i < n; i++) lit[i] = L[i] >= hi ? 1 : 0;
  /* 덩어리 세기 — 4이웃 연결. 30칸(줄인 화면에서) 미만은 알갱이로 보고 버린다. */
  const seen = new Uint8Array(n), stack = new Int32Array(n);
  let pools = 0, biggest = 0;
  for (let i = 0; i < n; i++){
    if (!lit[i] || seen[i]) continue;
    let sp = 0, area = 0;
    stack[sp++] = i; seen[i] = 1;
    while (sp){
      const j = stack[--sp]; area++;
      const x = j % w, y = (j / w) | 0;
      if (x > 0   && lit[j-1] && !seen[j-1]){ seen[j-1]=1; stack[sp++]=j-1; }
      if (x < w-1 && lit[j+1] && !seen[j+1]){ seen[j+1]=1; stack[sp++]=j+1; }
      if (y > 0   && lit[j-w] && !seen[j-w]){ seen[j-w]=1; stack[sp++]=j-w; }
      if (y < h-1 && lit[j+w] && !seen[j+w]){ seen[j+w]=1; stack[sp++]=j+w; }
    }
    if (area >= 30){ pools++; if (area > biggest) biggest = area; }
  }
  let ln = 0, wn = 0;
  for (let i = 0; i < n; i++){ ln += lit[i]; wn += warm[i]; }
  return JSON.stringify({
    lit: +(ln / n * 100).toFixed(2),
    pools,
    biggest: +(biggest / n * 100).toFixed(2),
    warm: +(wn / n * 100).toFixed(2),
    med: +med.toFixed(1),
    spread: +(q(0.9) - q(0.1)).toFixed(1),
  });
})()`;

(async () => {
  fs.mkdirSync(OUT, { recursive:true });
  /* before 판은 작업본을 잠깐 치우고 HEAD 로 돌린다. **복사본을 먼저 뜬다** —
     git checkout 은 되돌릴 수 없고, 이 스크립트가 중간에 죽으면 작업이 날아간다. */
  let stashed = false;
  if (BEFORE){
    FILES.forEach(f => fs.copyFileSync(path.join(ROOT, f), path.join(OUT, path.basename(f) + '.keep')));
    execSync('git checkout HEAD -- ' + FILES.join(' '), { cwd: ROOT });
    stashed = true;
  }
  const restore = () => {
    if (!stashed) return;
    FILES.forEach(f => fs.copyFileSync(path.join(OUT, path.basename(f) + '.keep'), path.join(ROOT, f)));
    stashed = false;
    console.log('(작업본 복구)');
  };
  process.on('exit', restore);
  process.on('SIGINT', () => { restore(); process.exit(1); });
  process.on('uncaughtException', e => { restore(); console.error(e); process.exit(1); });

  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-cozy-' + process.pid);
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
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text
      || (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description));
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

  /* 큰 사무실로 본다. 등급 1 짜리 방은 벽이 짧아 전구줄이 한 번밖에 안 처지고 구석이
     적어 스탠드가 하나밖에 안 선다 — 늘린 것이 안 늘어난 화면을 재게 된다. */
  console.log(await ev(`(() => {
    S.tier = 3; S.seed = 4242; S.anchovy = 999999;
    SHOP.forEach(it => { if (it.tier <= S.tier) S.shop[it.id] = 1; });
    buildWorld(true);
    while (S.cats.length < 8 && deskCount() > S.cats.length){
      const c = newCat('냥' + S.cats.length); c.rec = newRecord(1); S.cats.push(c);
    }
    assignDesks(); renderTiles();
    S.cats.forEach(c => { c.needs.energy=85; c.needs.bladder=85; c.needs.caffeine=85; c.needs.fun=85; });
    document.querySelectorAll('.panel,#topbar,#colTabs,.stagefoot,.clockchip,.foldbtn,.cambtn')
      .forEach(e => e.style.display='none');
    const vp=document.getElementById('viewport'); vp.style.position='fixed'; vp.style.inset='0'; vp.style.zIndex='9999';
    R3.followOn(false); R3.camReset(false); R3.camSet({ zoom:0.42 }); R3.fit();
    return JSON.stringify({ 사무실:W.W+'×'+W.H, 고양이:S.cats.length, 빛:R3.skyInfo() });
  })()`));
  await sleep(5000);

  /* **광원이 쌓이지 않는가.** 사무실은 가구를 하나 옮길 때마다 통째로 다시 서고
     (renderTiles), 그때 옛 점광원을 안 걷으면 조용히 겹쳐 쌓인다 — 등이 82개까지
     가서 사무실이 버벅이던 사고가 이 파일 바깥에 이미 한 번 있었다(TODO 52).
     기구를 다섯 종류나 늘렸으니 같은 함정이 다섯 배로 커졌다. 열 번 다시 세워 본다. */
  const leak = JSON.parse(await ev(`(() => {
    const out = [];
    for (let i = 0; i < 10; i++){ renderTiles(); renderNight(); R3.draw(); out.push(R3.skyInfo().새등수); }
    return JSON.stringify(out);
  })()`));
  const grew = leak.some(v => v !== leak[0]);
  console.log(`  다시 세우기 10회 · 새 점광원 ${leak.join(',')} → ${grew ? 'X 샌다' : 'OK 안 쌓인다'}`);

  const rows = [];
  for (const [hour, name] of PEAKS){
    await ev(`(() => { setSkyForce(''); setSkyAt(${hour}); renderNight(); R3.draw(); })()`);
    await sleep(420);
    const m = JSON.parse(await ev(MEASURE));
    rows.push([name, m]);
    const p = await send('Page.captureScreenshot', { format:'png', clip:{x:0,y:0,width:W,height:H,scale:1} });
    fs.writeFileSync(OUT + (BEFORE ? 'before-' : 'after-') + name + '.png', Buffer.from(p.data,'base64'));
  }

  console.log('\n  시간대         lit%   웅덩이   최대덩이%    warm%   중앙밝기   밝기폭');
  rows.forEach(([n, m]) => console.log(
    `  ${n.padEnd(10)}  ${String(m.lit).padStart(5)}  ${String(m.pools).padStart(6)}  ${String(m.biggest).padStart(9)}  ${String(m.warm).padStart(7)}  ${String(m.med).padStart(8)}  ${String(m.spread).padStart(7)}`));

  const bad = rows.filter(([, m]) => m.lit < 6 || m.pools < 6);
  console.log(bad.length
    ? '\n  X 모자란 시간대: ' + bad.map(([n, m]) => `${n}(lit ${m.lit} · 웅덩이 ${m.pools})`).join(', ')
    : '\n  OK 다섯 시간대 전부 lit >= 6% · 웅덩이 >= 6');
  fs.writeFileSync(OUT + (BEFORE ? 'before' : 'after') + '.json', JSON.stringify(rows, null, 1));
  if (errs.length) console.log('에러:', [...new Set(errs)].slice(0, 5));
  ws.close(); chrome.kill();
  restore();
  process.exit(0);
})();
