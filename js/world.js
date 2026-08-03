/* ============================================================
   world.js — 절차적 사무실 생성 + 길찾기
   OpenMMO의 procedural terrain 아이디어를 사무실 평면도로 옮긴 것.
   같은 seed면 같은 사무실이 나온다(저장/복원 가능).
   ============================================================ */

const TILE = {
  FLOOR:0, WALL:1, DESK:2, DOOR:3, WINDOW:4, INBOX:5,
  BED:6, LITTER:7, COOLER:8, PLANT:9,
  COFFEE:10, COPIER:11, TOWER:12, SCRATCH:13, SERVER:14,
  FEEDER:15, MEETING:16, GYM:17, LAB:18, ROCKET:19, WHITEBOARD:20, LEGAL:21,
  DECOR:22, SHELF:23, FILLER:24, DESK_R:25, FILLER:24,
};

// 걸어 다닐 수 있는 타일
const WALKABLE = new Set([TILE.FLOOR, TILE.DOOR]);

// 가구 렌더 정보 { 이모지, 이름, 상호작용 종류 }
const TILE_INFO = {
  [TILE.DESK]:      { em:'💻', n: L({ ko:'책상',        en:'Desk',           ja:'デスク' }),               use:'work'   },
  [TILE.INBOX]:     { em:'📥', n: L({ ko:'결재함',      en:'Inbox',          ja:'決裁箱' }),               use:'inbox'  },
  [TILE.BED]:       { em:'🧺', n: L({ ko:'낮잠 상자',   en:'Nap Box',        ja:'昼寝箱' }),               use:'sleep'  },
  [TILE.LITTER]:    { em:'🪣', n: L({ ko:'모래상자',    en:'Litter Box',     ja:'猫トイレ' }),             use:'litter' },
  [TILE.COOLER]:    { em:'🚰', n: L({ ko:'정수기',      en:'Water Cooler',   ja:'ウォーターサーバー' }),   use:'social' },
  [TILE.PLANT]:     { em:'🪴', n: L({ ko:'화분',        en:'Plant',          ja:'観葉植物' }),             use:'social' },
  [TILE.COFFEE]:    { em:'☕', n: L({ ko:'커피머신',    en:'Coffee Machine', ja:'コーヒーマシン' }),       use:'coffee' },
  [TILE.COPIER]:    { em:'🖨️', n: L({ ko:'복사기',     en:'Copier',         ja:'コピー機' }),             use:'work'   },
  [TILE.TOWER]:     { em:'🗼', n: L({ ko:'캣타워',      en:'Cat Tower',      ja:'キャットタワー' }),       use:'sleep'  },
  [TILE.SCRATCH]:   { em:'🪵', n: L({ ko:'스크래처',    en:'Scratcher',      ja:'爪とぎ' }),               use:'social' },
  [TILE.SERVER]:    { em:'🖥️', n: L({ ko:'건조실',     en:'Drying Room',    ja:'乾燥室' }),               use:'sleep'  },
  [TILE.FEEDER]:    { em:'🍚', n: L({ ko:'자동급식기',  en:'Auto Feeder',    ja:'自動給餌器' }),           use:'coffee' },
  [TILE.MEETING]:   { em:'🪑', n: L({ ko:'회의 테이블', en:'Meeting Table',  ja:'会議テーブル' }),         use:'social' },
  [TILE.GYM]:       { em:'🏋️', n: L({ ko:'헬스장',     en:'Gym',            ja:'ジム' }),                 use:'social' },
  [TILE.LAB]:       { em:'🔬', n: L({ ko:'정제실',      en:'Refinery',       ja:'精製室' }),               use:'work'   },
  [TILE.ROCKET]:    { em:'🚀', n: L({ ko:'사내 로켓',   en:'Company Rocket', ja:'社用ロケット' }),         use:'social' },
  [TILE.WHITEBOARD]:{ em:'📋', n: L({ ko:'화이트보드',  en:'Whiteboard',     ja:'ホワイトボード' }),       use:null     },
  [TILE.LEGAL]:     { em:'⚖️', n: L({ ko:'법무팀 데스크',en:'Legal Desk',    ja:'法務デスク' }),           use:'legal'  },
  [TILE.DECOR]:     { em:'🖼️', n: L({ ko:'사내 액자',  en:'Office Art',     ja:'社内アート' }),           use:null     },
  [TILE.SHELF]:     { em:'🗄️', n: L({ ko:'문서 선반',  en:'File Shelf',     ja:'書類棚' }),               use:null     },
  [TILE.FILLER]:    { em:'',   n:'',  use:null   },   // 여러 칸 가구가 차지하는 나머지 칸
  [TILE.DESK_R]:    { em:'💻', n: L({ ko:'책상', en:'Desk', ja:'デスク' }),  use:'work' },   // 2칸 책상의 오른쪽 절반
};

