/* ============================================================
   sprite.js — 도트 스프라이트 (GitAnimals풍)
   ASCII 맵 → 캔버스 → dataURL 캐시. 외부 이미지 파일 없음.
   ============================================================ */

/* 픽셀 밀도는 전부 같아야 도트가 안 깨진다. 고양이도 가구도 16논리px = 32화면px. */
const PXS = 2;               // 논리 픽셀 1개를 화면 몇 px로
const FW = 16, FH = 16;      // 가구 = 타일 한 칸

/* ============================================================
   고양이 스프라이트 — "16-bit Kitties" (Maze.Bit.Boutique, CC BY 4.0)
   assets/cats_16bit/  · 16x16 프레임, 3x3 = 9프레임, 색상 4종
   CC BY 4.0라 상업 이용·수정·재배포 모두 가능하다. 표기만 하면 된다.

   시트 배치 (읽어서 확인함):
     0행 — 서 있는 3프레임  → 대기 / 이동
     1행 — 0열 서 있기, 1~2열 앉기 → 근무(책상 앞에 앉은 자세)
     2행 — 누운 3프레임      → 취침
   ============================================================ */
const CAT_SHEET = {
  dir: 'assets/cats_16bit/',
  colors: ['Black', 'Brown', 'Orange', 'White'],
  tile: 16, cols: 3, rows: 3,
  scale: PXS,
};
/* 상태 → { 행, 시작열, 프레임수 }. CSS 애니메이션이 가로로 훑기 때문에
   프레임은 반드시 같은 행에서 이어져 있어야 한다. */
const CAT_ANIM = {
  idle:  { row: 0, col: 0, n: 3 },
  walk:  { row: 0, col: 0, n: 3 },
  sit:   { row: 1, col: 1, n: 2 },
  sleep: { row: 2, col: 0, n: 3 },
};
const catSrc = c => CAT_SHEET.dir + '16x16-' + CAT_SHEET.colors[(c.fur || 0) % CAT_SHEET.colors.length] + '.png';

/* 색상 4종만으로는 직원 20마리를 구분할 수 없다.
   캔버스로 색을 바꾸면 file:// 에서 오염 문제가 생기므로 CSS 필터로 돌린다. */
function catFilter(c){
  if (c.npc === 'police') return 'hue-rotate(200deg) saturate(2.2) brightness(.95)';
  if (c.npc === 'legal')  return 'saturate(.25) brightness(.85)';
  const h = c.hue || 0;
  if (!h) return '';
  return `hue-rotate(${h}deg)`;
}

/* 액터용 — 배경 이미지/크기/세로위치. 가로 프레임 전환은 CSS 애니메이션이 한다. */
function catStyle(c, state){
  const a = CAT_ANIM[state] || CAT_ANIM.idle;
  const S = CAT_SHEET, px = S.tile * S.scale;
  const f = catFilter(c);
  return `background-image:url(${catSrc(c)});`
       + `background-size:${S.cols * px}px ${S.rows * px}px;`
       + `background-position-y:${-a.row * px}px;`
       + (f ? `filter:${f};` : '');
}
/* 애니메이션 클래스 (style.css의 @keyframes와 짝) */
function catAnimClass(state){
  const a = CAT_ANIM[state] || CAT_ANIM.idle;
  return 'an' + a.n + (a.col ? '-c' + a.col : '') + (state === 'walk' ? ' fast' : '');
}
/* 카드·모달용 정지 초상 — 앉은 프레임 하나 */
function catPortraitStyle(c){
  const S = CAT_SHEET, px = S.tile * S.scale, f = catFilter(c);
  return `background-image:url(${catSrc(c)});`
       + `background-size:${S.cols * px}px ${S.rows * px}px;`
       + `background-position:${-1 * px}px ${-1 * px}px;`
       + (f ? `filter:${f};` : '');
}
function catKey(c, state){
  return [c.fur, c.hue || 0, c.npc || '', state].join('|');
}

