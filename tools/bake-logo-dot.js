/* ============================================================
   bake-logo-dot.js — 로고를 **도트로 다시 굽는다.**

   게임 화면이 도트 판이 되고 나서(style.css · js/dot.js) 로고만 부드러운 그림으로
   남았다. 한 화면 안에서 글씨는 11px 격자인데 로고만 안티에일리어싱이면, 그 로고가
   제일 먼저 「다른 데서 가져온 것」으로 보인다.

   **새로 그리지 않는다.** 아이콘을 다시 구운 것과 같은 규칙이다(js/dot.js 머리말):
   있는 그림을 격자에 얹어 **표본화**한다. 그림체가 바뀌어도 로고가 저절로 따라오고,
   손으로 그린 로고와 게임의 로고가 갈라지지 않는다(bake-logo.js 가 애초에 그래서
   게임 렌더러로 로고를 굽는다 — 그 결정을 여기서 뒤집지 않는다).

   ── 세 가지를 한다 ──
     1. **격자로 줄인다** — 상자 평균(알파는 덮인 넓이). 이때 반투명 가장자리가 생긴다.
     2. **가장자리를 끊는다** — 알파를 문턱으로 0/255 로 민다. 도트 그림에 반투명
        테두리가 남으면 확대했을 때 그 줄만 흐려서, 격자가 아니라 「저해상도 사진」이 된다.
     3. **색을 몇 칸으로 줄인다** — 명암을 세게 하고(eerie 강화) 단계로 반올림한다.
        색이 연속이면 도트 하나하나가 안 세어지고, 그러면 픽셀아트로 안 읽힌다.

   ── 왜 확대해서 저장하나 ──
   격자를 그대로 저장하고 CSS 로 늘리면(`image-rendering:pixelated`) 브라우저가 정하는
   배율이 정수가 아닐 때 **도트 폭이 들쭉날쭉**해진다(어떤 칸은 3px, 어떤 칸은 4px).
   그래서 정수 배로 미리 늘려 굽고, 화면에서는 등배(또는 정수배)로 뜨게 둔다.
   워드마크는 223 → 74칸 × 3 = 222px 이고, 시작화면의 `width:min(62vw,222px)` 와 맞는다.

     node tools/bake-logo-dot.js            → assets/logo-word-dot.png · logo-cat-dot.png
   ============================================================ */
const fs = require('fs'), path = require('path');
const { decodePNG, encodePNG } = require('./png.js');

const ROOT = path.resolve(__dirname, '..') + '/';

/* 명암을 세게 — eerie 강화. **검은 점과 흰 점을 다시 잡는다**(레벨 보정).
   축 하나를 두고 벌리는 방식(0.5 기준 대비)은 이 그림에서 안 통했다: 검은 고양이는
   거의 전부가 축 아래라 통째로 어두워지고, 축을 낮추면 이번엔 털까지 같이 떠서
   **갈색 고양이**가 된다(실측으로 둘 다 해 봤다).

   그래서 lo 아래는 전부 검정으로 눌러 버리고, lo~hi 를 0~1 로 다시 편다. 털은 lo 밑에
   깔려 순검정 쪽으로 가고 눈·코만 hi 쪽으로 올라온다 — 어두운 방에서 눈이 먼저 보이는
   그 그림이 이 게임의 eerie 다. */
function curve(v, { lo = 0, hi = 1, gamma = 1 }){
  const y = v / 255;
  if (hi <= lo) return v;
  const t = Math.max(0, Math.min(1, (y - lo) / (hi - lo)));
  return Math.round(Math.pow(t, gamma) * 255);
}
/* 색을 K 칸으로. 채널마다 따로 반올림하면 색상이 튀므로 **밝기만** 칸으로 나누고
   색은 원래 비율을 지킨다 — 검은 고양이가 파래지거나 크림이 노래지는 걸 막는다. */
function posterize(r, g, b, K, lv){
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  if (y < 1) return [r, g, b];
  const step = 255 / (K - 1);
  const yq = Math.max(step * 0.35, Math.round(curve(y, lv) / step) * step);
  const k = yq / y;
  return [Math.min(255, Math.round(r * k)), Math.min(255, Math.round(g * k)), Math.min(255, Math.round(b * k))];
}