function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- 사무실 등급 ---------- */
/* 방 비율은 정사각형에 가깝게 둔다. 타일셋 제작자의 예시 배치가 26x24, 32x34였고,
   가로로 길쭉하면 가로가 먼저 꽉 차서 세로에 검은 여백만 남는다. */
const TIERS = [
  { name: L({ ko:'골목 종이상자 지점', en:'Alley Cardboard Branch',   ja:'路地裏ダンボール支店' }), w:12, h:10, desks:2,
    flavor: L({ ko:'비가 오면 젖는다. 그래도 사무실이다.',    en:'It gets wet when it rains. Still an office.',        ja:'雨が降ると濡れる。それでもオフィスだ。' }) },
  { name: L({ ko:'반지하 원룸 오피스', en:'Semi-basement Studio',     ja:'半地下ワンルームオフィス' }), w:14, h:12, desks:4,
    flavor: L({ ko:'창문이 발목 높이에 있다.',                en:'The window is at ankle height.',                     ja:'窓が足首の高さにある。' }) },
  { name: L({ ko:'상가 2층 사무실',    en:'2nd-floor Walk-up Office', ja:'商店街2階オフィス' }), w:16, h:14, desks:6,
    flavor: L({ ko:'아래층 붕어빵 냄새가 올라온다.',          en:'The taiyaki smell drifts up from downstairs.',       ja:'下の階からたい焼きの匂いが上がってくる。' }) },
  { name: L({ ko:'냥코 소형 빌딩',     en:'Nyanco Small Building',    ja:'ニャンコ小型ビル' }), w:18, h:16, desks:9,
    flavor: L({ ko:'드디어 엘리베이터가 생겼다.',             en:'Finally, an elevator.',                              ja:'ついにエレベーターができた。' }) },
  { name: L({ ko:'냥코퍼레이션 사옥',  en:'Nyancorporation HQ',       ja:'ニャンコーポレーション本社' }), w:21, h:18, desks:12,
    flavor: L({ ko:'로비에 대형 캣타워가 서 있다.',           en:'A giant cat tower stands in the lobby.',             ja:'ロビーに巨大キャットタワーが立っている。' }) },
  { name: L({ ko:'냥타워',            en:'Nyan Tower',               ja:'ニャンタワー' }), w:23, h:20, desks:16,
    flavor: L({ ko:'야경이 보인다. 야근도 보인다.',           en:'You can see the night view. And the overtime.',      ja:'夜景が見える。残業も見える。' }) },
  { name: L({ ko:'달 지사 (Moon Br.)', en:'Moon Branch',              ja:'月支社' }), w:26, h:22, desks:20,
    flavor: L({ ko:'중력이 약해서 다들 잘 뛴다.',             en:'Low gravity. Everyone jumps beautifully.',           ja:'重力が弱くて、みんなよく跳ぶ。' }) },
];
const TIER_AT_QUARTER = [1, 3, 6, 10, 15, 21, 28];
const tierForQuarter = q => {
  let t = 0;
  TIER_AT_QUARTER.forEach((s, i) => { if (q >= s) t = i; });
  return Math.min(t, TIERS.length - 1);
};

