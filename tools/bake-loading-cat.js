/* ============================================================
   bake-loading-cat.js — 로딩 화면의 고양이를 **게임에서 굽는다.**

   로고와 같은 규칙이다(tools/bake-logo.js · TODO 19번): 그림을 그리지 않는다.
   게임의 렌더러가 실제 고양이를 구워서 낸다 — 손으로 그리면 게임 안 고양이와 안 닮고,
   그림체를 바꿀 때 이 그림만 안 따라온다.

   로고와 다른 점 셋:
     · **앉은 자세**(pose 'sit' — POSE 표에 이미 있던 것. 뒷다리만 접고 가슴을 세운다)
     · **3/4 컷**(front 아님) — 앉아서 약간 측면을 본 각
     · **머리만 자르지 않는다.** 앉은 몸 전체가 들어와야 한다

   그리고 이 도구는 그림만 내지 않는다. **머리 중심이 그림에서 몇 %인지 같이 낸다** —
   로딩 스피너가 이마에 얹혀야 하는데 3/4 컷에서 머리는 가운데가 아니다(한쪽으로 쏠린다).
   그 좌표를 추측하면 스피너가 귀 옆의 허공을 돈다.

   먼저: node spike/serve.js
   실행: node tools/bake-loading-cat.js   →  assets/loading-cat.png + 좌표를 화면에 적는다
   ============================================================ */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const { decodePNG, encodePNG, resample } = require('./png.js');

const PORT = 9672;
const SIZE = 1024;
const OUT_PNG = path.join(__dirname, '..', 'assets', 'loading-cat.png');
const OUT_JSON = path.join(__dirname, '..', 'assets', 'loading-cat.json');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 고양이가 차지한 칸. bake-logo.js 의 그것과 같은 함수다 —
   투명이면 알파로, 불투명하게 구워졌으면 구석 색과 다른 칸으로 찾는다. */
function bbox(w, h, rgba){
  let opaque = true;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 250){ opaque = false; break; }
  const bg = [rgba[0], rgba[1], rgba[2]];
  const isCat = i => opaque
    ? (Math.abs(rgba[i] - bg[0]) + Math.abs(rgba[i+1] - bg[1]) + Math.abs(rgba[i+2] - bg[2])) > 18
    : rgba[i + 3] > 8;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (isCat((y * w + x) * 4)){
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x0, y0, x1, y1, opaque, isCat };
}