/* 상자 평균으로 격자 하나를 낸다. **알파를 곱해서 더한다**(프리멀티플라이) —
   안 그러면 투명한 칸의 (아무 값이나 들어 있는) 색이 평균에 섞여 가장자리가 탁해진다. */
function cell(src, sw, x0, y0, x1, y1, bright = 0){
  let r = 0, g = 0, b = 0, a = 0, n = 0;
  let by = -1, br = 0, bg = 0, bb = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++){
      const i = (y * sw + x) * 4, al = src[i + 3] / 255;
      r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += al; n++;
      /* 그 칸에서 **제일 밝은 점**도 같이 기억한다 — 아래 bright 가 쓴다 */
      if (al > 0.5){
        const l = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
        if (l > by){ by = l; br = src[i]; bg = src[i + 1]; bb = src[i + 2]; }
      }
    }
  if (!n || a < 1e-6) return [0, 0, 0, 0];
  let R = r / a, G = g / a, B = b / a;
  /* **작고 밝은 것은 평균에 지워진다.** 512 판의 고양이 눈은 16×16 칸 안에서 몇 점뿐이라
     평균을 내면 검은 털에 먹혀 사라진다 — 눈 없는 검은 덩어리는 고양이가 아니다.
     그래서 평균과 최댓값을 섞는다. 0 이면 순수 평균(글자에 맞다), 클수록 밝은 점이 산다. */
  if (bright > 0 && by >= 0){
    R = R * (1 - bright) + br * bright;
    G = G * (1 - bright) + bg * bright;
    B = B * (1 - bright) + bb * bright;
  }
  return [R, G, B, a / n];
}

/* @param grid  가로 칸 수 · @param cellPx 한 칸을 몇 픽셀로 저장할지
   @param alphaTh 이 넓이 이상 덮이면 칸을 켠다 · @param levels 밝기 칸 수 · @param sharp 대비 */
function dotify(file, { grid, cellPx = 3, alphaTh = 0.45, levels = 5, sharp = 1.25, trim = false, bright = 0, lv = {} }){
  const src = decodePNG(ROOT + file);
  let x0 = 0, y0 = 0, x1 = src.w, y1 = src.h;
  if (trim){
    /* 빈 여백을 먼저 잘라낸다 — 512 판 가운데 고양이가 작게 앉아 있으면 격자를
       32 로 잡아도 실제로 쓰이는 칸이 열몇 개뿐이라 형태가 안 남는다. */
    x0 = src.w; y0 = src.h; x1 = 0; y1 = 0;
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++)
        if (src.rgba[(y * src.w + x) * 4 + 3] > 8){
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
    x1++; y1++;
  }
  const sw = x1 - x0, sh = y1 - y0;
  const gw = grid, gh = Math.max(1, Math.round(grid * sh / sw));
  const out = Buffer.alloc(gw * cellPx * gh * cellPx * 4);
  const W = gw * cellPx;
  for (let gy = 0; gy < gh; gy++){
    for (let gx = 0; gx < gw; gx++){
      const [r, g, b, a] = cell(src.rgba, src.w,
        x0 + Math.floor(gx * sw / gw), y0 + Math.floor(gy * sh / gh),
        x0 + Math.max(Math.floor(gx * sw / gw) + 1, Math.floor((gx + 1) * sw / gw)),
        y0 + Math.max(Math.floor(gy * sh / gh) + 1, Math.floor((gy + 1) * sh / gh)), bright);
      const on = a >= alphaTh;
      const [pr, pg, pb] = on ? posterize(r, g, b, levels, lv) : [0, 0, 0];
      for (let dy = 0; dy < cellPx; dy++)
        for (let dx = 0; dx < cellPx; dx++){
          const i = ((gy * cellPx + dy) * W + gx * cellPx + dx) * 4;
          out[i] = pr; out[i + 1] = pg; out[i + 2] = pb; out[i + 3] = on ? 255 : 0;
        }
    }
  }
  return { buf: encodePNG(W, gh * cellPx, out), w: W, h: gh * cellPx, gw, gh };
}

