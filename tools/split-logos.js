/* ============================================================
   split-logos.js — 로고 **컨셉 시트**를 낱장으로 자른다.

   logos/ 에 들어오는 건 로고 하나가 아니라 **여러 개를 한 장에 늘어놓은 시안 시트**다
   (지금 두 장 · 20 + 24 = 44종). 게임의 선택지로 쓰려면 한 장씩이어야 하고,
   좌표를 손으로 적어 두면 시트를 다시 받을 때마다 같이 고쳐야 한다.
   그래서 격자를 가정하지 않고 **잉크 덩어리를 찾아서** 자른다
   (tools/split-doodles.js 와 같은 방식이다 — 그쪽은 손그림 고양이, 이쪽은 로고).

   ── 번호와 꼬리말을 어떻게 버리나 ──
   시안 시트에는 칸마다 **일련번호**가 찍혀 있고 아래에 꼬리말이 한 줄 있다.
   처음엔 밝기로 가르려 했다 — 첫 장의 번호는 회색(밝기 175)이고 로고는 검정(16~40)이라
   잘 갈렸는데, **둘째 장의 번호는 검정이라 그 규칙이 통째로 틀렸다**(밝기 42~89).
   두 장 모두에서 확실한 건 **덩어리 크기**다: 번호는 41~162px, 로고는 1,266px 부터다.
   꼬리말("COPYCAT — LOGO CONCEPTS")도 704px 라 같은 문턱 아래에 있다.
   그래서 자르는 기준은 밝기가 아니라 **잉크 픽셀 수 하나**다.

   ── 줄 세우기 ──
   격자를 4×5 로 못박지 않는다. 시트마다 칸 수가 다르고(5열 · 6열) 다음 장은 또 다를 수
   있다. 세로 가운데를 정렬해 **80px 넘게 벌어지는 곳에서 줄을 끊고**, 줄 안에서 왼쪽부터.
   사람이 보는 순서(01, 02, …)와 같아진다.

   ── 배경 ──
   시안은 밝은 회색/흰 바탕에 검은 잉크다. 그대로 쓰면 시작화면의 **살아 있는 사무실**
   위에 흰 판이 하나 얹힌다(title.js 가 배경을 일부러 비워 둔 이유가 그거다).
   그래서 **어두울수록 불투명한 검정**으로 바꾼다 — 지금 쓰는 로고(js/title.js 의
   LOGO_SRC)와 같은 모양새다. 검정 판에 흰 글씨인 시안(뚫린 글씨)은 글자가 비치는데,
   그건 깨진 게 아니라 원래 그런 로고다.

   node tools/split-logos.js [최대변]     기본 300
     logos/*.png  →  assets/logos/logo-01.png …  +  js/logolist.js
   ============================================================ */
const fs = require('fs'), path = require('path');
const { decodePNG, encodePNG, resample } = require('./png.js');

const ROOT = path.join(__dirname, '..');
const SRC  = path.join(ROOT, 'logos');
const OUT  = path.join(ROOT, 'assets', 'logos');
const SIZE = Number(process.argv[2]) || 300;   // 긴 변을 여기에 맞춘다

const GAP     = 12;     // 이만큼 떨어진 획은 한 로고로 묶는다 (마크 + 글자 로고)
const MIN_PX  = 1000;   // 번호(≤162) 와 꼬리말(704) 은 여기서 걸린다
const ROW_GAP = 80;     // 세로로 이만큼 벌어지면 다음 줄
const PAD     = 6;