(async () => {
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-bakeload-' + process.pid);
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
  await send('Runtime.enable');
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r?.result?.value;
  };

  await send('Emulation.setDeviceMetricsOverride', { width:1280, height:800, deviceScaleFactor:1, mobile:false });
  await send('Page.navigate', { url:'http://localhost:8123/index.html?3d=1' });
  await sleep(13000);
  if (!await ev(`!!(typeof R3 !== 'undefined' && R3 && R3.ready && R3.portrait)`))
    throw new Error('3D 렌더러가 안 올라왔다 — node spike/serve.js 가 떠 있나');

  console.log('  굽는다: 검정(fur 0) · 뜬 눈 · 앉음 · 3/4 · ' + SIZE + 'px');
  const url = await ev(`R3.portrait({ fur:0, hue:0 }, ${SIZE}, { eyeMode:0, pose:'sit' })`);
  if (!url || !url.startsWith('data:image/png')) throw new Error('초상을 못 구웠다: ' + String(url).slice(0, 80));
  ws.close(); chrome.kill();

  const { w, h, rgba: data } = decodePNG(Buffer.from(url.split(',')[1], 'base64'));
  if (!w || !h) throw new Error('PNG 를 못 읽었다');
  const bb = bbox(w, h, data);
  if (!bb) throw new Error('구운 그림에서 고양이를 못 찾았다');
  console.log('  배경: ' + (bb.opaque ? '불투명 — 구석 색으로 찾음' : '투명 — 알파로 찾음'));
  console.log(`  알파 상자 ${bb.x1-bb.x0+1}×${bb.y1-bb.y0+1} @ (${bb.x0},${bb.y0})`);

  /* ---- 눈을 찾는다 = 얼굴의 중심 ----
     어두운 머리에서 눈은 압도적으로 밝은 칸이라, 밝기 상위 칸의 무게중심이 두 눈 사이다.
     bake-logo.js 가 자르는 자리를 정할 때 쓴 그 방법이고, 여기서는 **자르는 게 아니라
     스피너를 얹는 자리**를 정하는 데 쓴다.

     3/4 컷이라 눈은 가운데가 아니다 — 그래서 이 값을 추측할 수 없다. */
  const lum = i => 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
  let hi = 0;
  for (let y = bb.y0; y <= bb.y1; y++)
    for (let x = bb.x0; x <= bb.x1; x++){
      const i = (y * w + x) * 4;
      if (data[i+3] > 128) hi = Math.max(hi, lum(i));
    }
  let ex = 0, ey = 0, en = 0;
  for (let y = bb.y0; y <= bb.y1; y++)
    for (let x = bb.x0; x <= bb.x1; x++){
      const i = (y * w + x) * 4;
      if (data[i+3] > 128 && lum(i) > hi * 0.82){ ex += x; ey += y; en++; }
    }
  if (!en) throw new Error('눈을 못 찾았다 — 밝은 칸이 없다');
  ex /= en; ey /= en;

  /* 머리 폭 — 귀 끝(알파 상자의 위끝)부터 눈높이까지의 알파 폭.
     스피너 크기를 여기서 정한다: 이마에 얹히는 것이므로 머리 폭에 비례해야 한다. */
  let hx0 = w, hx1 = -1;
  for (let y = bb.y0; y <= Math.round(ey); y++)
    for (let x = bb.x0; x <= bb.x1; x++)
      if (bb.isCat((y * w + x) * 4)){ if (x < hx0) hx0 = x; if (x > hx1) hx1 = x; }
  const headW = hx1 - hx0 + 1;
  const headCx = hx1 < 0 ? ex : (hx0 + hx1 + 1) / 2;

  /* ---- 자른다: 앉은 몸 전체 + 숨 쉴 자리 ----
     로고는 얼굴만 남겼지만(작게 줄이니까) 이건 로딩 화면에서 200px 넘게 뜨는 그림이다.
     앉은 자세가 곧 실루엣이므로 몸을 자르면 안 된다. */
  const pad = Math.round(Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0) * 0.04);
  const cx0 = Math.max(0, bb.x0 - pad), cy0 = Math.max(0, bb.y0 - pad);
  const cx1 = Math.min(w, bb.x1 + 1 + pad), cy1 = Math.min(h, bb.y1 + 1 + pad);
  const cw = cx1 - cx0, ch = cy1 - cy0;

  /* 긴 변을 512 로. 세로가 긴 그림이라 정사각형에 넣으면 좌우에 빈 알파가 남고,
     그러면 CSS 에서 「그림 폭」이 고양이 폭이 아니게 된다(스피너 좌표가 어긋난다). */
  const LONG = 512;
  const ow = cw >= ch ? LONG : Math.round(LONG * cw / ch);
  const oh = cw >= ch ? Math.round(LONG * ch / cw) : LONG;
  const out = resample(w, h, data, ow, oh, cx0, cy0, cx1, cy1);
  fs.writeFileSync(OUT_PNG, encodePNG(ow, oh, out));

  /* ---- 스피너를 **머리 안에 완전히** 넣는다 ----
     처음엔 이마 높이를 비율로 잡았더니 갈래 몇 개가 귀 사이로 머리 밖에 나갔다.
     그러면 그 갈래는 **배경 위에** 놓이고, 배경이 밝으면 사라진다(테두리를 두르는 것으로
     덮으려 했는데, 애초에 안 나가게 하면 색 하나로 끝나고 배경색이 상관없어진다).

     비율로 추측하지 않고 **실루엣 안에 들어가는지 실제로 잰다**: 원의 테두리와 안쪽
     고리를 찍어서 전부 불투명한 자리를 찾는다. 큰 지름부터 시도해 제일 큰 것을 고르고,
     자리는 위에서부터 내려오며 처음 들어맞는 곳(= 제일 높은 곳)을 쓴다.
     눈은 덮지 않는다 — 눈이 가려지면 고양이로 안 읽힌다. */
  let eyeTop = bb.y1;
  for (let y = bb.y0; y <= bb.y1; y++)
    for (let x = bb.x0; x <= bb.x1; x++){
      const i = (y * w + x) * 4;
      if (data[i+3] > 128 && lum(i) > hi * 0.82){ if (y < eyeTop) eyeTop = y; }
    }

  const solid = (ccx, ccy, r) => {
    for (const rr of [r, r * 0.72]){
      for (let a = 0; a < 24; a++){
        const t = a / 24 * Math.PI * 2;
        const px = Math.round(ccx + Math.cos(t) * rr), py = Math.round(ccy + Math.sin(t) * rr);
        if (px < 0 || py < 0 || px >= w || py >= h) return false;
        if (!bb.isCat((py * w + px) * 4)) return false;
      }
    }
    return true;
  };

  let spin = null;
  for (let f = 0.56; f >= 0.30 && !spin; f -= 0.02){
    const r = headW * f / 2;
    /* 원의 **아래끝이 눈 위에서 멈춘다**(cy + r <= eyeTop). 처음엔 눈 위끝을
       중심의 한계로 뒀는데, 그러면 원이 눈 아래로 0.65r 만큼 내려와 눈을 침범했다 —
       눈이 가려지면 고양이로 안 읽힌다. 한계는 중심이 아니라 테두리에 걸어야 한다. */
    for (let cy = bb.y0 + r; cy + r <= eyeTop - r * 0.06; cy += 2){
      if (solid(headCx, cy, r)){ spin = { cx: headCx, cy, r, f: +f.toFixed(2) }; break; }
    }
  }
  if (!spin) throw new Error('스피너가 들어갈 자리를 못 찾았다 — 머리가 너무 좁다');

  /* 좌표는 **잘라낸 그림 기준의 백분율**로 낸다. 그러면 CSS 가 그림을 몇 px 로
     띄우든 그대로 쓸 수 있다 — px 로 내면 크기를 바꿀 때마다 다시 계산해야 한다. */
  const meta = {
    w: ow, h: oh,
    eye:  { x: +(((ex - cx0) / cw) * 100).toFixed(2), y: +(((ey - cy0) / ch) * 100).toFixed(2) },
    head: { x: +(((headCx - cx0) / cw) * 100).toFixed(2), w: +((headW / cw) * 100).toFixed(2) },
    spin: {
      x: +(((spin.cx - cx0) / cw) * 100).toFixed(2),
      y: +(((spin.cy - cy0) / ch) * 100).toFixed(2),
      d: +(((spin.r * 2) / cw) * 100).toFixed(2),        // 지름을 그림 폭의 %로
      /* 머리 폭의 몇 배로 들어갔나 — 너무 작아지면 밈이 안 읽힌다는 신호다 */
      ofHead: spin.f,
    },
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(meta, null, 2));

  /* ---- style.css 의 표시 구간에 써 넣는다 ----
     `tools/logo.js` 가 파비콘·상단바를 심는 것과 같은 방식이다. 손으로 세 값을 적어 두면
     다시 구웠을 때 어긋나고, 어긋나면 스피너가 이마를 벗어난다.

     그림은 **data URI 로 박는다.** 로딩 화면은 첫 페인트에 떠야 하는데 따로 파일을
     받으러 가면 그 왕복이 곧 이 화면이 없애려던 공백이다 — 스타일시트와 같이 온다.
     (단일 파일 배포본에서도 별 일이 안 생긴다: 어차피 CSS 안에 있다.) */
  const uri = 'data:image/png;base64,' + fs.readFileSync(OUT_PNG).toString('base64');
  const css = `#loadgate .lcat{aspect-ratio:${ow}/${oh};\n`
            + `  background:url("${uri}") center/100% 100% no-repeat}\n`
            + `#loadgate .lspin{left:${meta.spin.x}%;top:${meta.spin.y}%;width:${meta.spin.d}%}`;
  const CSS_FILE = path.join(__dirname, '..', 'style.css');
  const BEGIN = '/* LOADCAT:BEGIN 생성: node tools/bake-loading-cat.js -->  (그림과 스피너 자리) */';
  const END = '/* LOADCAT:END */';
  const s = fs.readFileSync(CSS_FILE, 'utf8');
  const i = s.indexOf(BEGIN), j = s.indexOf(END);
  if (i < 0 || j < 0) throw new Error('style.css 에 LOADCAT 표시가 없다');
  fs.writeFileSync(CSS_FILE, s.slice(0, i + BEGIN.length) + '\n' + css + '\n' + s.slice(j));

  console.log(`  눈 (${Math.round(ex)},${Math.round(ey)}) 위끝 ${eyeTop} 밝은칸 ${en} · 머리 폭 ${headW} · 머리 가운데 ${Math.round(headCx)}`);
  console.log(`  스피너: 지름 ${Math.round(spin.r*2)}px (머리 폭의 ${(spin.f*100).toFixed(0)}%) @ (${Math.round(spin.cx)},${Math.round(spin.cy)}) — 실루엣 안에 들어감`);
  console.log(`  자른 상자 ${cw}×${ch} @ (${cx0},${cy0})  여백 ${pad}px`);
  console.log(`→ assets/loading-cat.png  ${ow}×${oh}  ${(fs.statSync(OUT_PNG).size / 1024).toFixed(1)}KB`);
  console.log(`→ assets/loading-cat.json  스피너 자리 x ${meta.spin.x}% · y ${meta.spin.y}% · 지름 ${meta.spin.d}%`);
  process.exit(0);
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
