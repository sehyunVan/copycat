/* ============================================================
   split-doodles.js — 종이에 여러 마리 그린 그림 한 장을 마리별로 자른다.

   손으로 그릴 때는 한 장에 여러 마리를 그린다. 게임에 넣으려면 한 마리씩이어야 한다.
   좌표를 손으로 적어 두면 그림을 다시 그릴 때마다 같이 고쳐야 하므로,
   흰 배경을 기준으로 덩어리를 찾아서 자른다.

   덤으로 흰 배경을 투명으로 빼둔다 — 그림 파일을 편집하지 않아도 되게.

   node tools/split-doodles.js [입력.png] [출력디렉터리]
   기본값: assets/cats_drawn/cat.png → assets/cats_drawn/cat-1.png, cat-2.png ...
   ============================================================ */

const fs = require('fs');
const path = require('path');
const { decodePNG, encodePNG } = require('./png.js');

const IN  = process.argv[2] || path.join('assets', 'cats_drawn', 'cat.png');
const OUT = process.argv[3] || path.dirname(IN);

/* 배경 판정은 밝기가 아니라 **바깥에서 번져 들어가는 것**으로 한다.
   밝기로 자르면 크림색으로 칠한 고양이가 배경으로 잡혀서 반투명해진다.
   종이 바깥에서 시작해 흰 픽셀을 따라 번지면, 안쪽의 밝은 칠은 살아남는다. */
/* 이 밝기 이상이면 배경으로 번질 수 있다.
   높게 잡아야 한다 — 밝게 칠한 고양이(크림 241, 민트 238)가 이 값 위에 있으면
   외곽선에 틈이 하나만 있어도 그리로 새어 들어가 몸통이 통째로 지워진다.
   실측: 배경은 순백 255, 칠 중 가장 밝은 것이 241, 그 사이 246~253 은 완전히 비어 있다.
   그래서 250 이면 어느 쪽도 안 건드린다. 새 그림을 넣었는데 몸이 뚫리면 이 값부터 본다. */
const BG_LUM = 250;
const MIN_PX = 1500;   // 이보다 작은 덩어리는 얼룩으로 본다
const GAP = 6;         // 이만큼 떨어진 획은 같은 그림으로 묶는다 (점·수염이 떨어져 나가지 않게)
const PAD = 8;

const img = decodePNG(IN);
const { w, h, rgba } = img;
const lum = i => 0.299 * rgba[i] + 0.587 * rgba[i+1] + 0.114 * rgba[i+2];

/* 바깥에서 번지는 배경 */
const bg = new Uint8Array(w * h);
{
  const st = [];
  const push = (x, y) => {
    const p = y * w + x;
    if (bg[p]) return;
    const i = p * 4;
    if (rgba[i+3] <= 8 || lum(i) >= BG_LUM){ bg[p] = 1; st.push(p); }
  };
  for (let x = 0; x < w; x++){ push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++){ push(0, y); push(w - 1, y); }
  while (st.length){
    const q = st.pop(), x = q % w, y = (q / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
}

/* 그림인 픽셀 = 배경이 아닌 것 */
const ink = new Uint8Array(w * h);
for (let p = 0; p < w * h; p++) if (!bg[p]) ink[p] = 1;

/* GAP 만큼 부풀려서 덩어리를 잡는다. 자를 때는 원본을 쓰고, 묶을 때만 부푼 것을 쓴다. */
const fat = new Uint8Array(w * h);
for (let y = 0; y < h; y++)
  for (let x = 0; x < w; x++){
    if (!ink[y * w + x]) continue;
    for (let dy = -GAP; dy <= GAP; dy++){
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -GAP; dx <= GAP; dx++){
        const xx = x + dx;
        if (xx >= 0 && xx < w) fat[yy * w + xx] = 1;
      }
    }
  }

/* 덩어리 찾기 */
const seen = new Uint8Array(w * h);
const boxes = [];
for (let p = 0; p < w * h; p++){
  if (!fat[p] || seen[p]) continue;
  let n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0, real = 0;
  const st = [p];
  seen[p] = 1;
  while (st.length){
    const q = st.pop();
    const x = q % w, y = (q / w) | 0;
    n++;
    if (ink[q]){ real++; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const k = yy * w + xx;
      if (fat[k] && !seen[k]){ seen[k] = 1; st.push(k); }
    }
  }
  if (real >= MIN_PX) boxes.push({ x0, y0, x1, y1, n: real });
}

/* 왼쪽 위부터 순서대로 — 사람이 그린 순서와 대체로 맞는다 */
boxes.sort((a, b) => (a.y0 - b.y0) * 2 + (a.x0 - b.x0));

const base = path.basename(IN, path.extname(IN));
fs.mkdirSync(OUT, { recursive: true });
console.log(`${IN}  ${w}×${h}  →  덩어리 ${boxes.length}개`);

boxes.forEach((b, i) => {
  const x0 = Math.max(0, b.x0 - PAD), y0 = Math.max(0, b.y0 - PAD);
  const x1 = Math.min(w - 1, b.x1 + PAD), y1 = Math.min(h - 1, b.y1 + PAD);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const out = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++){
    for (let x = 0; x < cw; x++){
      const sp = (y0 + y) * w + (x0 + x), si = sp * 4, di = (y * cw + x) * 4;
      /* 배경이면 투명. 경계 한 겹은 밝기에 따라 눕힌다 —
         문턱을 올린 만큼 안티에일리어싱된 밝은 픽셀이 그림 쪽에 남는데,
         그걸 그대로 불투명하게 두면 형태 둘레에 흰 테두리가 생긴다. */
      let a = bg[sp] ? 0 : 255;
      if (a && (bg[sp-1] || bg[sp+1] || bg[sp-w] || bg[sp+w])){
        const L = lum(si);
        a = L >= BG_LUM ? 0 : Math.round(255 * Math.min(1, (BG_LUM - L) / 24));
      }
      out[di] = rgba[si]; out[di+1] = rgba[si+1]; out[di+2] = rgba[si+2]; out[di+3] = a;
    }
  }
  const file = path.join(OUT, `${base}-${i + 1}.png`);
  fs.writeFileSync(file, encodePNG(cw, ch, out));
  console.log(`  ${path.basename(file)}  ${cw}×${ch}  at (${x0},${y0})  (잉크 ${b.n}px)`);
});

/* 목록을 파일로 남긴다. 그림을 더 그려 넣어도 코드를 고칠 필요가 없게 —
   게임은 이 목록을 읽어서 채용 화면의 선택지를 만든다. */
const list = boxes.map((b, i) => `${base}-${i + 1}.png`);
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(list, null, 2));
/* 렌더러는 이 목록을 **정적 import** 로 읽는다. 예전엔 index.json 을 fetch 했는데,
   그림이 늦게 와서 그 사이에 만들어진 고양이가 전부 첫 그림으로 굳는 일이 있었다
   (헤드리스에서는 5~12초까지 늦었다). 모듈로 만들면 첫 프레임 전에 이미 있다.
   그림을 더 그려 넣고 이 도구만 다시 돌리면 목록이 저절로 늘어나는 건 그대로다. */
fs.writeFileSync(path.join(OUT, 'list.js'),
  '/* tools/split-doodles.js 가 만든다 — 손으로 고치지 말 것 */\n'
  + 'export const DRAWS = ' + JSON.stringify(list, null, 2) + ';\n');
console.log(`  index.json · list.js  ${list.length}종`);

if (!boxes.length) console.log('  덩어리를 못 찾았다 — 배경이 흰색인지, MIN_PX 가 너무 큰지 본다');
