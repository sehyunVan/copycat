/* ============================================================
   build-atlas.js — 배포용 스프라이트 아틀라스를 만든다.

   왜 필요한가. 가구 타일셋(LimeZu "Modern Office - Revamped")은 유료 에셋이고
   라이선스가 이렇다:

     YOU CAN:   Edit and use the asset in any commercial or non commercial project
     YOU CAN'T: Resell or distribute the asset to others

   Copycat은 빌드가 없는 웹 게임이라 원본 PNG를 그대로 올리면 플레이어가
   256x848 짜리 팩 시트를 통째로 내려받는다. 그건 "게임에 에셋을 쓰는 것"이 아니라
   "에셋을 배포하는 것"으로 읽힌다.

   그래서 게임이 실제로 참조하는 칸만 뽑아 새 PNG로 재배치한다. 결과물은 팩이 아니라
   이 게임의 스프라이트 시트다. 좌표는 js/atlas.js 로 같이 떨어지고 sprite.js 가 그걸 읽는다.
   원본 시트는 이 도구의 재료일 뿐, 게임은 더 이상 원본을 열지 않는다.

   실행: node tools/build-atlas.js
   출력: assets/atlas.png · js/atlas.js  (둘 다 gitignore — 유료 픽셀에서 파생된 것이라 저장소에 넣지 않는다)
   ============================================================ */
const fs = require('fs'), vm = require('vm'), path = require('path');
const { decodePNG, encodePNG } = require('./png.js');

const ROOT = path.join(__dirname, '..') + path.sep;
const T = 16;            // 타일 한 변 (논리 픽셀)
const ATLAS_COLS = 16;   // 아틀라스 가로 폭 (타일 수)

/* ---------- 게임이 참조하는 칸 목록 ---------- */
/* 좌표표의 원본은 sprite.js 하나뿐이다. 여기서 값을 베껴 두면 반드시 어긋나므로
   sprite.js 를 그대로 실행해서 표를 꺼낸다 (sprite-audit.js 와 같은 방식). */