/* 비품 id → 타일. 구매 시 이 표를 보고 그 가구 하나만 추가한다. */
const SHOP_TILE = {
  coffee:TILE.COFFEE, copier:TILE.COPIER, tower:TILE.TOWER, scratch:TILE.SCRATCH,
  server:TILE.SERVER, feeder:TILE.FEEDER, meeting:TILE.MEETING, gym:TILE.GYM,
  lab:TILE.LAB, rocket:TILE.ROCKET,
};

/* ---------- 생성 ---------- */
function genOffice(tier, owned, seed){
  const T = TIERS[tier], W = T.w, H = T.h;
  const rng = mulberry32(seed * 7919 + tier * 131 + 17);
  const g = new Uint8Array(W * H).fill(TILE.FLOOR);
  const at = (x, y) => y * W + x;
  const set = (x, y, v) => { if (x>=0 && y>=0 && x<W && y<H) g[at(x,y)] = v; };
  const get = (x, y) => (x<0||y<0||x>=W||y>=H) ? TILE.WALL : g[at(x,y)];

  for (let x = 0; x < W; x++){ set(x,0,TILE.WALL); set(x,H-1,TILE.WALL); }
  for (let y = 0; y < H; y++){ set(0,y,TILE.WALL); set(W-1,y,TILE.WALL); }

  // 창문은 두지 않는다 — 이 타일셋에 맞는 창문 타일이 없어서 CSS로 그리면 혼자 겉돈다.

  // 출입문 + 결재함
  const doorX = Math.max(2, Math.min(W-3, Math.floor(W/2) + (rng()<.5?-1:1)));
  set(doorX, H-1, TILE.DOOR);
  const inbox = { x: doorX >= W-4 ? doorX-2 : doorX+2, y: H-2 };

  // 오른쪽 3칸은 편의시설 구역으로 확보
  const deskRight = W - 4;

  // 무언가를 놓았을 때 바닥이 끊기면 되돌린다 (고양이가 구석에 갇히는 것 방지)
  const probe = { W, H, grid:g };
  const entry = { x:doorX, y:H-2 };
  function keepsConnected(){
    if (!walkable(probe, entry.x, entry.y)) return false;
    const reach = floodFrom(probe, entry);
    for (let y = 1; y < H-1; y++)
      for (let x = 1; x < W-1; x++)
        if (walkable(probe, x, y) && !reach.has(y*W + x)) return false;
    return true;
  }
  function tryPlace(x, y, tile){
    const prev = get(x, y);
    set(x, y, tile);
    if (keepsConnected()) return true;
    set(x, y, prev);
    return false;
  }

  set(inbox.x, inbox.y, TILE.INBOX);   // 결재함은 문 옆 고정 (통로를 막지 않는 위치)

  /* --- 휴게실: 한쪽 구석을 칸막이로 나눈다 ---
     타일셋 제작자의 예시 배치가 한 덩어리 방이 아니라 구역이 나뉜 사무실이라
     그 구조를 따라간다. 바닥재도 구역마다 다르게 깐다. */
  const zone = new Uint8Array(W * H);          // 0 본 사무실 · 1 휴게실 · 2 회의실 · 3 라운지
  const brW = Math.max(3, Math.min(6, Math.floor(W * 0.34)));
  const brH = Math.max(3, Math.min(5, Math.floor(H * 0.30)));
  const bx1 = brW, by0 = H - 1 - brH;          // 좌하단 구석
  let hasBreak = false;
  if (W >= 11 && H >= 10 && by0 > 3 && Math.abs(doorX - bx1) > 1){
    const before = g.slice();
    for (let y = by0; y <= H-2; y++) set(bx1, y, TILE.WALL);      // 세로 칸막이
    for (let x = 1; x <= bx1; x++)   set(x, by0, TILE.WALL);      // 가로 칸막이
    const doorY = by0 + 1 + Math.floor(rng() * Math.max(1, brH - 1));
    set(bx1, Math.min(H-2, doorY), TILE.FLOOR);                   // 출입구
    if (keepsConnectedAfterPartition()){
      hasBreak = true;
      for (let y = by0+1; y <= H-2; y++)
        for (let x = 1; x < bx1; x++) zone[y*W + x] = 1;
    } else {
      g.set(before);                                              // 막히면 통째로 취소
    }
  }
  function keepsConnectedAfterPartition(){
    if (!walkable(probe, entry.x, entry.y)) return false;
    const reach = floodFrom(probe, entry);
    for (let y = 1; y < H-1; y++)
      for (let x = 1; x < W-1; x++)
        if (walkable(probe, x, y) && !reach.has(y*W + x)) return false;
    return true;
  }

  /* --- 회의실: 큰 사무실에만. 오른쪽 위 구석을 칸막이로 나눈다 --- */
  let hasMeet = false;
  if (tier >= 3 && W >= 17 && H >= 15){
    const mw = Math.max(4, Math.min(6, Math.floor(W * 0.30)));
    const mh = Math.max(3, Math.min(5, Math.floor(H * 0.26)));
    const mx0 = W - 1 - mw, my1 = mh;
    const before = g.slice();
    for (let y = 1; y <= my1; y++)      set(mx0, y, TILE.WALL);   // 세로 칸막이
    for (let x = mx0; x <= W-2; x++)    set(x, my1, TILE.WALL);   // 가로 칸막이
    const doorY = 1 + Math.floor(rng() * Math.max(1, mh - 1));
    set(mx0, Math.min(my1 - 1, doorY), TILE.FLOOR);               // 출입구
    if (keepsConnectedAfterPartition()){
      hasMeet = true;
      for (let y = 1; y < my1; y++)
        for (let x = mx0+1; x <= W-2; x++) zone[y*W + x] = 2;
    } else g.set(before);
  }

  /* --- 라운지: 벽 없이 바닥재만 바꾼 구역. 이 팩엔 러그가 없어서 바닥으로 대신한다 --- */
  if (tier >= 2){
    const lw = Math.max(3, Math.min(5, Math.floor(W * 0.22)));
    const lh = Math.max(2, Math.min(4, Math.floor(H * 0.20)));
    const lx = W - 2 - lw, ly = Math.max(3, Math.floor(H * 0.55));
    let clear = true;
    for (let y = ly; y < ly + lh && clear; y++)
      for (let x = lx; x < lx + lw; x++)
        if (get(x, y) !== TILE.FLOOR || zone[y*W + x]){ clear = false; break; }
    if (clear)
      for (let y = ly; y < ly + lh; y++)
        for (let x = lx; x < lx + lw; x++) zone[y*W + x] = 3;
  }

  /* --- 책상 배치: 2칸짜리 팀 섬(pod)을 여러 행에 고르게 --- */
  const desks = [];
  const rowYs = [];
  for (let y = 2; y <= H-4; y += 3) rowYs.push(y);

  const canDesk = (x, y) =>
    get(x, y) === TILE.FLOOR && get(x, y+1) === TILE.FLOOR &&
    !zone[y*W + x] && !zone[(y+1)*W + x] &&           // 휴게실에는 책상을 두지 않는다
    !(x === inbox.x && Math.abs(y - inbox.y) < 2);
  /* 책상은 2칸이 한 짝이다 — 타일셋의 책상이 가로 2칸이고,
     참고 배치도 2인 1조로 붙여 놓는다. 자리는 각 칸 아래에 하나씩. */
  const putDesk = (x, y) => {
    if (!canDesk(x, y) || !canDesk(x+1, y)) return false;
    const prevL = get(x, y), prevR = get(x+1, y);
    set(x, y, TILE.DESK); set(x+1, y, TILE.DESK_R);
    if (!keepsConnected()){ set(x, y, prevL); set(x+1, y, prevR); return false; }
    desks.push({ desk:{x,y},     seat:{x,   y:y+1} });
    desks.push({ desk:{x:x+1,y}, seat:{x:x+1, y:y+1} });
    return true;
  };

  const need = T.desks;
  const perRow = Math.ceil(need / rowYs.length / 2) * 2;      // 행마다 짝수로
  for (const y of rowYs){
    if (desks.length >= need) break;
    const pods = Math.min(Math.ceil(perRow / 2), Math.ceil((need - desks.length) / 2));
    const span = pods * 2 + (pods - 1) * 2;                   // 책상 2칸 + 사이 통로 2칸
    const jitter = rng() < .5 ? 0 : 1;
    const x0 = Math.max(2, Math.floor((deskRight + 2 - span) / 2) + jitter);
    for (let p = 0; p < pods && desks.length < need; p++){
      const x = x0 + p * 4;
      if (x + 1 > deskRight) break;
      putDesk(x, y);
    }
  }
  // 못 채웠으면 남은 칸을 훑어서 마저 채운다 (여기서도 2칸 한 짝)
  for (const y of rowYs){
    for (let x = 2; x + 1 <= deskRight && desks.length < need; x++){
      if (get(x-1, y) === TILE.DESK || get(x-1, y) === TILE.DESK_R) continue;
      putDesk(x, y);
    }
  }

  const facilities = {};
  const machineSide = rng() < 0.5 ? 'left' : 'right';
  const shuffle = a => {
    for (let i = a.length - 1; i > 0; i--){
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  /* --- 편의시설: 항상 있는 것 + 구매한 비품 --- */
  const wanted = [TILE.BED, TILE.LITTER, TILE.COOLER];
  Object.keys(SHOP_TILE).forEach(k => { if (owned[k]) wanted.push(SHOP_TILE[k]); });
  if (tier >= 1) wanted.push(TILE.LEGAL);        // 법무팀이 왔을 때 앉는 자리
  // 바닥에 놓는 장식 — 사무실이 텅 비어 보이지 않게 한다
  for (let i = 0; i < 2 + tier; i++) wanted.push(TILE.PLANT);
  for (let i = 0; i < 1 + Math.floor(tier * 0.6); i++) wanted.push(TILE.SHELF);

  for (const t of wanted) placeFurniture(
    { W, H, grid:g, zone, desks, facilities, inbox, door:{x:doorX, y:H-1} }, t, rng, machineSide);

  /* 바닥 잡동사니 — 현금 뭉치, 서류 가방. 기능은 없고 격자도 안 건드린다.
     길찾기에 영향이 없어야 하니 걸어 다닐 수 있는 칸 위에 그림만 얹는다.
     사무실이 "정리된 전시장"이 아니라 "일하는 곳"으로 보이게 하는 장치. */
  const clutter = [];
  {
    const cand = [];
    for (let y = 2; y <= H-3; y++)
      for (let x = 1; x <= W-2; x++){
        if (get(x, y) !== TILE.FLOOR) continue;
        if (desks.some(d => d.seat.x === x && d.seat.y === y)) continue;
        if (Math.abs(x - doorX) < 3 && y >= H-4) continue;
        // 벽이나 가구에 기대어 있는 칸만 — 통로 한가운데 굴러다니면 이상하다
        const leans = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => {
          const t = get(x+dx, y+dy);
          return t !== TILE.FLOOR && t !== TILE.DOOR;
        });
        if (leans) cand.push({ x, y });
      }
    shuffle(cand);
    const want = 2 + Math.floor(tier * 0.9);
    for (let i = 0; i < cand.length && clutter.length < want; i++){
      const c = cand[i];
      if (clutter.some(p => Math.abs(p.x - c.x) <= 1 && Math.abs(p.y - c.y) <= 1)) continue;
      clutter.push({ x:c.x, y:c.y, i: clutter.length + tier });
    }
  }

  /* 벽에 거는 것 — 액자·화이트보드는 바닥이 아니라 벽에 붙어야 한다.
     격자는 그대로 WALL로 두고 별도 목록으로 관리한다(길찾기에 영향 없음).
     위쪽 벽만 쓴다. 옆벽에 걸면 정면으로 그려진 그림이 옆을 보고 서 있는 꼴이 된다. */
  const wallDecor = [];
  {
    const cand = [];
    for (let x = 1; x <= W-2; x++) if (get(x, 0) === TILE.WALL) cand.push({ x, y:0 });
    if (hasBreak) for (let x = 1; x < bx1; x++) if (get(x, by0) === TILE.WALL) cand.push({ x, y:by0 });
    shuffle(cand);
    const taken = new Set();
    const put = (tile, wide) => {
      for (const c of cand){
        if (taken.has(c.y * W + c.x)) continue;
        if (wide > 1 && (get(c.x+1, c.y) !== TILE.WALL || taken.has(c.y * W + c.x + 1))) continue;
        taken.add(c.y * W + c.x);
        if (wide > 1) taken.add(c.y * W + c.x + 1);
        wallDecor.push({ x:c.x, y:c.y, tile });
        return true;
      }
      return false;
    };
    if (tier >= 1) put(TILE.WHITEBOARD, 2);
    for (let i = 0; i < 2 + Math.floor(tier * 0.8); i++) put(TILE.DECOR, 1);
  }

  const world = { W, H, grid:g, zone, wallDecor, clutter, machineSide, tier, desks, facilities, inbox, door:{x:doorX, y:H-1}, seed };

  /* --- 연결성 검사: 문에서 못 가는 자리는 버린다 --- */
  const reach = floodFrom(world, { x:doorX, y:H-2 });
  world.desks = desks.filter(d => reach.has(d.seat.y * W + d.seat.x));
  Object.keys(world.facilities).forEach(k => {
    world.facilities[k] = world.facilities[k].filter(f =>
      adjacentFree(world, f).some(p => reach.has(p.y * W + p.x)));
    if (!world.facilities[k].length) delete world.facilities[k];
  });
  return world;
}

function tileAt(w, x, y){
  if (x < 0 || y < 0 || x >= w.W || y >= w.H) return TILE.WALL;
  return w.grid[y * w.W + x];
}
function walkable(w, x, y){ return WALKABLE.has(tileAt(w, x, y)); }

function adjacentFree(w, p){
  return [[1,0],[-1,0],[0,1],[0,-1]]
    .map(([dx,dy]) => ({ x:p.x+dx, y:p.y+dy }))
    .filter(q => walkable(w, q.x, q.y));
}

function floodFrom(w, start){
  const seen = new Set();
  if (!walkable(w, start.x, start.y)) return seen;
  const q = [start]; seen.add(start.y * w.W + start.x);
  while (q.length){
    const c = q.shift();
    for (const n of adjacentFree(w, c)){
      const k = n.y * w.W + n.x;
      if (!seen.has(k)){ seen.add(k); q.push(n); }
    }
  }
  return seen;
}

/* BFS 최단경로. from/to 는 걸을 수 있는 타일. */
function findPath(w, from, to){
  if (from.x === to.x && from.y === to.y) return [];
  const W = w.W, start = from.y*W + from.x, goal = to.y*W + to.x;
  if (!walkable(w, to.x, to.y)) return null;
  const prev = new Int32Array(W * w.H).fill(-2);
  prev[start] = -1;
  const q = [from];
  let head = 0;
  while (head < q.length){
    const c = q[head++];
    if (c.y*W + c.x === goal) break;
    for (const n of adjacentFree(w, c)){
      const k = n.y*W + n.x;
      if (prev[k] === -2){ prev[k] = c.y*W + c.x; q.push(n); }
    }
  }
  if (prev[goal] === -2) return null;
  const path = [];
  let cur = goal;
  while (cur !== start && cur !== -1){
    path.push({ x: cur % W, y: Math.floor(cur / W) });
    cur = prev[cur];
  }
  return path.reverse();
}

/* 특정 용도의 시설 중 가장 가까운 접근 타일을 찾는다 */
function nearestUse(w, use, from){
  const list = w.facilities[use];
  if (!list || !list.length) return null;
  let best = null, bd = Infinity;
  for (const f of list){
    for (const p of adjacentFree(w, f)){
      const d = Math.abs(p.x - from.x) + Math.abs(p.y - from.y);
      if (d < bd){ bd = d; best = { spot:p, target:f }; }
    }
  }
  return best;
}


/* ============================================================
   가구 한 개를 기존 사무실에 놓는다.
   생성할 때도, 비품을 새로 살 때도 같은 함수를 쓴다 —
   비품 하나 샀다고 사무실을 새로 생성하면 기존 가구가 전부 이사한다.
   ============================================================ */
function placeFurniture(w, tile, rnd, machineSide){
  const W = w.W, H = w.H, g = w.grid, zone = w.zone;
  const at = (x, y) => y * W + x;
  const get = (x, y) => (x<0||y<0||x>=W||y>=H) ? TILE.WALL : g[at(x,y)];
  const set = (x, y, v) => { if (x>=0 && y>=0 && x<W && y<H) g[at(x,y)] = v; };
  const rng = rnd || Math.random;
  const probe = { W, H, grid:g };
  const entry = { x:w.door.x, y:H-2 };

  const keepsConnected = () => {
    if (!walkable(probe, entry.x, entry.y)) return false;
    const reach = floodFrom(probe, entry);
    for (let y = 1; y < H-1; y++)
      for (let x = 1; x < W-1; x++)
        if (walkable(probe, x, y) && !reach.has(y*W + x)) return false;
    return true;
  };
  const shuffle = a => {
    for (let i = a.length - 1; i > 0; i--){
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  const isSeat = (x, y) => w.desks.some(d => d.seat.x === x && d.seat.y === y);
  const freeAround = p => [[1,0],[-1,0],[0,1],[0,-1]]
    .filter(([dx,dy]) => get(p.x+dx, p.y+dy) === TILE.FLOOR).length;

  /* 이미 놓인 가구 — 이들의 진입로를 막으면 안 된다 */
  const placed = [];
  for (let y = 1; y < H-1; y++)
    for (let x = 1; x < W-1; x++){
      const t = g[at(x,y)];
      if (t !== TILE.FLOOR && t !== TILE.WALL && t !== TILE.DOOR &&
          t !== TILE.DESK && t !== TILE.DESK_R && t !== TILE.FILLER) placed.push({ x, y });
    }
  const crowded = p => placed.some(q => Math.abs(q.x - p.x) <= 1 && Math.abs(q.y - p.y) <= 1);

  /* 후보 자리. 벽면만 쓰면 상단 벽에 한 줄로 늘어서고,
     안쪽만 쓰면 통로 한가운데 물건이 선다. 둘을 섞는다. */
  const breakSpots = [], wallSpots = [], innerSpots = [], meetSpots = [], loungeSpots = [];
  for (let y = 1; y <= H-2; y++){
    for (let x = 1; x <= W-2; x++){
      if (get(x, y) !== TILE.FLOOR) continue;
      if (isSeat(x, y)) continue;
      if (Math.abs(x - w.inbox.x) + Math.abs(y - w.inbox.y) < 2) continue;
      if (Math.abs(x - w.door.x) < 2 && y >= H-3) continue;
      const touchesWall = get(x-1,y) === TILE.WALL || get(x+1,y) === TILE.WALL
                       || get(x,y-1) === TILE.WALL || get(x,y+1) === TILE.WALL;
      const z = zone ? zone[at(x,y)] : 0;
      if (z === 1){ if (touchesWall) breakSpots.push({ x, y }); }
      else if (z === 2){ meetSpots.push({ x, y }); }
      else if (z === 3){ loungeSpots.push({ x, y }); }
      else if (touchesWall) wallSpots.push({ x, y });
      else innerSpots.push({ x, y });
    }
  }
  shuffle(wallSpots); shuffle(innerSpots); shuffle(loungeSpots);
  const spots = breakSpots.slice();
  for (let i = 0; i < Math.max(wallSpots.length, innerSpots.length); i++){
    if (wallSpots[i]) spots.push(wallSpots[i]);
    if (innerSpots[i]) spots.push(innerSpots[i]);
  }
  const wallOnly = breakSpots.concat(wallSpots);

  /* 어느 벽에 닿았는지. 위치만 보면 칸막이에 붙은 안쪽 칸까지 바깥벽으로 샌다. */
  const side = p => {
    if (p.y <= 2   && get(p.x, p.y-1) === TILE.WALL) return 'top';
    if (p.x <= 2   && get(p.x-1, p.y) === TILE.WALL) return 'left';
    if (p.x >= W-3 && get(p.x+1, p.y) === TILE.WALL) return 'right';
    if (p.y >= H-3 && get(p.x, p.y+1) === TILE.WALL) return 'bottom';
    return 'inner';
  };
  const ms = machineSide || w.machineSide || 'left';
  const bySide = which => wallSpots.filter(p => side(p) === which)
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const machineSpots = bySide(ms).concat(bySide(ms === 'left' ? 'right' : 'left'), bySide('top'));

  const cat = (typeof FURN_CAT !== 'undefined') ? FURN_CAT[tile] : null;
  const list = cat === 'break' ? breakSpots.concat(wallOnly)
             : cat === 'rest'  ? loungeSpots.concat(breakSpots, wallOnly)   // 쉬는 건 라운지 먼저
             : cat === 'machine' ? machineSpots.concat(wallOnly)
             : cat === 'meet'  ? meetSpots.concat(innerSpots, spots)        // 회의는 회의실 먼저
             : cat === 'decor' ? loungeSpots.concat(spots)
             : (typeof FURN_BIG !== 'undefined' && FURN_BIG[tile]) ? wallOnly : spots;
  const spaced = cat !== 'machine';   // 설비는 벽을 따라 붙어 서는 게 맞다

  const tryAt = (x, y) => {
    const wide = (typeof FURN_SPAN !== 'undefined' && FURN_SPAN[tile]) || 1;
    if (wide > 1 && (get(x+1, y) !== TILE.FLOOR || isSeat(x+1, y))) return false;
    const prev = get(x, y), prevR = wide > 1 ? get(x+1, y) : null;
    set(x, y, tile);
    if (wide > 1) set(x+1, y, TILE.FILLER);
    const ok = freeAround({x,y}) > 0 && placed.every(p => freeAround(p) > 0) && keepsConnected();
    if (!ok){ set(x, y, prev); if (wide > 1) set(x+1, y, prevR); return false; }
    return true;
  };

  for (const pass of [0, 1]){
    for (const sp of list){
      if (get(sp.x, sp.y) !== TILE.FLOOR) continue;
      if (freeAround(sp) < 2) continue;
      if (pass === 0 && spaced && crowded(sp)) continue;
      if (!tryAt(sp.x, sp.y)) continue;
      const use = TILE_INFO[tile] && TILE_INFO[tile].use;
      if (use) (w.facilities[use] = w.facilities[use] || []).push({ x:sp.x, y:sp.y });
      return { x:sp.x, y:sp.y };
    }
  }
  return null;
}

/* 저장된 격자만으로 월드를 되살린다. 배치가 절대 안 바뀌게 하는 핵심. */
function worldFromGrid(saved){
  const W = saved.w, H = saved.h;
  const w = {
    W, H, tier: saved.tier, seed: saved.seed, machineSide: saved.machineSide || 'left',
    grid: Uint8Array.from(saved.grid), zone: Uint8Array.from(saved.zone || []),
    wallDecor: saved.wallDecor || [], clutter: saved.clutter || [],
    desks: [], facilities: {}, inbox: { x:1, y:H-2 }, door: { x:Math.floor(W/2), y:H-1 },
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
    const t = w.grid[y*W + x];
    if (t === TILE.DESK || t === TILE.DESK_R){ w.desks.push({ desk:{x,y}, seat:{x, y:y+1} }); continue; }
    if (t === TILE.INBOX){ w.inbox = { x, y }; continue; }
    if (t === TILE.DOOR){ w.door = { x, y }; continue; }
    const use = TILE_INFO[t] && TILE_INFO[t].use;
    if (use) (w.facilities[use] = w.facilities[use] || []).push({ x, y });
  }
  w.desks.sort((a, b) => (a.desk.y - b.desk.y) || (a.desk.x - b.desk.x));
  return w;
}
