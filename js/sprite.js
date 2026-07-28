/* ============================================================
   sprite.js — 도트 스프라이트 (GitAnimals풍)
   ASCII 맵 → 캔버스 → dataURL 캐시. 외부 이미지 파일 없음.
   ============================================================ */

const SW = 24, SH = 20;      // 고양이 스프라이트 논리 크기(픽셀 단위)
const PXS = 2;               // 논리 픽셀 1개를 캔버스 몇 px로 그릴지
const FW = 16, FH = 16;      // 가구 스프라이트 논리 크기

/* ---------- 고양이 ---------- */
const CAT_IDLE = [
  '........................',
  '.....oo........oo.......',
  '....obbo......obbo......',
  '....oppo......oppo......',
  '...obbbbbbbbbbbbbbo.....',
  '..obbbbbbbbbbbbbbbbo....',
  '..obbbbbbbbbbbbbbbbo....',
  '..obbbweebbbbweebbbo....',
  '..obbbeeebbbbeeebbbo....',
  '..obbbeeebbbbeeebbbo....',
  '..obbbbbbbppbbbbbbbo....',
  '..obbbbbbobbobbbbbbo....',
  '...obbbbbbbbbbbbbbo.....',
  '....obbbbbbbbbbbbo......',
  '....obbbbbbbbbbbbo......',
  '....obbbbbbbbbbbbo...oo.',
  '....obbbbbbbbbbbboooodo.',
  '....obbbbbbbbbbbboodddo.',
  '....obbbboobbbbo..ooooo.',
  '........................',
];

const CAT_WALK = [
  '........................',
  '........................',
  '.....oo........oo.......',
  '....obbo......obbo......',
  '....oppo......oppo......',
  '...obbbbbbbbbbbbbbo.....',
  '..obbbbbbbbbbbbbbbbo....',
  '..obbbbbbbbbbbbbbbbo....',
  '..obbbweebbbbweebbbo....',
  '..obbbeeebbbbeeebbbo....',
  '..obbbeeebbbbeeebbbo....',
  '..obbbbbbbppbbbbbbbo....',
  '..obbbbbbobbobbbbbbo....',
  '...obbbbbbbbbbbbbbo.oo..',
  '....obbbbbbbbbbbboodo...',
  '....obbbbbbbbbbbboddo...',
  '....obbbbbbbbbbbbooooo..',
  '...obbo..obbbbo.oo......',
  '...ooo....oooo..........',
  '........................',
];

const CAT_SLEEP = [
  '........................',
  '........................',
  '.....oo........oo.......',
  '....obbo......obbo......',
  '....oppo......oppo......',
  '...obbbbbbbbbbbbbbo.....',
  '..obbbbbbbbbbbbbbbbo....',
  '..obbbbbbbbbbbbbbbbo....',
  '..obbbbbbbbbbbbbbbbo....',
  '..obbboooobboooobbbo....',
  '..obbbbbbbppbbbbbbbo....',
  '..obbbbbbbbbbbbbbbbo....',
  '...obbbbbbbbbbbbbbo.....',
  '....obbbbbbbbbbbbo......',
  '....obbbbbbbbbbbbo......',
  '....obbbbbbbbbbbbo...oo.',
  '....obbbbbbbbbbbboooodo.',
  '....obbbbbbbbbbbboodddo.',
  '....obbbboobbbbo..ooooo.',
  '........................',
];

