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

/* 타일 → { 모양, 팔레트 } */
const FURN = {};
function furn(tile, shape, a, b, d){ FURN[tile] = { shape, pal:{ o:'#3A2E28', a, b, d } }; }
furn(TILE.DESK,      F_DESK,    '#C9A47C', '#E8CFA8', '#4A6B8A');
furn(TILE.MEETING,   F_DESK,    '#B58A5F', '#D9B98C', '#7FCDB8');
furn(TILE.LEGAL,     F_DESK,    '#5A4A42', '#7A6558', '#C4587A');
furn(TILE.INBOX,     F_BOX,     '#D96C5F', '#F09183', '#FFF6E9');
furn(TILE.BED,       F_BOX,     '#C9A47C', '#E8D3B0', '#A8804F');
furn(TILE.LITTER,    F_BOX,     '#9AA3AD', '#C3CAD3', '#7D8894');
furn(TILE.COOLER,    F_MACHINE, '#DCEBF8', '#FFFFFF', '#7FB6EC');
furn(TILE.COFFEE,    F_MACHINE, '#6B4C3A', '#8D6A52', '#F2E2C6');
furn(TILE.COPIER,    F_MACHINE, '#7A8590', '#9FAAB4', '#DCE4EA');
furn(TILE.SERVER,    F_MACHINE, '#3F4A56', '#59677A', '#7FCDB8');
furn(TILE.FEEDER,    F_MACHINE, '#E8D3B0', '#FFF0D6', '#F5C451');
furn(TILE.LAB,       F_MACHINE, '#DCE4EA', '#FFFFFF', '#7FCDB8');
furn(TILE.GYM,       F_MACHINE, '#5A6470', '#7C8794', '#F5C451');
furn(TILE.ROCKET,    F_MACHINE, '#E4E9EE', '#FFFFFF', '#E2705C');
furn(TILE.PLANT,     F_PLANT,   '#B5744E', '#D08F63', '#5FA86B');
furn(TILE.TOWER,     F_PLANT,   '#C9A47C', '#E8D3B0', '#A8804F');
furn(TILE.SCRATCH,   F_PLANT,   '#C9A47C', '#E8D3B0', '#C98A4B');
furn(TILE.WHITEBOARD,F_BOARD,   '#DDD3C6', '#FFFDF8', '#5F8FBF');

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

function furnSprite(tile){
  const key = 'f|' + tile;
  const hit = _cache.get(key);
  if (hit) return hit;
  const def = FURN[tile];
  if (!def) return null;
  const cv = document.createElement('canvas');
  cv.width = FW * PXS; cv.height = FH * PXS;
  drawMap(cv.getContext('2d'), def.shape, def.pal, 0, 0, PXS);
  const url = cv.toDataURL();
  _cache.set(key, url);
  return url;
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
