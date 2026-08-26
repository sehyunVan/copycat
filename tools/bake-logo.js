/* ============================================================
   bake-logo.js — 로고를 **게임에서 굽는다.**

   손으로 그린 그림을 로고로 쓰면 두 가지가 어긋난다: 게임 안 고양이와 안 닮고,
   그림체를 바꿀 때 로고만 안 따라온다. 그래서 로고는 그리지 않고 **게임의 렌더러가
   실제 고양이를 구워서** 낸다 — 직원 목록의 초상을 만드는 그 함수 그대로다
   (js/three/catsculpt.js 의 sculptPortrait, eerie 조명으로 구운 3/4 컷).

   고양이는 **검정(fur 0)**. 게임 안에서 그 색은 순검정이 아니라 0x4A4550 이다 —
   render3d.js 의 주석이 이유를 적어 뒀다: "순검정은 형태가 아니라 구멍이 된다."
   눈은 **뜬 눈**(eyeMode 0), 각도는 **정면**(front)이다. 목록 초상은 감은 눈·3/4 컷이지만
   로고는 눈이 보여야 고양이로 읽히고, 작게 줄이면 3/4 는 한쪽으로 쏠린 덩어리가 된다.

   먼저: node spike/serve.js
   실행: node tools/bake-logo.js       →  assets/logo-cat.png (구운 원본, 투명 배경)
   그 뒤: node tools/logo.js           →  파비콘·상단바·앱 아이콘에 반영
   ============================================================ */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const { decodePNG, encodePNG, resample } = require('./png.js');