/* ---------- 가구 ---------- */
const F_DESK = [
  '................',
  '.....oooooo.....',
  '.....oddddo.....',
  '.....oddddo.....',
  '.....oddddo.....',
  '.....oooooo.....',
  '.......oo.......',
  'oooooooooooooooo',
  'obbbbbbbbbbbbbbo',
  'oaaaaaaaaaaaaaao',
  'oaaaaaaaaaaaaaao',
  'oooooooooooooooo',
  '.o............o.',
  '.o............o.',
  '.oo..........oo.',
  '................',
];
const F_MACHINE = [
  '..oooooooooooo..',
  '..obbbbbbbbbbo..',
  '..odddddddddbo..',
  '..odddddddddbo..',
  '..odddddddddbo..',
  '..obbbbbbbbbbo..',
  '..oaaaaaaaaabo..',
  '..oaaddddaaabo..',
  '..oaaddddaaabo..',
  '..oaaaaaaaaabo..',
  '..obbbbbbbbbbo..',
  '..oaaaaaaaaabo..',
  '..oaaaaaaaaabo..',
  '..oooooooooooo..',
  '...oo......oo...',
  '................',
];
const F_BOX = [
  '................',
  '................',
  '.oooooooooooooo.',
  '.odddddddddddoo.',
  '.oabbbbbbbbbaoo.',
  '.oaaaaaaaaaaaoo.',
  '.obbbbbbbbbbboo.',
  '.oaaaaaaaaaaaoo.',
  '.obbbbbbbbbbboo.',
  '.oaaaaaaaaaaaoo.',
  '.obbbbbbbbbbboo.',
  '.oaaaaaaaaaaaoo.',
  '.oooooooooooooo.',
  '..o..........o..',
  '..oo........oo..',
  '................',
];
const F_PLANT = [
  '.......od.......',
  '....odddddo.....',
  '..oddddddddo....',
  '.odddddddddddo..',
  '.oddddddddddo...',
  '..oddddddddo....',
  '....oddddo......',
  '......odo.......',
  '......odo.......',
  '....oooooooo....',
  '....obbbbbbo....',
  '....oaaaaaao....',
  '....obbbbbbo....',
  '....oaaaaaao....',
  '....oooooooo....',
  '................',
];
const F_BOARD = [
  '................',
  'oooooooooooooooo',
  'obbbbbbbbbbbbbbo',
  'obddbbbbdddbbbbo',
  'obbbbbbbbbbbbbbo',
  'obbdddbbbbbbbbbo',
  'obbbbbbbbbdddbbo',
  'obbbbbbbbbbbbbbo',
  'obddbbbbbbbbbbbo',
  'obbbbbbbbbbbbbbo',
  'obbbbbdddbbbbbbo',
  'oooooooooooooooo',
  '....o......o....',
  '....o......o....',
  '...oo......oo...',
  '................',
];
const F_DOC = [
  '................',
  '................',
  '...oooooooooo...',
  '...obbbbbbbbo...',
  '...oaabbbbaao...',
  '...obbbbbbbbo...',
  '...oaaaabbbbo...',
  '...obbbbbbbbo...',
  '...oaabbbbaao...',
  '...obbbbbbbbo...',
  '...oaaaabbbbo...',
  '...obbbbbbbbo...',
  '...oooooooooo...',
  '................',
  '................',
  '................',
];

/* ============================================================
   가구 타일셋 — LimeZu "Modern Office - Revamped" (구매 에셋)
   assets/modern_office/  · 16x16 타일, 마진 0
   라이선스: 상업/비상업 프로젝트 사용 가능, 에셋 자체의 재판매·재배포 금지.
   그래서 이 폴더는 .gitignore 로 저장소에서 제외한다 — README 설치 안내 참고.

   이 팩은 가구가 1x2칸(책상·정수기·자판기)인 게 많다. tall:2 로 표시하면
   위쪽 칸까지 넘겨 그린다. 게임 로직상 점유하는 칸은 여전히 아래 한 칸이다.
   ============================================================ */
const SHEET = {
  src: 'assets/modern_office/Modern_Office_Shadowless_16x16.png',
  w: 256, h: 848,          // 16 x 53 타일
  tile: 16, margin: 0,
  scale: PXS,
};
/* 바닥·벽 — 같은 팩의 Room Builder 시트 */
const ROOM = {
  src: 'assets/modern_office/Room_Builder_Office_16x16.png',
  w: 256, h: 224,          // 16 x 14 타일
  tile: 16, margin: 0,
  scale: PXS,
  /* 바닥은 구역마다 다르게 깐다 — 제작자 예시 배치가 그렇게 되어 있다.
     한 구역 안에서는 한 종류로 통일한다. LimeZu 바닥은 여러 칸이 이어진
     패턴이라 두 타일을 번갈아 깔면 가로 줄무늬처럼 어른거린다. */
  floor:  [10, 7],         // 본 사무실 — 짙은 회색 격자
  floor2: [13, 9],         // 휴게실 — 올리브 타일
  wall:   [8, 12],         // 벽면
  wallTop:[8, 11],         // 맨 윗줄 (윗면 마감이 있는 타일)
};

