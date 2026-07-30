/* ============================================================
   sprite.js — 도트 스프라이트 (GitAnimals풍)
   ASCII 맵 → 캔버스 → dataURL 캐시. 외부 이미지 파일 없음.
   ============================================================ */

/* 크기 규칙: 가구가 타일 한 칸(16논리 = 32px)을 꽉 채우고, 고양이는 그보다 작다(14x13논리 = 28x26px).
   현실의 고양이는 책상보다 작다. 픽셀 밀도(PXS)는 전부 같아야 도트가 안 깨진다. */
const SW = 14, SH = 13;      // 고양이 스프라이트 논리 크기
const PXS = 2;               // 논리 픽셀 1개를 캔버스 몇 px로
const FW = 16, FH = 16;      // 가구 = 타일 한 칸

/* ---------- 고양이 ---------- */
const CAT_IDLE = [
  '.oo......oo...',
  'oppo....oppo..',
  'obbbbbbbbbbo..',
  'obbbbbbbbbbo..',
  'obbeebbeebbo..',
  'obbeebbeebbo..',
  'obbbbppbbbbo..',
  'obbbobbobbbo..',
  '.obbbbbbbbo...',
  '..obbbbbbo.oo.',
  '.obbbbbbbboddo',
  '.obbbbbbbbodo.',
  '.obboobbo.....',
];

const CAT_WALK = [
  '..............',
  '.oo......oo...',
  'oppo....oppo..',
  'obbbbbbbbbbo..',
  'obbbbbbbbbbo..',
  'obbeebbeebbo..',
  'obbeebbeebbo..',
  'obbbbppbbbbo..',
  'obbbobbobbbo..',
  '.obbbbbbbbo.oo',
  '..obbbbbbo.ddo',
  '.obbbbbbbboodo',
  'oo.oo..oo.....',
];

const CAT_SLEEP = [
  '..............',
  '.oo......oo...',
  'oppo....oppo..',
  'obbbbbbbbbbo..',
  'obbbbbbbbbbo..',
  'obbbbbbbbbbo..',
  'obboobboobbo..',
  'obbbbppbbbbo..',
  'obbbbbbbbbbo..',
  '.obbbbbbbbo...',
  '..obbbbbbo.oo.',
  '.obbbbbbbboddo',
  '.obbbbbbbbodo.',
];

/* 악세서리 / 장비 오버레이 [y, x, 색키] */
const OVERLAY = {
  tie:     [[8,3,'2'],[8,4,'2'],[8,5,'2'],[8,6,'2'],[8,7,'2'],[8,8,'2'],
            [9,5,'1'],[9,6,'1'],[10,5,'1'],[10,6,'1'],[11,5,'1'],[11,6,'1']],
  bow:     [[8,4,'1'],[8,5,'1'],[8,6,'3'],[8,7,'1'],[8,8,'1'],[9,5,'1'],[9,6,'3'],[9,7,'1']],
  scarf:   [[8,2,'1'],[8,3,'1'],[8,4,'1'],[8,5,'1'],[8,6,'1'],[8,7,'1'],[8,8,'1'],[8,9,'1'],
            [9,3,'2'],[9,4,'2'],[9,5,'2'],[9,6,'2'],[9,7,'2'],[9,8,'2'],[10,8,'1'],[11,8,'2']],
  bell:    [[8,3,'2'],[8,4,'2'],[8,5,'2'],[8,6,'2'],[8,7,'2'],[8,8,'2'],[9,5,'1'],[9,6,'1']],
  glasses: [[3,2,'2'],[3,3,'2'],[3,4,'2'],[3,5,'2'],[3,6,'2'],[3,7,'2'],[3,8,'2'],[3,9,'2'],
            [4,2,'2'],[4,5,'2'],[4,6,'2'],[4,9,'2'],[5,2,'2'],[5,5,'2'],[5,6,'2'],[5,9,'2'],
            [6,2,'2'],[6,3,'2'],[6,4,'2'],[6,7,'2'],[6,8,'2'],[6,9,'2']],
  headset: [[0,4,'2'],[0,5,'2'],[0,6,'2'],[0,7,'2'],[1,2,'2'],[1,3,'2'],[1,8,'2'],[1,9,'2'],
            [2,0,'2'],[3,0,'2'],[2,11,'2'],[3,11,'2'],[4,0,'1'],[5,0,'1'],[4,11,'1'],[5,11,'1']],
  cap:     [[0,3,'1'],[0,4,'1'],[0,5,'1'],[0,6,'1'],[0,7,'1'],[0,8,'1'],
            [1,2,'1'],[1,3,'1'],[1,4,'1'],[1,5,'1'],[1,6,'1'],[1,7,'1'],[1,8,'1'],[1,9,'1'],
            [2,1,'2'],[2,2,'2'],[2,3,'2'],[2,4,'2'],[2,5,'2'],[2,6,'2'],[2,7,'2'],[2,8,'2'],[2,9,'2'],[2,10,'2']],
  crown:   [[0,3,'1'],[0,5,'1'],[0,6,'1'],[0,8,'1'],
            [1,3,'1'],[1,4,'1'],[1,5,'1'],[1,6,'1'],[1,7,'1'],[1,8,'1'],
            [2,3,'2'],[2,4,'2'],[2,5,'2'],[2,6,'2'],[2,7,'2'],[2,8,'2']],
  shoes:   [[12,2,'1'],[12,3,'1'],[12,6,'1'],[12,7,'1']],
  gloves:  [[12,2,'2'],[12,3,'2'],[12,6,'2'],[12,7,'2']],
  cushion: [[12,1,'1'],[12,4,'1'],[12,5,'1'],[12,8,'1'],[12,9,'1']],
};

