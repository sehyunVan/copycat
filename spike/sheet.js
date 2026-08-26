/* ============================================================
   sheet.js — 스타일 스크린샷을 한 장으로 붙인다.

   색은 나란히 놓고 봐야 판단이 된다. 탭을 오가면서 보면 눈이 적응해 버려서
   "둘 다 괜찮은데" 로 끝난다.

   node spike/verify.js && node spike/sheet.js  →  spike/dist/shots/_sheet.png
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { decodePNG, encodePNG } = require('../tools/png.js');

const SHOTS = path.join(__dirname, 'dist', 'shots');
const SCALE = 2;                       // DPR 2 로 찍었으니 반으로 줄인다
const GAP = 10;
const BG = [18, 20, 26, 255];

const PREFIX = process.argv[2] || 'f';                  // 's' 색 프로토타입 · 'f' 형태 프로토타입
const files = fs.readdirSync(SHOTS)
  .filter(f => new RegExp(`^${PREFIX}\\d.*\\.png$`).test(f)).sort();
if (!files.length){ console.error(`${PREFIX}* 스크린샷이 없다 — node spike/verify.js 를 먼저`); process.exit(1); }

/* 박스 필터 축소. DPR 2 스크린샷을 그대로 붙이면 한 장이 3000px 을 넘는다. */
function down(img, k){
  const w = Math.floor(img.w / k), h = Math.floor(img.h / k);
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = 0; dy < k; dy++)
        for (let dx = 0; dx < k; dx++){
          const i = (((y * k + dy) * img.w) + (x * k + dx)) * 4;
          r += img.rgba[i]; g += img.rgba[i+1]; b += img.rgba[i+2]; a += img.rgba[i+3];
        }
      const n = k * k, o = (y * w + x) * 4;
      out[o] = r / n; out[o+1] = g / n; out[o+2] = b / n; out[o+3] = a / n;
    }
  }
  return { w, h, rgba: out };
}

const COLS = Number(process.argv[3]) || 1;
const imgs = files.map(f => down(decodePNG(path.join(SHOTS, f)), SCALE));
const cw = Math.max(...imgs.map(i => i.w));
const ch = Math.max(...imgs.map(i => i.h));
const rows = Math.ceil(imgs.length / COLS);
const W = COLS * cw + (COLS + 1) * GAP;
const H = rows * ch + (rows + 1) * GAP;

const sheet = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) sheet.set(BG, i * 4);

imgs.forEach((im, i) => {
  const x0 = GAP + (i % COLS) * (cw + GAP);
  const y0 = GAP + Math.floor(i / COLS) * (ch + GAP);
  for (let y = 0; y < im.h; y++)
    im.rgba.copy(sheet, ((y0 + y) * W + x0) * 4, y * im.w * 4, (y + 1) * im.w * 4);
});

const out = path.join(SHOTS, `_sheet-${PREFIX}.png`);
fs.writeFileSync(out, encodePNG(W, H, sheet));
console.log(`${files.length}장 → ${path.relative(process.cwd(), out)}  ${W}×${H}`);
files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