/* 가로로 2칸을 쓰는 가구. 한 칸만 잘라 쓰면 반쪽이 나온다.
   world.js가 이 표를 보고 오른쪽 칸을 FILLER로 예약한다. */
const FURN_SPAN = {};

/* 책상 위에 얹는 소품. 빈 나무판만 있으면 사무실로 안 보인다. */
const DESK_TOPS = [[8,44], [9,44], [10,9], [11,9], [13,12], [3,12]];

/* 타일 → 시트 좌표 { col, row, tall?, wide? } 또는 { shape, pal } (시트에 없는 것) */
const FURN = {};
const sheetAt = (tile, col, row, tall, wide) => {
  FURN[tile] = { col, row, tall: tall || 1, wide: wide || 1 };
  if (wide > 1) FURN_SPAN[tile] = wide;
};
function furn(tile, shape, a, b, d){ FURN[tile] = { shape, pal:{ o:'#3A2E28', a, b, d } }; }

sheetAt(TILE.DESK,        6, 21, 2, 2);  // 2인 책상 (2x2) — 오른쪽 절반은 DESK_R 칸
sheetAt(TILE.MEETING,    12, 21, 2, 2);  // 원목 회의 테이블 (2x2)
sheetAt(TILE.LEGAL,      14, 21, 2, 2);  // 원목 책상 — 법무팀 자리 (2x2)
sheetAt(TILE.COOLER,     12, 17, 3, 1);  // 정수기 (1x3)
sheetAt(TILE.PLANT,       6,  9, 3, 1);  // 잎 넓은 화분 (1x3)
sheetAt(TILE.COFFEE,      2, 25, 3, 2);  // 자판기 — 커피머신 (2x3)
sheetAt(TILE.FEEDER,      4, 25, 2, 2);  // 자판기 — 자동급식기 (2x2)
sheetAt(TILE.COPIER,      9, 23, 2, 1);  // 복합기 (1x2)
sheetAt(TILE.SERVER,     12, 24, 3, 2);  // 대형 기기 — 건조실 (2x3)
sheetAt(TILE.LAB,         7, 17, 3, 2);  // 대형 기기 — 정제실 (2x3)
sheetAt(TILE.GYM,         0, 25, 3, 2);  // 자판기 — 헬스장 (2x3)
sheetAt(TILE.TOWER,      13, 16, 2, 1);  // 1인용 의자 — 캣타워 (1x2)
sheetAt(TILE.BED,        11, 16, 2, 1);  // 1인용 의자 — 낮잠 자리 (1x2)
sheetAt(TILE.SCRATCH,     6, 14, 3, 1);  // 키 큰 화분 — 긁는 곳 (1x3)
sheetAt(TILE.WHITEBOARD,  9, 13, 2, 2);  // 차트 화이트보드 (2x2)
sheetAt(TILE.DECOR,       5, 12, 1, 1);  // 액자 (1x1)
sheetAt(TILE.SHELF,       7, 14, 3, 2);  // 책장 (2x3)
sheetAt(TILE.INBOX,       7, 11, 2, 1);  // 결재 서류 뭉치 (1x2)
// 시트에 대응물이 없어서 직접 그린 것
furn(TILE.LITTER, F_BOX,     '#9AA3AD', '#C3CAD3', '#7D8894');
furn(TILE.ROCKET, F_MACHINE, '#E4E9EE', '#FFFFFF', '#E2705C');

/* ---------- 렌더 ---------- */
const _cache = new Map();

function drawMap(g, map, pal, ox, oy, px){
  for (let y = 0; y < map.length; y++){
    const row = map[y];
    for (let x = 0; x < row.length; x++){
      const ch = row[x];
      if (ch === '.') continue;
      const col = pal[ch];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(ox + x*px, oy + y*px, px, px);
    }
  }
}



function catKey(c, state){
  return [c.fur, c.acc, c.npc || '', state,
          c.equip ? c.equip.head + ',' + c.equip.neck + ',' + c.equip.paw : ''].join('|');
}



/* 가구 한 칸을 그리는 CSS 배경 선언을 돌려준다.
   시트에서 잘라오는 쪽은 캔버스를 안 쓴다 — file:// 에서 외부 이미지를 캔버스에
   그리면 캔버스가 오염돼 toDataURL()이 막히기 때문. CSS 배경 슬라이싱은 그 제약이 없다. */