const PORT = 9670;
const SIZE = 1024;                 // 앱스토어 아이콘이 1024 라 그보다 작게 구우면 안 된다
const OUT = path.join(__dirname, '..', 'assets', 'logo-cat.png');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 고양이가 차지한 칸의 경계. 이걸로 잘라내면 **머리가 프레임을 꽉 채운다** —
   초상은 3/4 컷이라 몸통 위쪽까지 들어오고, 그대로 쓰면 20px 에서 고양이가 점이 된다.

   투명 배경이면 알파로 찾는다. 그런데 eerie 굽기(EERIE.bakePortrait)는 불투명하게
   나올 수 있어서, 그때는 **왼쪽 위 구석 색**을 배경으로 보고 그것과 다른 칸을 찾는다.
   구석에 고양이가 걸리는 프레이밍이 아니라 이 가정은 안전하다. */
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
  const dir = path.join(process.env.TEMP || '/tmp', 'cdp-bake-' + process.pid);
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
  const ready = await ev(`!!(typeof R3 !== 'undefined' && R3 && R3.ready && R3.portrait)`);
  if (!ready) throw new Error('3D 렌더러가 안 올라왔다 — node spike/serve.js 가 떠 있나');

  /* 검정 고양이, 뜬 눈. hue 0 이라 FUR_BASE[0] 그대로다. */
  console.log('  굽는다: 검정(fur 0) · 뜬 눈 · 정면 · ' + SIZE + 'px');
  const url = await ev(`R3.portrait({ fur:0, hue:0 }, ${SIZE}, { eyeMode:0, front:true })`);
  if (!url || !url.startsWith('data:image/png')) throw new Error('초상을 못 구웠다: ' + String(url).slice(0, 80));
  ws.close(); chrome.kill();

  /* decodePNG 는 { w, h, rgba } 를 돌려준다 — { width, height, data } 가 아니다.
     처음에 그렇게 받아서 전부 undefined 였고, "알파가 전부 0" 이라는 엉뚱한 진단이 나왔다. */
  const { w, h, rgba: data } = decodePNG(Buffer.from(url.split(',')[1], 'base64'));
  if (!w || !h) throw new Error('PNG 를 못 읽었다');
  const bb = bbox(w, h, data);
  if (!bb) throw new Error('구운 그림에서 고양이를 못 찾았다');
  console.log('  배경: ' + (bb.opaque ? '불투명 — 구석 색으로 찾음' : '투명 — 알파로 찾음'));
  const isCatAt = bb.isCat;

  /* **얼굴만 남긴다.** 초상은 3/4 컷이라 몸통까지 들어오고, 그대로 쓰면 20px 에서
     고양이가 점이 된다.

     처음엔 "알파 상자의 위쪽 정사각형" 으로 잘랐다가 **눈과 입이 아래로 잘려 나갔다** —
     이 고양이는 이마가 크고 얼굴 특징이 머리 아래쪽에 앉아 있어서 그 가정이 틀렸다.
     그래서 추측하지 않고 **눈을 찾는다**: 어두운 머리에서 눈은 압도적으로 밝은 칸이라
     밝기 상위 칸의 무게중심이 곧 두 눈의 가운데다. 거기가 얼굴의 중심이고,
     귀 끝(알파 상자의 위끝)까지의 거리로 머리 크기를 안다. */
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

  /* 정사각형을 **귀 끝에 붙여** 놓는다. 처음엔 "눈 위로 정사각형의 45%" 로 잡았는데
     귀가 위로 잘려 나갔다 — 눈 위 여백을 비율로 정하면 귀 높이를 모르는 채로 정하는 것이다.
     귀 끝(알파 상자의 위끝)은 아는 값이니 거기에 붙이고, 눈이 세로 EYE_AT 에 오도록
     한 변을 정한다. 그러면 위는 귀까지 꽉 차고 아래는 턱 조금까지만 들어온다. */
  /* 정사각형 크기는 **머리 폭**으로 정한다. 눈 위치로 정하려 했더니 두 번 틀렸다:
     0.66 은 턱 아래 몸통이 남고, 0.78 은 귀와 머리 양옆이 잘렸다 — 눈 높이는
     "얼마나 넓은가" 에 대해 아무것도 안 알려 준다. 머리 띠(귀 끝~눈높이)의 알파 폭은
     아는 값이고, 이 조형은 머리 폭과 (귀 끝~턱) 높이가 대략 같다. */
  let hx0 = w, hx1 = -1;
  for (let y = bb.y0; y <= Math.round(ey); y++)
    for (let x = bb.x0; x <= bb.x1; x++)
      if (isCatAt((y * w + x) * 4)){ if (x < hx0) hx0 = x; if (x > hx1) hx1 = x; }
  const hw = hx1 - hx0 + 1;
  const hcx = hx1 < 0 ? ex : (hx0 + hx1 + 1) / 2;
  const side = Math.round(hw * 1.12);            // 12% 는 숨 쉴 자리
  let sx0 = Math.round(hcx - side / 2), sy0 = Math.round(bb.y0 - side * 0.06);
  let sx1 = sx0 + side, sy1 = sy0 + side;
  console.log(`  머리 폭 ${hw} · 가운데 ${Math.round(hcx)} (눈 무게중심 ${Math.round(ex)}, 차이 ${Math.round(hcx - ex)}px)`);
  console.log(`  알파 상자 ${bb.x1-bb.x0+1}×${bb.y1-bb.y0+1} · 눈 (${Math.round(ex)},${Math.round(ey)}) 밝은칸 ${en}`);
  console.log(`  얼굴 정사각형 ${side}px @ (${sx0},${sy0})`);
  sx0 = Math.max(0, sx0); sy0 = Math.max(0, sy0);
  sx1 = Math.min(w, sx1); sy1 = Math.min(h, sy1);

  const S = 512;
  const face = resample(w, h, data, S, S, sx0, sy0, sx1, sy1);
  fs.writeFileSync(OUT, encodePNG(S, S, face));
  console.log(`→ assets/logo-cat.png  ${S}×${S}  ${(fs.statSync(OUT).size / 1024).toFixed(1)}KB`);
  console.log('  다음: node tools/logo.js  (파비콘·상단바·앱 아이콘에 반영)');
  process.exit(0);
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
