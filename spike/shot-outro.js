/* ============================================================
   shot-outro.js — 아웃트로를 찍는다. **게임 안에서** 돌린다.

   node spike/serve.js 먼저.
     node spike/shot-outro.js                 GIF + 정지 12장 + 시작화면
     KEYS_ONLY=1 node spike/shot-outro.js     정지 장면만 (프레이밍 잡을 때)
     OUT_W=640 OUT_FPS=12 node spike/shot-outro.js

   출력  spike/dist/shots/outro.gif        움직이는 것
         spike/dist/shots/outro-keys.png   정지 12장 (큰 화면)
         spike/dist/shots/outro-title.png  엔딩을 본 사람의 시작화면

   ── 왜 시안 페이지가 아니라 게임인가 ──
   첫 컷에 나오는 사무실이 **진짜 그 방**이어야 한다(사람이 산 가구 · 바른 벽지 ·
   앉아 있는 고양이 · 고른 간판). 시안으로 따로 세우면 그 방을 처음부터 다시 만들어야
   하고, 그 순간부터 두 방은 서로 달라지기 시작한다. 그래서 index.html 을 열고,
   사무실을 키우고(등급·비품·고양이), R3.outroBuild / outroSeek 로 시각을 직접 준다.

   ── 왜 시간을 직접 주나 ──
   실시간으로 흘려 두고 찍으면 프레임 간격이 기계 사정에 따라 들쭉날쭉해져서 GIF 가
   흔들린다. 프레임 번호로 시각을 계산해 한 장씩 그린다 — 같은 명령이면 같은 그림이다.

   ── 왜 캔버스를 직접 떠 오나 ──
   CDP 의 captureScreenshot 은 늘 다른 태스크에서 돌고, 그 사이 WebGL 그림틀은 비어 있다
   (verify-icons.js 머리말에 같은 함정을 적어 뒀다). 그래서 **그린 다음 같은 호출 안에서**
   toDataURL 한다 — 그리기와 뜨기가 반드시 한 태스크여야 한다.
   ============================================================ */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const { decodePNG, encodePNG, resample } = require('../tools/png.js');
const { encodeGIF } = require('../tools/gif.js');

const W = Number(process.env.OUT_W) || 400;
const H = Math.round(W * 9 / 16);
const FPS = Number(process.env.OUT_FPS) || 8;
const PORT = 9401;
const BASE = process.env.COPYCAT_BASE || 'http://localhost:8123';
const OUT = path.join(__dirname, 'dist', 'shots');
/* 정지 장면은 크게 찍는다 — 조형 판정은 400px 로는 안 된다(spike/crop.js 와 같은 이유) */
const KEY_W = 1280, KEY_H = 720;
/* 폰으로 띄운다. 헤드리스에서 데스크톱으로 띄우면 #app 의 100dvh 가 0 으로 풀려서
   무대가 0 높이가 된다(verify-icons.js 머리말). 주력이 폰이기도 하다. */