/* 악세서리 / 장비 오버레이 [y, x, 색키] */
const OVERLAY = {
  tie:     [[13,8,'2'],[13,9,'2'],[13,12,'2'],[13,13,'2'],[14,9,'2'],[14,10,'2'],[14,11,'2'],[14,12,'2'],
            [15,10,'1'],[15,11,'1'],[16,9,'1'],[16,10,'1'],[16,11,'1'],[16,12,'1'],[17,10,'1'],[17,11,'1']],
  bow:     [[13,9,'2'],[13,10,'2'],[13,11,'2'],[13,12,'2'],
            [14,8,'1'],[14,9,'1'],[14,10,'3'],[14,11,'1'],[14,12,'1'],[15,9,'1'],[15,10,'3'],[15,11,'1']],
  scarf:   [[13,6,'1'],[13,7,'1'],[13,8,'1'],[13,9,'1'],[13,10,'1'],[13,11,'1'],[13,12,'1'],[13,13,'1'],[13,14,'1'],[13,15,'1'],
            [14,6,'2'],[14,7,'2'],[14,8,'2'],[14,9,'2'],[14,10,'2'],[14,11,'2'],[14,12,'2'],[14,13,'2'],[14,14,'2'],[14,15,'2'],
            [15,13,'1'],[16,13,'2'],[17,13,'1']],
  bell:    [[13,8,'2'],[13,9,'2'],[13,10,'2'],[13,11,'2'],[13,12,'2'],[13,13,'2'],
            [14,10,'1'],[14,11,'1'],[15,10,'1'],[15,11,'1']],
  glasses: [[6,5,'2'],[6,6,'2'],[6,7,'2'],[6,8,'2'],[6,13,'2'],[6,14,'2'],[6,15,'2'],[6,16,'2'],
            [7,5,'2'],[7,9,'2'],[7,12,'2'],[7,16,'2'],[8,5,'2'],[8,16,'2'],
            [8,9,'2'],[8,10,'2'],[8,11,'2'],[8,12,'2'],
            [9,5,'2'],[9,6,'2'],[9,7,'2'],[9,8,'2'],[9,13,'2'],[9,14,'2'],[9,15,'2'],[9,16,'2']],
  headset: [[3,3,'2'],[4,2,'2'],[5,2,'2'],[6,2,'2'],[7,2,'2'],[3,18,'2'],[4,19,'2'],[5,19,'2'],[6,19,'2'],[7,19,'2'],
            [2,4,'2'],[2,5,'2'],[1,6,'2'],[1,7,'2'],[1,8,'2'],[0,9,'2'],[0,10,'2'],[0,11,'2'],[0,12,'2'],
            [1,13,'2'],[1,14,'2'],[1,15,'2'],[2,16,'2'],[2,17,'2'],
            [5,1,'1'],[6,1,'1'],[7,1,'1'],[5,20,'1'],[6,20,'1'],[7,20,'1']],
  cap:     [[2,6,'1'],[2,7,'1'],[2,8,'1'],[2,9,'1'],[2,10,'1'],[2,11,'1'],[2,12,'1'],[2,13,'1'],[2,14,'1'],[2,15,'1'],
            [3,5,'1'],[3,6,'1'],[3,7,'1'],[3,8,'1'],[3,9,'1'],[3,10,'1'],[3,11,'1'],[3,12,'1'],[3,13,'1'],[3,14,'1'],[3,15,'1'],[3,16,'1'],
            [4,4,'2'],[4,5,'2'],[4,6,'2'],[4,7,'2'],[4,8,'2'],[4,9,'2'],[4,10,'2'],[4,11,'2'],[4,12,'2'],[4,13,'2'],[4,14,'2'],[4,15,'2'],[4,16,'2'],[4,17,'2']],
  crown:   [[1,7,'1'],[1,10,'1'],[1,13,'1'],
            [2,7,'1'],[2,8,'1'],[2,9,'1'],[2,10,'1'],[2,11,'1'],[2,12,'1'],[2,13,'1'],
            [3,6,'1'],[3,7,'1'],[3,8,'1'],[3,9,'1'],[3,10,'1'],[3,11,'1'],[3,12,'1'],[3,13,'1'],[3,14,'1'],
            [4,6,'2'],[4,7,'2'],[4,8,'2'],[4,9,'2'],[4,10,'2'],[4,11,'2'],[4,12,'2'],[4,13,'2'],[4,14,'2']],
  shoes:   [[18,4,'1'],[18,5,'1'],[18,6,'1'],[18,7,'1'],[18,8,'1'],[18,11,'1'],[18,12,'1'],[18,13,'1'],[18,14,'1'],[18,15,'1']],
  gloves:  [[18,4,'2'],[18,5,'2'],[18,6,'2'],[18,11,'2'],[18,12,'2'],[18,13,'2']],
  cushion: [[19,4,'1'],[19,5,'1'],[19,6,'1'],[19,7,'1'],[19,8,'1'],[19,9,'1'],[19,10,'1'],[19,11,'1'],
            [19,12,'1'],[19,13,'1'],[19,14,'1'],[19,15,'1'],[19,16,'1']],
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
  '..oooooooooooo..',
  '..obbbbbbbbbbo..',
  '..oaaaaaaaaaao..',
  '..oooooooooooo..',
  '...o........o...',
  '...o........o...',
  '...oo......oo...',
  '................',
  '................',
];
const F_MACHINE = [
  '................',
  '....oooooooo....',
  '....obbbbbbo....',
  '....odddddbo....',
  '....odddddbo....',
  '....obbbbbbo....',
  '....oaaaaabo....',
  '....oaddaabo....',
  '....oaaaaabo....',
  '....obbbbbbo....',
  '....oaaaaabo....',
  '....oooooooo....',
  '.....o....o.....',
  '................',
  '................',
  '................',
];
const F_BOX = [
  '................',
  '................',
  '................',
  '...oooooooooo...',
  '...odddddddoo...',
  '...oabbbbbaoo...',
  '...oaaaaaaaoo...',
  '...obbbbbbboo...',
  '...oaaaaaaaoo...',
  '...obbbbbbboo...',
  '...oaaaaaaaoo...',
  '...oooooooooo...',
  '....o......o....',
  '................',
  '................',
  '................',
];
const F_PLANT = [
  '................',
  '.......od.......',
  '.....oddddo.....',
  '....odddddddo...',
  '...oddddddddo...',
  '....oddddddo....',
  '.....oddddo.....',
  '.......dd.......',
  '.......oo.......',
  '.....oooooo.....',
  '.....obbbbo.....',
  '.....oaaaao.....',
  '.....obbbbo.....',
  '.....oooooo.....',
  '................',
  '................',
];
const F_BOARD = [
  '................',
  '..oooooooooooo..',
  '..obbbbbbbbbbo..',
  '..obddbbbddbbo..',
  '..obbbbbbbbbbo..',
  '..obbdddbbbbbo..',
  '..obbbbbbbddbo..',
  '..obbbbbbbbbbo..',
  '..obddbbbbbbbo..',
  '..obbbbbbbbbbo..',
  '..oooooooooooo..',
  '.....o....o.....',
  '.....o....o.....',
  '....oo....oo....',
  '................',
  '................',
];
const F_DOC = [
  '................',
  '................',
  '................',
  '....oooooooo....',
  '....obbbbbbo....',
  '....oaabbaao....',
  '....obbbbbbo....',
  '....oaaaabbo....',
  '....obbbbbbo....',
  '....oaabbaao....',
  '....obbbbbbo....',
  '....oooooooo....',
  '................',
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