/* 장비 → 오버레이 이름 + 색 */
const EQUIP_LOOK = {
  glasses:{ ov:'glasses', c1:'#C9553F', c2:'#8E3A2A' },
  cap:    { ov:'cap',     c1:'#6FA8D6', c2:'#4E7FA8' },
  crown:  { ov:'crown',   c1:'#F5C451', c2:'#D9A62F' },
  tie:    { ov:'tie',     c1:'#E2705C', c2:'#B9553F' },
  bell:   { ov:'bell',    c1:'#F5C451', c2:'#C4587A' },
  scarf:  { ov:'scarf',   c1:'#E28C8C', c2:'#C46B6B' },
  shoes:  { ov:'shoes',   c1:'#7FCDB8', c2:'#4F9E88' },
  gloves: { ov:'gloves',  c1:'#DDD3C6', c2:'#B8ADA0' },
  cushion:{ ov:'cushion', c1:'#C9A2E0', c2:'#A87FC0' },
};
const ACC_LOOK = {
  tie:    { ov:'tie',     c1:'#E2705C', c2:'#B9553F' },
  bow:    { ov:'bow',     c1:'#F0899F', c2:'#D96C84', c3:'#FFFFFF' },
  glasses:{ ov:'glasses', c1:'#4A3B33', c2:'#3A2E28' },
  headset:{ ov:'headset', c1:'#7A8FA8', c2:'#4A5D75' },
  none:   null,
};

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
  // 바닥은 한 종류로 통일한다. LimeZu 바닥은 여러 칸이 이어진 패턴이라
  // 두 타일을 번갈아 깔면 가로 줄무늬처럼 어른거린다.
  floor:  [10, 5],
  floor2: [10, 5],
  wall:   [0, 9],          // 벽면
};

/* 타일 → 시트 좌표 { col, row, tall? } 또는 { shape, pal } (시트에 없는 것) */
const FURN = {};
const sheetAt = (tile, col, row, tall) => { FURN[tile] = { col, row, tall: tall || 1 }; };
function furn(tile, shape, a, b, d){ FURN[tile] = { shape, pal:{ o:'#3A2E28', a, b, d } }; }

sheetAt(TILE.DESK,       5,  3, 2);   // 책상 (위 칸까지 2칸)
sheetAt(TILE.MEETING,   13, 21);      // 원목 회의 테이블
sheetAt(TILE.LEGAL,     15, 21);      // 짙은 원목 책상 — 법무팀 자리
sheetAt(TILE.COOLER,    12, 16, 2);   // 정수기
sheetAt(TILE.PLANT,      6,  8);      // 잎 넓은 화분
sheetAt(TILE.COFFEE,     2, 25, 2);   // 자판기 — 커피머신
sheetAt(TILE.FEEDER,     4, 25, 2);   // 자판기 — 자동급식기
sheetAt(TILE.COPIER,     9, 22);      // 복합기
sheetAt(TILE.SERVER,     2, 24, 2);   // 회색 랙 — 서버룸
sheetAt(TILE.LAB,        3, 24, 2);   // 회색 랙 — 냥연구소
sheetAt(TILE.GYM,        0, 24, 2);   // 라커 — 헬스장
sheetAt(TILE.TOWER,      4, 16, 2);   // 안락의자 — 캣타워
sheetAt(TILE.BED,        3, 16, 2);   // 안락의자 — 낮잠 자리
sheetAt(TILE.SCRATCH,    6, 13);      // 키 큰 화분 — 긁는 곳
sheetAt(TILE.WHITEBOARD, 9, 13);      // 차트 화이트보드
sheetAt(TILE.DECOR,      5, 12);      // 액자
sheetAt(TILE.SHELF,      7, 13);      // 책장
sheetAt(TILE.INBOX,      7, 11);      // 결재 서류 뭉치
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
function overlay(map, list){
  if (!list || !list.length) return map;
  const g = map.map(r => r.split(''));
  list.forEach(([y,x,c]) => { if (g[y] && g[y][x] !== undefined) g[y][x] = c; });
  return g.map(r => r.join(''));
}
function shiftDown(map, n){
  const blank = '.'.repeat(map[0].length);
  return Array.from({length:n}, () => blank).concat(map.slice(0, map.length - n));
}

