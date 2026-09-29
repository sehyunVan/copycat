/* ============================================================
   bake-logo.js — 로고를 **게임에서 굽는다.**

   손으로 그린 그림을 로고로 쓰면 두 가지가 어긋난다: 게임 안 고양이와 안 닮고,
   그림체를 바꿀 때 로고만 안 따라온다. 그래서 로고는 그리지 않고 **게임의 렌더러가
   실제 고양이를 구워서** 낸다 — 직원 목록의 초상을 만드는 그 함수 그대로다
   (js/three/catsculpt.js 의 sculptPortrait, eerie 조명으로 구운 3/4 컷).

   고양이는 **검정(fur 0)**. 게임 안에서 그 색은 순검정이 아니라 0x4A4550 이다 —
   render3d.js 의 주석이 이유를 적어 뒀다: "순검정은 형태가 아니라 구멍이 된다."
   눈은 **뜬 눈**(eyeMode 0), 각도는 **정면**(front), 프레임은 **머리**(frame:'head')다.
   목록 초상은 감은 눈·3/4 컷이지만 로고는 눈이 보여야 고양이로 읽히고, 작게 줄이면
   3/4 는 한쪽으로 쏠린 덩어리가 된다. 머리 프레임은 렌더러가 「귀 끝이 겨우 들어오는
   거리」를 아는 자리다 — 정면 컷은 귀가 위로 잘려 나온다(아래 프레이밍 주석).

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
  console.log('  굽는다: 검정(fur 0) · 뜬 눈 · 정면 · 머리 프레임 · ' + SIZE + 'px');
  const url = await ev(`R3.portrait({ fur:0, hue:0 }, ${SIZE}, { eyeMode:0, front:true, frame:'head' })`);
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

  /* ── 어디를 잘라 내나 ──
     **턱을 찾아서 그 조금 아래를 바닥으로 삼는다.**

     예전에는 「머리 폭 × 1.12」 짜리 정사각형을 귀 끝에 붙여 놓았다. 그러면 아래가
     턱을 한참 지나 **몸통까지** 들어오는데, 몸통은 머리보다 좁아서 아이콘 밑에
     **가는 기둥 하나가 삐져나온 채로 잘린다** — 「목이 잘린 것 같다」는 제보가 그
     그림이다(2026-09-21). 머리는 멀쩡한데 그 기둥 하나가 그림을 시체로 만든다.

     바뀐 것 둘:

     1. **머리 프레임으로 굽는다**(frame:'head'). 렌더러가 이미 「귀 끝이 겨우 들어오는
        거리」를 알고 있다(js/three/catsculpt.js). 예전 정면 컷은 귀가 위로 잘려 나와서
        자를 때 그 손실을 되돌릴 방법이 없었다.
     2. **턱을 찾는다.** 추측하지 않는다 — 머리는 아래로 갈수록 빠르게 좁아지고
        **몸통은 거의 수직**이라, 실루엣의 양 끝이 움직임을 멈추는 첫 줄이 곧 경계다.

     BELOW 는 그 턱에서 **몇 줄을 더 내려가 바닥을 잡을지**다. 0 이면 턱이 그대로
     바닥이 되고, 키우면 어깨가 조금 깔린다. 후보를 +0 · +8 · +16 · +20 · +24 · +44 로
     구워 앱 아이콘까지 만들어 놓고 나란히 보고 **44 로 정했다**(2026-09-21).
     숫자 하나로 열어 두는 이유: 이건 계산으로 나오는 값이 아니라 **고른 값**이고,
     다음에 다시 고를 때 이 줄만 만지면 된다.

     한 변은 두상의 가로·세로 중 큰 쪽이다. 여백은 여기서 안 준다 — 쓰는 쪽
     (tools/logo.js)이 자리마다 다른 pad 를 주기 때문이고, 여기서 또 주면 두 번이 된다. */
  const BELOW = 44;

  const L = new Int32Array(h).fill(-1), R = new Int32Array(h).fill(-1);
  for (let y = bb.y0; y <= bb.y1; y++){
    for (let x = bb.x0; x <= bb.x1; x++) if (isCatAt((y * w + x) * 4)){ L[y] = x; break; }
    for (let x = bb.x1; x >= bb.x0; x--) if (isCatAt((y * w + x) * 4)){ R[y] = x; break; }
  }
  let yWide = bb.y0, wide = -1;
  for (let y = bb.y0; y <= bb.y1; y++)
    if (L[y] >= 0 && R[y] - L[y] > wide){ wide = R[y] - L[y]; yWide = y; }
  if (wide <= 0) throw new Error('실루엣을 못 읽었다');

  /* K 줄 사이에 실루엣이 **양쪽에서 얼마나 파고들었나**. 머리는 크고 몸통은 0 에 가깝다. */
  const K = Math.max(4, Math.round(h * 0.012));
  const narrow = y => (y + K > bb.y1 || L[y] < 0 || L[y + K] < 0) ? 0
                    : (L[y + K] - L[y]) + (R[y] - R[y + K]);
  const ON = Math.max(6, Math.round(wide * 0.015));    // 확실히 좁아지는 중
  const FLAT = Math.max(2, Math.round(wide * 0.004));  // 거의 수직 — 몸통이다
  /* **가장 넓은 줄 바로 아래에서 찾으면 안 된다.** 거기는 꼭대기라 기울기가 0 이고,
     그 줄이 「수직」으로 읽혀서 정수리를 턱이라고 답한다(실제로 그랬다).
     확실히 좁아지기 시작한 자리까지 내려간 다음에 편다. */
  let yy = yWide;
  while (yy < bb.y1 - K && narrow(yy) <= ON) yy++;
  let chin = -1;
  for (; yy < bb.y1 - K; yy++){
    /* 한 줄이 우연히 평평한 것과 몸통을 가른다 — 뒤 몇 줄도 같이 평평해야 한다. */
    let flat = true;
    for (let d = 0; d <= 40 && yy + d < bb.y1 - K; d += 8) if (narrow(yy + d) > FLAT){ flat = false; break; }
    if (flat){ chin = yy; break; }
  }
  if (chin < 0) chin = bb.y1;          // 몸통이 아예 안 잡히면 알파 바닥까지가 머리다

  let hx0 = w, hx1 = -1;
  for (let y2 = bb.y0; y2 <= chin; y2++)
    if (L[y2] >= 0){ if (L[y2] < hx0) hx0 = L[y2]; if (R[y2] > hx1) hx1 = R[y2]; }
  const hw = hx1 - hx0 + 1;
  const sy1 = Math.min(bb.y1 + 1, chin + 1 + BELOW);
  const side = Math.max(hw, sy1 - bb.y0);
  const hcx = (hx0 + hx1 + 1) / 2;
  const sx0 = Math.round(hcx - side / 2), sy0 = sy1 - side;
  console.log(`  알파 상자 ${bb.x1-bb.x0+1}×${bb.y1-bb.y0+1} · 가장 넓은 줄 ${wide+1}@${yWide}`);
  console.log(`  턱 y=${chin} (그 줄 폭 ${R[chin]-L[chin]+1}) · 두상 폭 ${hw} · 바닥 y=${sy1} (턱+${BELOW})`);
  console.log(`  네모 ${side}px @ (${sx0},${sy0})`);

  /* 네모가 원본 밖으로 나갈 수 있다(귀 위로 여백이 모자란 경우). resample 은 밖을
     **가장자리 색으로 늘리므로** 거기 맡기면 귀 위에 줄무늬가 생긴다. 투명한 네모를
     하나 만들어 놓고 겹치는 곳만 옮겨 담는다. */
  const sq = Buffer.alloc(side * side * 4);
  for (let dy = 0; dy < side; dy++){
    const src = sy0 + dy;
    if (src < 0 || src >= h) continue;
    for (let dx = 0; dx < side; dx++){
      const sxx = sx0 + dx;
      if (sxx < 0 || sxx >= w) continue;
      sq.set(data.subarray((src * w + sxx) * 4, (src * w + sxx) * 4 + 4), (dy * side + dx) * 4);
    }
  }

  const S = 512;
  const face = resample(side, side, sq, S, S);
  fs.writeFileSync(OUT, encodePNG(S, S, face));
  console.log(`→ assets/logo-cat.png  ${S}×${S}  ${(fs.statSync(OUT).size / 1024).toFixed(1)}KB`);
  console.log('  다음: node tools/logo.js  (파비콘·상단바·앱 아이콘에 반영)');
  process.exit(0);
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