function loadTables(){
  const src = ['js/i18n.js', 'js/world.js', 'js/cats.js', 'js/sprite.js']
    .map(f => fs.readFileSync(ROOT + f, 'utf8')).join('\n');
  const ctx = {
    console, Math, Object, Map, Set, Array, String, Number, JSON,
    document: { createElement: () => ({ width:0, height:0,
      getContext: () => ({ fillRect(){} }), toDataURL: () => 'data:,' }) },
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const R = e => JSON.parse(vm.runInContext('JSON.stringify(' + e + ')', ctx));
  return { FURN: R('FURN'), DESK_TOPS: R('DESK_TOPS'), DESK_SIDE: R('DESK_SIDE'),
           CHAIRS: R('CHAIRS'), CLUTTER: R('CLUTTER'), ROOM: R('ROOM'), SHEET: R('SHEET') };
}

/* 좌표 하나의 규약: (col,row)는 왼쪽-아래 칸이고 tall만큼 위로, wide만큼 오른쪽으로 뻗는다.
   sprite.js 의 background-position 계산(row - tall + 1)과 같은 규약이라야
   아틀라스 좌표를 그대로 끼워 넣을 수 있다. */
function collect(t){
  const blocks = new Map();   // key -> {sheet,col,row,w,h}
  const add = (sheet, col, row, tall, wide) => {
    const w = wide || 1, h = tall || 1;
    const key = `${sheet}|${col},${row},${w},${h}`;
    if (!blocks.has(key)) blocks.set(key, { key, sheet, col, row, w, h });
  };
  Object.keys(t.FURN).forEach(k => {
    const d = t.FURN[k];
    if (d.col !== undefined) add('office', d.col, d.row, d.tall, d.wide);   // 시트에서 잘라오는 가구
  });
  t.DESK_TOPS.forEach(([c, r]) => add('office', c, r, 1, 1));
  t.DESK_SIDE.forEach(([c, r]) => add('office', c, r, 1, 1));
  t.CHAIRS.forEach(([c, r]) => add('office', c, r, 2, 1));
  t.CLUTTER.forEach(d => add('office', d.col, d.row, d.tall, d.wide));
  ['floor', 'floor2', 'floor3', 'floor4', 'wall', 'wallTop']
    .forEach(k => { const v = t.ROOM[k]; if (v) add('room', v[0], v[1], 1, 1); });
  return [...blocks.values()];
}

/* ---------- 배치 ---------- */
/* 선반(shelf) 방식. 높은 것부터 줄을 채우고 넘치면 다음 줄로 내린다.
   블록이 100개 남짓이라 더 영리한 패커를 쓸 이유가 없다. */
function pack(blocks, cols){
  const sorted = [...blocks].sort((a, b) => b.h - a.h || b.w - a.w || a.key.localeCompare(b.key));
  let x = 0, y = 0, shelf = 0;
  for (const b of sorted){
    if (x + b.w > cols){ y += shelf; x = 0; shelf = 0; }
    b.ax = x; b.ay = y;              // 아틀라스에서의 왼쪽-위 칸
    x += b.w;
    if (b.h > shelf) shelf = b.h;
  }
  return { cols, rows: y + shelf, placed: sorted };
}

function blit(dst, dw, src, sw, b){
  const sx = b.col * T, sy = (b.row - b.h + 1) * T;     // 원본에서 왼쪽-위 픽셀
  const dx = b.ax * T, dy = b.ay * T;
  for (let y = 0; y < b.h * T; y++){
    const so = ((sy + y) * sw + sx) * 4, dof = ((dy + y) * dw + dx) * 4;
    src.copy(dst, dof, so, so + b.w * T * 4);
  }
}

/* ---------- 실행 ---------- */
const SRC = {
  office: 'assets/modern_office/Modern_Office_Shadowless_16x16.png',
  room:   'assets/modern_office/Room_Builder_Office_16x16.png',
};
for (const k of Object.keys(SRC)){
  if (!fs.existsSync(ROOT + SRC[k])){
    console.error('원본 타일셋이 없다: ' + SRC[k]);
    console.error('LimeZu "Modern Office - Revamped" 를 구매해 README 설치 절대로 넣어야 한다.');
    process.exit(1);
  }
}

const tables = loadTables();
const sheets = { office: decodePNG(ROOT + SRC.office), room: decodePNG(ROOT + SRC.room) };
const blocks = collect(tables);
const layout = pack(blocks, ATLAS_COLS);

const AW = layout.cols * T, AH = layout.rows * T;
const out = Buffer.alloc(AW * AH * 4);        // 전부 투명으로 시작
for (const b of layout.placed){
  const s = sheets[b.sheet];
  const sx = b.col * T, sy = (b.row - b.h + 1) * T;
  if (sx < 0 || sy < 0 || sx + b.w * T > s.w || sy + b.h * T > s.h)
    throw new Error('원본 밖을 가리키는 좌표: ' + b.key);
  blit(out, AW, s.rgba, s.w, b);
}

fs.writeFileSync(ROOT + 'assets/atlas.png', encodePNG(AW, AH, out));

const map = {};
for (const b of layout.placed) map[b.key] = [b.ax, b.ay + b.h - 1];   // 다시 왼쪽-아래 기준으로
const lines = Object.keys(map).sort().map(k => `    '${k}': [${map[k][0]}, ${map[k][1]}],`);
fs.writeFileSync(ROOT + 'js/atlas.js',
`/* 자동 생성 파일 — 직접 고치지 말 것. 고칠 곳은 js/sprite.js 의 좌표표다.
   만드는 법: node tools/build-atlas.js

   유료 타일셋(LimeZu Modern Office)에서 이 게임이 실제로 쓰는 ${layout.placed.length}칸만
   뽑아 assets/atlas.png 로 재배치한 결과의 좌표표다. 원본 시트는 게임에 들어가지 않는다.
   키는 'sheet|col,row,wide,tall' (원본 좌표, 왼쪽-아래 기준) → 아틀라스의 왼쪽-아래 칸. */
const ATLAS = {
  src: 'assets/atlas.png',
  w: ${AW}, h: ${AH}, tile: ${T},
  map: {
${lines.join('\n')}
  },
};
`);

/* 다시 읽어서 원본과 한 픽셀씩 대조한다. 좌표 규약(왼쪽-아래 기준, tall은 위로)을
   한 군데서만 잘못 이해해도 가구가 반 칸씩 밀려 나가는데, 눈으로는 잘 안 보인다. */
const check = decodePNG(ROOT + 'assets/atlas.png');
let mismatch = 0;
for (const b of layout.placed){
  const s = sheets[b.sheet];
  const sx = b.col * T, sy = (b.row - b.h + 1) * T;
  for (let y = 0; y < b.h * T && !mismatch; y++){
    const so = ((sy + y) * s.w + sx) * 4, ao = ((b.ay * T + y) * check.w + b.ax * T) * 4;
    if (s.rgba.compare(check.rgba, ao, ao + b.w * T * 4, so, so + b.w * T * 4) !== 0){
      console.error('픽셀 불일치: ' + b.key + ' (원본 y+' + y + ')');
      mismatch++;
    }
  }
}
if (mismatch){ console.error('아틀라스가 원본과 다르다 — 중단'); process.exit(1); }

const before = fs.statSync(ROOT + SRC.office).size + fs.statSync(ROOT + SRC.room).size;
const after = fs.statSync(ROOT + 'assets/atlas.png').size;
const tiles = layout.placed.reduce((n, b) => n + b.w * b.h, 0);
console.log(`블록 ${layout.placed.length}개 · 타일 ${tiles}칸 → ${AW}x${AH} (${layout.cols}x${layout.rows}타일)`);
console.log(`원본 ${(before/1024).toFixed(0)}KB → 아틀라스 ${(after/1024).toFixed(1)}KB`);
console.log('assets/atlas.png · js/atlas.js 갱신됨');