function furnStyle(tile){
  const key = 'fs|' + tile;
  const hit = _cache.get(key);
  if (hit) return hit;
  const def = FURN[tile];
  if (!def) return '';
  let css;
  if (def.col !== undefined){
    const S = SHEET, step = (S.tile + S.margin) * S.scale;
    const t = def.tall || 1, wd = def.wide || 1;
    // tall은 위쪽 칸으로, wide는 오른쪽 칸으로 넘겨 그린다.
    // 게임 로직이 차지하는 칸은 각각 아래 한 칸 / 왼쪽 한 칸이다.
    css = `background-image:url(${S.src});`
        + `background-size:${S.w * S.scale}px ${S.h * S.scale}px;`
        + `background-position:${-def.col * step}px ${-(def.row - t + 1) * step}px;`
        + `background-repeat:no-repeat;`
        + (t > 1 ? `height:${t * S.tile * S.scale}px;margin-top:${-(t-1) * S.tile * S.scale}px;` : '')
        + (wd > 1 ? `width:${wd * S.tile * S.scale}px;` : '');
  } else {
    const cv = document.createElement('canvas');
    cv.width = FW * PXS; cv.height = FH * PXS;
    drawMap(cv.getContext('2d'), def.shape, def.pal, 0, 0, PXS);
    css = `background-image:url(${cv.toDataURL()});background-size:${FW*PXS}px ${FH*PXS}px;`
        + `background-repeat:no-repeat`;
  }
  _cache.set(key, css);
  return css;
}

/* 책상 위 소품 — 책상 타일 위에 한 겹 더 얹는다. 좌표는 칸마다 고정(같은 자리는 늘 같은 물건). */
function deskTopStyle(x, y){
  const key = 'dt|' + x + ',' + y;
  const hit = _cache.get(key);
  if (hit) return hit;
  const [c, r] = DESK_TOPS[(x * 7 + y * 13) % DESK_TOPS.length];
  const S = SHEET, step = (S.tile + S.margin) * S.scale;
  const css = `background-image:url(${S.src});`
    + `background-size:${S.w * S.scale}px ${S.h * S.scale}px;`
    + `background-position:${-c * step}px ${-r * step}px;background-repeat:no-repeat`;
  _cache.set(key, css);
  return css;
}

/* 책상 위 소품 — 책상 타일 위에 한 겹 더 얹는다. 좌표는 칸마다 고정(같은 자리는 늘 같은 물건). */
function deskTopStyle(x, y){
  const key = 'dt|' + x + ',' + y;
  const hit = _cache.get(key);
  if (hit) return hit;
  const [c, r] = DESK_TOPS[(x * 7 + y * 13) % DESK_TOPS.length];
  const S = SHEET, step = (S.tile + S.margin) * S.scale;
  const css = `background-image:url(${S.src});`
    + `background-size:${S.w * S.scale}px ${S.h * S.scale}px;`
    + `background-position:${-c * step}px ${-r * step}px;background-repeat:no-repeat`;
  _cache.set(key, css);
  return css;
}

/* 바닥·벽도 같은 팩에서 잘라 쓴다 */
function roomStyle(kind){
  const key = 'rs|' + kind;
  const hit = _cache.get(key);
  if (hit) return hit;
  const [c, r] = ROOM[kind] || ROOM.floor;
  const step = (ROOM.tile + ROOM.margin) * ROOM.scale;
  const css = `background-image:url(${ROOM.src});`
    + `background-size:${ROOM.w * ROOM.scale}px ${ROOM.h * ROOM.scale}px;`
    + `background-position:${-c * step}px ${-r * step}px;background-repeat:no-repeat`;
  _cache.set(key, css);
  return css;
}

function docSprite(){
  const hit = _cache.get('doc');
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = FW * PXS; cv.height = FH * PXS;
  drawMap(cv.getContext('2d'), F_DOC, { o:'#3A2E28', a:'#C9B8A8', b:'#FFFDF8', d:'#C4587A' }, 0, 0, PXS);
  const url = cv.toDataURL();
  _cache.set('doc', url);
  return url;
}
function docRedSprite(){
  const hit = _cache.get('docred');
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = FW * PXS; cv.height = FH * PXS;
  drawMap(cv.getContext('2d'), F_DOC, { o:'#5A1F1F', a:'#E09A9A', b:'#FFE3E3', d:'#C4243C' }, 0, 0, PXS);
  const url = cv.toDataURL();
  _cache.set('docred', url);
  return url;
}
function clearSpriteCache(){ _cache.clear(); }