const JOBS = [
  /* 시작화면의 워드마크. 223 → 74 칸(×3 = 222px). 세로는 비율로 따라온다.
     글자라서 **문턱을 낮게** 둔다 — 획이 한 칸보다 얇은 자리가 있고, 문턱이 높으면
     C 와 O 의 아래쪽이 먼저 끊긴다. */
  ['assets/logo-word.png', 'assets/logo-word-dot.png', { grid: 74, cellPx: 3, alphaTh: 0.38, levels: 4, lv: { lo: 0.10, hi: 0.95 } }],
  /* 상단바·파비콘·앱 아이콘이 쓰는 검은 고양이. 512 판에 여백이 넓어 먼저 자른다.
     32 칸이면 귀 끝과 눈이 남는 최소 크기다(24 로 줄이면 눈이 한 칸이 되어 사라진다).
     대비를 더 준다 — 검정 위의 검정이라 그냥 줄이면 실루엣만 남는다. */
  ['assets/logo-cat.png', 'assets/logo-cat-dot.png', { grid: 36, cellPx: 8, alphaTh: 0.42, levels: 5, lv: { lo: 0.13, hi: 0.60, gamma: 1.15 }, trim: true, bright: 0.8 }],
];
/* ---------- 지점 간판 44 장 ----------
   `node tools/bake-logo-dot.js --signs` 로만 돈다.

   ── 원본을 먼저 옮겨 둔다 ──
   게임은 `assets/logos/logo-01.png` 라는 **이름**을 읽는다(js/logolist.js). 그래서 도트
   판이 그 이름을 차지해야 하고, 그러면 원본을 덮어쓴다. 이 그림들은 게임이 구운 게
   아니라 **사람이 그린 것**이라 다시 만들 수 없다. git 에 들어 있긴 하지만, 다시 구울
   때마다 「도트를 도트로」 굽는 사고가 나므로(두 번 구우면 격자가 격자를 표본화한다)
   `assets/logos-src/` 에 원본을 한 번 옮겨 두고 **거기서 읽는다.** 이미 있으면 안 덮는다.

   ── 크기를 그림마다 다르게 잡는다 ──
   간판은 세로로 긴 것(134×170)과 옆으로 긴 것(274×69)이 섞여 있다. 칸 수를 하나로
   박으면 옆으로 긴 것이 화면 밖으로 나간다. 그래서 **화면에 설 자리**(132×116 — 시작화면
   `img.mark` 의 상한)에 맞춰 칸 수를 계산한다. 한 칸은 2px 로 고정 — 그래야 굽힌 그림이
   그 상한 안에 들어가고, 화면에서 **등배로** 떠서 도트가 안 흐려진다. */
if (process.argv.includes('--signs')){
  const SRC = ROOT + 'assets/logos-src', DST = ROOT + 'assets/logos';
  if (!fs.existsSync(SRC)){
    fs.mkdirSync(SRC);
    for (const f of fs.readdirSync(DST).filter(n => n.endsWith('.png')))
      fs.copyFileSync(DST + '/' + f, SRC + '/' + f);
    console.log('  원본을 assets/logos-src/ 로 옮겨 뒀다 (한 번만 한다)');
  }
  const CELL = 2, MAXW = 132, MAXH = 116;
  for (const f of fs.readdirSync(SRC).filter(n => n.endsWith('.png')).sort()){
    const src = decodePNG(SRC + '/' + f);
    const fit = Math.min(MAXW / src.w, MAXH / src.h);
    const grid = Math.max(16, Math.floor(src.w * fit / CELL));
    JOBS.push(['assets/logos-src/' + f, 'assets/logos/' + f,
      { grid, cellPx: CELL, alphaTh: 0.40, levels: 4, lv: { lo: 0.06, hi: 0.94 }, trim: true, bright: 0.3 }]);
  }
}

for (const [src, dst, opt] of JOBS){
  const r = dotify(src, opt);
  fs.writeFileSync(ROOT + dst, r.buf);
  console.log('  ' + dst.padEnd(30) + r.gw + '×' + r.gh + ' 칸 → ' + r.w + '×' + r.h
    + '  ' + (r.buf.length / 1024).toFixed(1) + 'KB');
}
console.log('\n워드마크를 시작화면에 반영하려면: node tools/logo-dot-embed.js');