function catPalette(c){
  const f = FURS[c.fur % FURS.length];
  const dark = c.npc === 'police' ? '#2B3A55' : c.npc === 'legal' ? '#2A2724' : '#3A2E28';
  return { o:dark, b:f.b, d:f.d, p:f.e, e:dark, w:'#FFFFFF', m:'#FFF0D6' };
}

/* 고양이가 걸치고 있는 모든 오버레이를 합친다 */
function catOverlays(c){
  const out = [];
  const push = (look) => {
    if (!look) return;
    const ov = OVERLAY[look.ov];
    if (!ov) return;
    out.push({ ov, c1:look.c1, c2:look.c2, c3:look.c3 });
  };
  push(ACC_LOOK[c.acc]);
  if (c.equip){
    ['head','neck','paw'].forEach(sl => { if (c.equip[sl]) push(EQUIP_LOOK[c.equip[sl]]); });
  }
  return out;
}

/* 오버레이 i번의 j번째 색에 대응하는 1글자 팔레트 키 (A,B,C,D,…) */
const ovKey = (i, j) => String.fromCharCode(65 + i * 3 + j);

function catKey(c, state){
  return [c.fur, c.acc, c.npc || '', state,
          c.equip ? c.equip.head + ',' + c.equip.neck + ',' + c.equip.paw : ''].join('|');
}

/* 2프레임 시트를 만들어 dataURL로 돌려준다 */
function catSheet(c, state){
  const key = catKey(c, state);
  const hit = _cache.get(key);
  if (hit) return hit;

  const base = state === 'sleep' ? CAT_SLEEP : state === 'walk' ? CAT_WALK : CAT_IDLE;
  const frames = state === 'walk' ? [CAT_IDLE, CAT_WALK] : [base, shiftDown(base, 1)];

  const cv = document.createElement('canvas');
  cv.width = SW * PXS * 2; cv.height = SH * PXS;
  const g = cv.getContext('2d');
  const pal = catPalette(c);
  const ovs = catOverlays(c);

  frames.forEach((mapRaw, fi) => {
    let map = mapRaw;
    const p = { ...pal };
    ovs.forEach((o, i) => {
      // 색키는 반드시 1글자여야 한다(맵이 문자열 격자라 폭이 밀린다)
      const k1 = ovKey(i, 0), k2 = ovKey(i, 1), k3 = ovKey(i, 2);
      p[k1] = o.c1; p[k2] = o.c2; p[k3] = o.c3 || '#FFFFFF';
      const shifted = (fi === 1 && state !== 'walk')
        ? o.ov.map(([y,x,ch]) => [y+1, x, ch])
        : o.ov;
      map = overlay(map, shifted.map(([y,x,ch]) =>
        [y, x, ch === '1' ? k1 : ch === '2' ? k2 : ch === '3' ? k3 : ch]));
    });
    drawMap(g, map, p, fi * SW * PXS, 0, PXS);
  });

  const url = cv.toDataURL();
  _cache.set(key, url);
  return url;
}

/* 카드/모달용 단일 프레임 */
function catPortrait(c){
  const key = 'p|' + catKey(c, 'idle');
  const hit = _cache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = SW * PXS; cv.height = SH * PXS;
  const g = cv.getContext('2d');
  const pal = catPalette(c);
  let map = CAT_IDLE;
  const p = { ...pal };
  catOverlays(c).forEach((o, i) => {
    const k1=ovKey(i,0), k2=ovKey(i,1), k3=ovKey(i,2);
    p[k1]=o.c1; p[k2]=o.c2; p[k3]=o.c3||'#FFFFFF';
    map = overlay(map, o.ov.map(([y,x,ch]) => [y, x, ch==='1'?k1:ch==='2'?k2:ch==='3'?k3:ch]));
  });
  drawMap(g, map, p, 0, 0, PXS);
  const url = cv.toDataURL();
  _cache.set(key, url);
  return url;
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
    const S = SHEET, step = (S.tile + S.margin) * S.scale, t = def.tall || 1;
    // tall 가구는 위쪽 칸으로 넘겨 그린다. 차지하는 칸은 여전히 아래 한 칸.
    css = `background-image:url(${S.src});`
        + `background-size:${S.w * S.scale}px ${S.h * S.scale}px;`
        + `background-position:${-def.col * step}px ${-(def.row - t + 1) * step}px;`
        + `background-repeat:no-repeat;`
        + (t > 1 ? `height:${t * S.tile * S.scale}px;margin-top:${-(t-1) * S.tile * S.scale}px;z-index:1;` : '');
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