const VIEW_W = 390, VIEW_H = 844;

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
if (!CHROME) throw new Error('크롬을 못 찾았다');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-outro-' + PORT);
  try { fs.rmSync(dir, { recursive:true, force:true }); } catch(e){}
  const chrome = spawn(CHROME, ['--headless=new','--hide-scrollbars','--mute-audio',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, 'about:blank'], { stdio:'ignore' });

  let page;
  for (let i = 0; i < 80 && !page; i++){
    try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
    if (!page) await sleep(250);
  }
  if (!page) throw new Error('크롬이 안 뜬다');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); const errs = [];
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text
      + ' ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 200));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.text + ' '
      + (r.exceptionDetails.exception?.description || '').slice(0, 400));
    return r?.result?.value;
  };

  await send('Emulation.setDeviceMetricsOverride',
    { width:VIEW_W, height:VIEW_H, deviceScaleFactor:2, mobile:true });
  await send('Page.navigate', { url: BASE + '/index.html?3d=1' });
  await sleep(15000);
  if (!await ev(`!!(window.R3 && R3.ready)`)) throw new Error('3D 가 안 올라왔다: ' + errs.slice(0, 2).join(' | '));

  /* ── 판을 깐다 ──
     새 저장은 1등급 사무실에 고양이 한 마리다. 아웃트로의 첫 컷이 「내 사무실」이므로
     실제로 굴린 방에 가깝게 만들어 둔다 — 등급을 올리고 비품·가구를 사고 고양이를 들인다. */
  const fix = await ev(`(()=>{
    const el = document.querySelector('#cctitle'); if (el) el.remove();
    document.body.classList.remove('titleon');
    S.tier = Math.min(TIERS.length - 1, 10);
    S.anchovy = 9999999;
    SHOP.forEach(it => { if (it.tier <= S.tier) S.shop[it.id] = true; });
    buildWorld(true);
    while (S.cats.length < 10) hire();
    renderTiles();
    return { W:W.W + 'x' + W.H, cats:S.cats.length };
  })()`);
  await sleep(3000);
  /* 무대 높이를 못 박는다 — 헤드리스에서 dvh 가 0 으로 풀리는 그 문제(위 머리말) */
  await ev(`(()=>{const st=document.createElement('style');
    st.textContent='#app{height:${VIEW_H}px !important}';document.head.appendChild(st);
    if(typeof fitWorld==='function')fitWorld(); if(window.R3&&R3.fit)R3.fit();
    const a=document.getElementById('app'); if(a.classList.contains('tabbar')) a.dataset.col='stage';
    if(typeof colApply==='function')colApply(); return 1})()`);
  await sleep(1200);

  /* **밤으로 돌린다** — 실제 컷신이 그렇게 한다(js/story.js playOutro).
     찍는 쪽이 다른 시각으로 찍으면 그건 게임에 없는 그림이다.
     전역광은 R3.outroSeek 이 매 프레임 눌러 둔다(render3d 의 OUT_LIGHT). */
  await ev(`(()=>{ setSkyAt(null); setSkyForce('night'); renderNight(); return 1 })()`);
  /* 시뮬만 세운다. 그리기는 그대로 — 프레임 사이에 고양이가 자리를 옮기면 안 된다. */
  await ev(`(()=>{ window.__simTick = simTick; simTick = () => {}; return 1 })()`);

  const info = await ev(`R3.outroBuild()`);
  if (!info) throw new Error('아웃트로를 못 세웠다: ' + errs.slice(0, 2).join(' | '));
  const meta = await ev(`R3.outroInfo()`);
  console.log(`  방 ${fix.W} · 고양이 ${fix.cats} · 판 ${info.plates}개 · 간격 ${info.cell.map(n => n.toFixed(1)).join('×')}`);
  console.log(`  길이 ${meta.dur.toFixed(1)}초 · 장 ${meta.chapters.map(c => c.id + '(' + c.dur + 's)').join(' → ')}`);

  /* 한 장 그려서 받아 온다 — 시각을 주고, 애니메이션 몫을 주고, 그리고, 캔버스를 뜬다. */
  const grab = async (t, dt) => {
    const r = await ev(`(()=>{ const st = R3.outroSeek(${t}, ${dt});
      R3.draw();
      return { url: document.getElementById('gl').toDataURL('image/png'),
               sub: st && st.sub ? L(st.sub) : '', id: st ? st.id : '',
               fade: st ? +st.fade.toFixed(2) : 0 }; })()`);
    if (!r || !r.url.startsWith('data:image/png')) throw new Error('캔버스를 못 떴다');
    return { img: decodePNG(Buffer.from(r.url.split(',')[1], 'base64')), sub:r.sub, id:r.id, fade:r.fade };
  };

  /* 무대 크기를 바꾼다. #viewport 를 고정하고 R3.fit 에게 다시 재게 한다 —
     캔버스 크기를 직접 쓰면 다음 fit 에서 되돌아간다.

     **CSS 크기가 아니라 캔버스 화소를 맞춘다.** 폰으로 띄웠으니 devicePixelRatio 가 2 고,
     R3.fit 은 그만큼 곱해서 캔버스를 만든다(setPixelRatio). 처음엔 CSS 를 400 으로 줬더니
     캔버스가 800 이 되어 GIF 가 **20MB** 로 나왔다. 원하는 화소를 배율로 나눠서 준다. */
  const setSize = async (w, h) => {
    return await ev(`(()=>{
      const k = Math.min(devicePixelRatio || 1, 2);
      let st = document.getElementById('__shotsize');
      if (!st){ st = document.createElement('style'); st.id='__shotsize'; document.head.appendChild(st); }
      st.textContent = '#viewport{width:' + (${w} / k) + 'px !important;height:' + (${h} / k)
        + 'px !important;flex:none !important}';
      R3.fit();
      const gl = document.getElementById('gl');
      return [gl.width, gl.height, k]; })()`);
  };

  const step = 1 / FPS;

  /* ---------- 움직이는 것 ---------- */
  if (!process.env.KEYS_ONLY){
    console.log('  캔버스 ' + (await setSize(W, H)).join('×'));
    await sleep(500);
    const n = Math.round(meta.dur * FPS);
    const frames = [];
    process.stdout.write(`  ${FPS}fps · ${n}장 `);
    for (let i = 0; i < n; i++){
      const g = await grab(i * step, step);
      frames.push({ rgba: g.img.rgba, delayMs: Math.round(1000 / FPS), w: g.img.w, h: g.img.h });
      if (i % 20 === 0) process.stdout.write('.');
    }
    console.log(' 받았다');
    const gw = frames[0].w, gh = frames[0].h;
    if (frames.some(f => f.w !== gw || f.h !== gh)) throw new Error('프레임 크기가 들쭉날쭉하다');
    const gif = encodeGIF(gw, gh, frames);
    fs.writeFileSync(path.join(OUT, 'outro.gif'), gif);
    console.log(`  outro.gif        ${(gif.length / 1024 / 1024).toFixed(2)} MB  (${gw}×${gh} · ${n}장)`);
  }

  /* ---------- 정지 장면 열두 장 ---------- */
  await setSize(KEY_W, KEY_H);
  await sleep(600);
  const KEYS = 12;
  const keys = [];
  for (let i = 0; i < KEYS; i++){
    const t = (meta.dur - 0.35) * (i / (KEYS - 1));
    keys.push({ ...(await grab(t, step)), t });
  }
  const COLS = 3, CW = 640, CHH = 360, PAD = 6;
  const sw = COLS * CW + (COLS + 1) * PAD;
  const rows = Math.ceil(KEYS / COLS);
  const sh = rows * CHH + (rows + 1) * PAD;
  const sheet = Buffer.alloc(sw * sh * 4);
  for (let i = 0; i < sw * sh; i++){ sheet[i*4] = 12; sheet[i*4+1] = 14; sheet[i*4+2] = 20; sheet[i*4+3] = 255; }
  keys.forEach((k, i) => {
    const px = resample(k.img.w, k.img.h, k.img.rgba, CW, CHH);
    const ox = PAD + (i % COLS) * (CW + PAD), oy = PAD + ((i / COLS) | 0) * (CHH + PAD);
    for (let y = 0; y < CHH; y++)
      for (let x = 0; x < CW; x++){
        const s = (y * CW + x) * 4, d = ((oy + y) * sw + ox + x) * 4;
        sheet[d] = px[s]; sheet[d+1] = px[s+1]; sheet[d+2] = px[s+2]; sheet[d+3] = 255;
      }
  });
  fs.writeFileSync(path.join(OUT, 'outro-keys.png'), encodePNG(sw, sh, sheet));
  console.log(`  outro-keys.png   ${sw}×${sh}  (${KEYS}장)`);
  keys.forEach((k, i) => console.log(`    ${String(i + 1).padStart(2)}  ${k.t.toFixed(1)}s  ${k.id}${k.sub ? '  ' + k.sub : ''}`));

  /* ---------- 엔딩을 본 사람의 시작화면 ----------
     되돌린 다음 **엔딩 표시를 세우고 페이지를 다시 열어** 실제로 그 화면이 뜨는지 본다.
     그 판단은 저장이 아니라 작은 키를 읽으므로(js/title.js) 키만 세운다. */
  await ev(`R3.outroStop()`);
  await ev(`(()=>{ localStorage.setItem('copycat.ending','1'); return 1 })()`);
  await send('Page.reload', {});
  await sleep(16000);
  await ev(`(()=>{const st=document.createElement('style');
    st.textContent='#app{height:${VIEW_H}px !important}';document.head.appendChild(st);
    const a=document.getElementById('app'); if(a.classList.contains('tabbar')) a.dataset.col='stage';
    if(typeof colApply==='function')colApply();
    if(typeof fitWorld==='function')fitWorld(); if(window.R3&&R3.fit)R3.fit(); return 1})()`);
  await sleep(3000);
  const vista = await ev(`(()=>{
    const el = document.querySelector('#cctitle');
    const im = el && el.querySelector('.logo img');
    return { 판:!!el, 정경:!!(el && el.classList.contains('vista')),
             live:!!(el && el.classList.contains('live')),
             로고: im ? (im.className || '(class 없음)') : '(없음)',
             격자:(R3.outroInfo() || {}).built }; })()`);
  console.log('  시작화면: ' + JSON.stringify(vista, null, 0));
  /* 시작화면은 DOM(로고) + GL(정경)이라 캔버스만 떠서는 로고가 안 들어온다 —
     GL 을 그림으로 깔고 화면째로 찍는다(verify-icons.js 가 쓰는 그 손). */
  await ev(`(()=>{
    R3.draw();
    const gl = document.getElementById('gl');
    const u = gl.toDataURL('image/png');
    let im = document.getElementById('__glshot');
    if (!im){ im = document.createElement('img'); im.id = '__glshot';
      im.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:1';
      gl.parentElement.appendChild(im); }
    im.src = u; gl.style.visibility = 'hidden';
    return u.length; })()`);
  await sleep(800);
  const shot = await send('Page.captureScreenshot', { format:'png' });
  fs.writeFileSync(path.join(OUT, 'outro-title.png'), Buffer.from(shot.data, 'base64'));
  console.log('  outro-title.png  (엔딩을 본 사람의 첫 화면)');

  if (errs.length) console.log('  오류: ' + errs.slice(0, 3).join(' | '));
  ws.close(); chrome.kill();
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
