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
  DECOR:22, SHELF:23,
};

// 걸어 다닐 수 있는 타일
const WALKABLE = new Set([TILE.FLOOR, TILE.DOOR]);

// 가구 렌더 정보 { 이모지, 이름, 상호작용 종류 }
const TILE_INFO = {
  [TILE.DESK]:      { em:'💻', n:'책상',     use:'work'   },
  [TILE.INBOX]:     { em:'📥', n:'결재함',   use:'inbox'  },
  [TILE.BED]:       { em:'🧺', n:'낮잠 상자', use:'sleep'  },
  [TILE.LITTER]:    { em:'🪣', n:'모래상자', use:'litter' },
  [TILE.COOLER]:    { em:'🚰', n:'정수기',   use:'social' },
  [TILE.PLANT]:     { em:'🪴', n:'화분',     use:'social' },
  [TILE.COFFEE]:    { em:'☕', n:'커피머신', use:'coffee' },
  [TILE.COPIER]:    { em:'🖨️', n:'복사기',  use:'work'   },
  [TILE.TOWER]:     { em:'🗼', n:'캣타워',   use:'sleep'  },
  [TILE.SCRATCH]:   { em:'🪵', n:'스크래처', use:'social' },
  [TILE.SERVER]:    { em:'🖥️', n:'건조실',  use:'sleep'  },
  [TILE.FEEDER]:    { em:'🍚', n:'자동급식기',use:'coffee' },
  [TILE.MEETING]:   { em:'🪑', n:'회의 테이블',use:'social'},
  [TILE.GYM]:       { em:'🏋️', n:'헬스장',  use:'social' },
  [TILE.LAB]:       { em:'🔬', n:'정제실',   use:'work'   },
  [TILE.ROCKET]:    { em:'🚀', n:'사내 로켓', use:'social' },
  [TILE.WHITEBOARD]:{ em:'📋', n:'화이트보드',use:null     },
  [TILE.LEGAL]:     { em:'⚖️', n:'법무팀 데스크', use:'legal' },
  [TILE.DECOR]:     { em:'🖼️', n:'사내 액자',   use:null     },
  [TILE.SHELF]:     { em:'🗄️', n:'문서 선반',   use:null     },
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
  { name:'골목 종이상자 지점', w:12, h:10, desks:2,  flavor:'비가 오면 젖는다. 그래도 사무실이다.' },
  { name:'반지하 원룸 오피스', w:14, h:12, desks:4,  flavor:'창문이 발목 높이에 있다.' },
  { name:'상가 2층 사무실',    w:16, h:14, desks:6,  flavor:'아래층 붕어빵 냄새가 올라온다.' },
  { name:'냥코 소형 빌딩',     w:18, h:16, desks:9,  flavor:'드디어 엘리베이터가 생겼다.' },
  { name:'냥코퍼레이션 사옥',  w:21, h:18, desks:12, flavor:'로비에 대형 캣타워가 서 있다.' },
  { name:'냥타워',            w:23, h:20, desks:16, flavor:'야경이 보인다. 야근도 보인다.' },
  { name:'달 지사 (Moon Br.)', w:26, h:22, desks:20, flavor:'중력이 약해서 다들 잘 뛴다.' },
];
const TIER_AT_QUARTER = [1, 3, 6, 10, 15, 21, 28];
const tierForQuarter = q => {
  let t = 0;
  TIER_AT_QUARTER.forEach((s, i) => { if (q >= s) t = i; });
  return Math.min(t, TIERS.length - 1);
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

  // 창문 (등급이 오를수록 많이)
  const winStep = tier >= 4 ? 2 : tier >= 2 ? 3 : 4;
  for (let x = 2; x < W-2; x += winStep) set(x, 0, TILE.WINDOW);

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
  const zone = new Uint8Array(W * H);          // 0 = 본 사무실, 1 = 휴게실
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

  /* --- 책상 배치: 2칸짜리 팀 섬(pod)을 여러 행에 고르게 --- */
  const desks = [];
  const rowYs = [];
  for (let y = 2; y <= H-4; y += 3) rowYs.push(y);

  const canDesk = (x, y) =>
    get(x, y) === TILE.FLOOR && get(x, y+1) === TILE.FLOOR &&
    !zone[y*W + x] && !zone[(y+1)*W + x] &&           // 휴게실에는 책상을 두지 않는다
    !(x === inbox.x && Math.abs(y - inbox.y) < 2);
  const putDesk = (x, y) => {
    if (!tryPlace(x, y, TILE.DESK)) return false;
    desks.push({ desk:{x,y}, seat:{x, y:y+1} });
    return true;
  };

  const need = T.desks;
  const perRow = Math.ceil(need / rowYs.length);
  for (const y of rowYs){
    if (desks.length >= need) break;
    const count = Math.min(perRow, need - desks.length);
    const pods = Math.ceil(count / 2);
    const span = pods * 2 + (pods - 1) * 2;                  // pod 2칸 + 사이 통로 2칸
    const jitter = rng() < .5 ? 0 : 1;
    let x0 = Math.max(2, Math.floor((deskRight + 2 - span) / 2) + jitter);
    let n = 0;
    for (let p = 0; p < pods && n < count; p++){
      for (let k = 0; k < 2 && n < count; k++){
        const x = x0 + p * 4 + k;
        if (x > deskRight) break;
        if (!canDesk(x, y)) continue;
        if (putDesk(x, y)) n++;
      }
    }
  }
  // 못 채웠으면 남은 칸을 훑어서 마저 채운다
  for (const y of rowYs){
    for (let x = 2; x <= deskRight && desks.length < need; x++){
      if (canDesk(x, y) && get(x-1, y) !== TILE.DESK) putDesk(x, y);
    }
  }

  /* --- 편의시설: 항상 있는 것 + 구매한 비품 --- */
  const wanted = [TILE.BED, TILE.LITTER, TILE.COOLER];
  const SHOP_TILE = {
    coffee:TILE.COFFEE, copier:TILE.COPIER, tower:TILE.TOWER, scratch:TILE.SCRATCH,
    server:TILE.SERVER, feeder:TILE.FEEDER, meeting:TILE.MEETING, gym:TILE.GYM,
    lab:TILE.LAB, rocket:TILE.ROCKET,
  };
  Object.keys(SHOP_TILE).forEach(k => { if (owned[k]) wanted.push(SHOP_TILE[k]); });
  if (tier >= 1) wanted.push(TILE.LEGAL);        // 법무팀이 왔을 때 앉는 자리
  if (tier >= 1) wanted.push(TILE.WHITEBOARD);
  // 장식 — 기능은 없지만 사무실이 텅 비어 보이지 않게 한다
  for (let i = 0; i < 2 + tier; i++) wanted.push(TILE.PLANT);
  for (let i = 0; i < 1 + Math.floor(tier * 0.8); i++) wanted.push(TILE.DECOR);
  for (let i = 0; i < 1 + Math.floor(tier * 0.6); i++) wanted.push(TILE.SHELF);

  // 벽에 붙은 빈 칸을 후보로. 한쪽에 몰리지 않게 오른쪽/왼쪽/위쪽을 번갈아 쓴다.
  const right = [], left = [], top = [];
  for (let y = 1; y <= H-2; y += 2) right.push({x:W-2, y});
  for (let y = 2; y <= H-2; y += 2) left.push({x:1, y});
  for (let x = 2; x <= W-3; x += 3) top.push({x, y:1});
  const spots = [];
  // 커피·급식기·정수기는 휴게실 안으로 (예시 배치의 탕비실 구조).
  // 단 벽에 붙은 칸만 쓴다 — 방 한가운데를 채우면 서로의 진입로를 막는다.
  if (hasBreak){
    for (let y = by0+1; y <= H-2; y++)
      for (let x = 1; x < bx1; x++){
        if (get(x, y) !== TILE.FLOOR) continue;
        const onEdge = (x === 1 || y === H-2 || x === bx1-1 || y === by0+1);
        if (onEdge) spots.push({ x, y });
      }
  }
  for (let i = 0; i < Math.max(right.length, left.length, top.length); i++){
    if (right[i]) spots.push(right[i]);
    if (left[i])  spots.push(left[i]);
    if (top[i])   spots.push(top[i]);
  }
  // 그래도 모자라면 벽에 붙은 나머지 칸을 전부 후보에 추가
  for (let y = 1; y <= H-2; y++){ spots.push({x:W-2, y}); spots.push({x:1, y}); }
  for (let x = 2; x <= W-3; x++) spots.push({x, y:1});

  const facilities = {};
  const placed = [];
  const freeAround = p => [[1,0],[-1,0],[0,1],[0,-1]]
    .filter(([dx,dy]) => get(p.x+dx, p.y+dy) === TILE.FLOOR).length;

  /* 시설 배치 규칙
     - 진입로가 최소 하나는 남아야 한다
     - 이미 놓인 시설의 진입로를 막아서도 안 된다 (안 그러면 서로를 가둔다)
     - 바닥 연결도 유지해야 한다 */
  function placeAmenity(x, y, t){
    const prev = get(x, y);
    set(x, y, t);
    const ok = freeAround({x,y}) > 0
            && placed.every(p => freeAround(p) > 0)
            && keepsConnected();
    if (!ok){ set(x, y, prev); return false; }
    placed.push({ x, y });
    return true;
  }

  let si = 0;
  for (const t of wanted){
    while (si < spots.length){
      const s = spots[si++];
      if (get(s.x, s.y) !== TILE.FLOOR) continue;
      if (freeAround(s) < 2) continue;              // 놓고 나서도 길이 남아야 한다
      if (!placeAmenity(s.x, s.y, t)) continue;
      const use = TILE_INFO[t] && TILE_INFO[t].use;
      if (use){ (facilities[use] = facilities[use] || []).push({x:s.x, y:s.y}); }
      break;
    }
  }

  const world = { W, H, grid:g, zone, tier, desks, facilities, inbox, door:{x:doorX, y:H-1}, seed };

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