const sheets = fs.readdirSync(SRC).filter(f => f.toLowerCase().endsWith('.png')).sort();
if (!sheets.length){ console.error('logos/ 에 PNG 가 없다'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const out = [];
for (const file of sheets){
  const { w, h, rgba } = decodePNG(path.join(SRC, file));
  const lum = i => 0.299 * rgba[i] + 0.587 * rgba[i+1] + 0.114 * rgba[i+2];

  /* 바탕은 왼쪽 위 구석이다. 시안 시트는 여백으로 시작하므로 이 가정이 안전하다
     (첫 장 244 · 둘째 장 255). 문턱을 바탕에서 상대로 잡아야 두 장이 같은 코드로 돈다. */
  const bg = lum(0);
  const TH = bg - 55;
  const ink = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) if (lum(p * 4) < TH) ink[p] = 1;

  /* 묶을 때만 부풀린다. 자를 때는 원래 잉크의 경계를 쓴다. */
  const fat = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++){
      if (!ink[y * w + x]) continue;
      for (let dy = -GAP; dy <= GAP; dy++){
        const yy = y + dy; if (yy < 0 || yy >= h) continue;
        for (let dx = -GAP; dx <= GAP; dx++){
          const xx = x + dx; if (xx >= 0 && xx < w) fat[yy * w + xx] = 1;
        }
      }
    }

  const seen = new Uint8Array(w * h), boxes = [];
  for (let p0 = 0; p0 < w * h; p0++){
    if (!fat[p0] || seen[p0]) continue;
    let x0 = w, y0 = h, x1 = -1, y1 = -1, real = 0;
    const st = [p0]; seen[p0] = 1;
    while (st.length){
      const q = st.pop(), x = q % w, y = (q / w) | 0;
      if (ink[q]){ real++;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y; }
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const k = yy * w + xx;
        if (fat[k] && !seen[k]){ seen[k] = 1; st.push(k); }
      }
    }
    if (real >= MIN_PX) boxes.push({ x0, y0, x1, y1, real, cy: (y0 + y1) / 2 });
  }

  /* 줄 단위로 세운다 */
  boxes.sort((a, b) => a.cy - b.cy);
  const rows = [];
  for (const b of boxes){
    const r = rows[rows.length - 1];
    if (r && b.cy - r.cy < ROW_GAP){ r.items.push(b); r.cy = (r.cy + b.cy) / 2; }
    else rows.push({ cy: b.cy, items: [b] });
  }
  rows.forEach(r => r.items.sort((a, b) => a.x0 - b.x0));
  const list = rows.flatMap(r => r.items);

  /* 밝기를 알파로 — 검정 잉크, 투명 바탕 */
  const flat = Buffer.alloc(w * h * 4);
  for (let p = 0; p < w * h; p++){
    const L = lum(p * 4);
    let a = Math.max(0, Math.min(255, Math.round(255 * (bg - L) / bg)));
    /* 바닥과 천장을 눌러 준다. 시안 시트는 압축을 한 번 거쳐 와서 **바탕이 순색이
       아니다** — 밝기가 240~244 사이에서 흔들리고, 그걸 그대로 알파로 옮기면
       투명해야 할 바닥 전체에 1~5 짜리 잡티가 깔린다. 눈에는 안 보이는데 PNG 는
       그걸 전부 다른 값으로 세므로 파일이 배로 뛴다(44종 416KB → 아래 참조).
       가장자리의 반투명 한 겹은 살려야 계단이 안 생기므로 양 끝만 자른다. */
    if (a <= 24) a = 0; else if (a >= 232) a = 255;
    flat[p * 4 + 3] = a;
  }

  console.log(`${file}  ${w}×${h}  →  ${list.length}종 (줄 ${rows.length})`);
  list.forEach(b => {
    const x0 = Math.max(0, b.x0 - PAD), y0 = Math.max(0, b.y0 - PAD);
    const x1 = Math.min(w, b.x1 + 1 + PAD), y1 = Math.min(h, b.y1 + 1 + PAD);
    const cw = x1 - x0, ch = y1 - y0;
    const k = Math.min(1, SIZE / Math.max(cw, ch));
    const dw = Math.max(1, Math.round(cw * k)), dh = Math.max(1, Math.round(ch * k));
    const px = resample(w, h, flat, dw, dh, x0, y0, x1, y1);
    const name = `logo-${String(out.length + 1).padStart(2, '0')}.png`;
    fs.writeFileSync(path.join(OUT, name), encodePNG(dw, dh, px));
    const kb = fs.statSync(path.join(OUT, name)).size / 1024;
    out.push({ name, w: dw, h: dh, kb });
    console.log(`  ${name}  ${cw}×${ch} → ${dw}×${dh}  ${kb.toFixed(1)}KB`);
  });
}

/* ── 목록은 js/ 로 나간다 ──
   그림은 assets/ 에 있는데 목록만 js/ 인 게 어색해 보이지만 이유가 있다:
   배포 도구들이 **js/*.js 를 통째로** 담고(tools/collect.js), 단일 파일 배포본은
   index.html 의 <script src> 를 찾아 접어 넣는다(tools/pack-single.js).
   그런데 그 도구는 마크업이 assets/ 를 가리키면 **일부러 실패한다** —
   낱개 파일을 가리키는 배포본은 파일 하나로 안 돌기 때문이다.
   그래서 목록은 스크립트로, 그림은 표(assets.js)로 간다.

   fetch 로 읽지 않는 이유는 split-doodles.js 와 같다: 늦게 도착하면 그 사이에
   그려진 화면이 첫 항목으로 굳는다. */
const names = out.map(o => o.name);
/* 여기서 문자열을 이어붙이지 않고 **여러 줄 템플릿**을 쓴다 — 줄바꿈 이스케이프가
   섞이면 도구를 고칠 때마다 조용히 깨진다(실제로 한 번 깨졌다). */
fs.writeFileSync(path.join(ROOT, 'js', 'logolist.js'),
`/* tools/split-logos.js 가 만든다 — 손으로 고치지 말 것.
   logos/ 의 시안 시트를 낱장으로 자른 결과다. 그림은 assets/logos/ 에 있다. */
const LOGO_FILES = ${JSON.stringify(names, null, 2)};
const LOGO_PATH = f => 'assets/logos/' + f;
`);
const total = out.reduce((a, o) => a + o.kb, 0);
console.log(`→ assets/logos/  ${out.length}종  합계 ${total.toFixed(0)}KB  (긴 변 ${SIZE}px)`);
