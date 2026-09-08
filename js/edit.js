/* ============================================================
   edit.js — 배치 모드
   플레이어가 가구를 직접 옮긴다. 절차 생성이 처음 배치를 깔아주고,
   그 다음부터는 내 사무실이니까 내 마음대로.

   원리: 모든 편집은 "격자 복사 → 이동 적용 → 전체 검증 → 스냅샷 →
   worldFromGrid 재구성"이다. 시설 목록·책상·결재함이 전부 격자에서
   다시 유도되므로(worldFromGrid) 부분 갱신 버그가 원천적으로 없다.

   검증은 생성기와 같은 규칙을 전부 지킨다:
   - 문에서 모든 바닥이 닿아야 한다 (고양이가 구석에 갇히면 안 된다)
   - 모든 가구·결재함은 접근 칸이 하나는 있어야 한다
   - 책상은 바로 아래 칸이 자리(seat)라 그 칸이 비어 있어야 한다
   옮길 수 있는 것: 가구·비품, 책상(2칸 한 짝), 결재함, 벽의 액자·화이트보드.
   문·벽·바닥 잡동사니는 못 옮긴다 (잡동사니는 가구가 깔고 앉으면 치워진다).

   ── 돌리기 (R) ──

   옮기는 것만으로는 "내 사무실"이 안 된다. 절차 생성이 깔아 준 배치는 전부 같은 쪽을
   보고 있고, 그건 옮겨 놔도 그대로다. 그래서 90° 단위로 돌린다.

   **한 칸짜리만 돌아간다.** 두 칸짜리(책상·회의탁자·화이트보드)를 세로로 돌리면
   차지하는 칸이 2×1 에서 1×2 로 바뀌는데, 격자는 그걸 표현할 방법이 없다 —
   FILLER 는 늘 오른쪽 칸이고, 책상의 자리(seat)는 늘 바로 아래 칸이며,
   worldFromGrid 가 그 규약으로 시설을 되유도한다. 세로 책상을 넣으려면
   저장 포맷·길찾기·검증을 다 같이 고쳐야 하고, 그건 이 기능의 값어치보다 크다.
   한 칸짜리는 **발자국이 안 변하므로** 길찾기가 한 줄도 안 흔들린다.

   각도는 격자가 아니라 world.rot(칸 번호 → 0~3)에 산다. 시뮬은 이 값을 안 읽는다 —
   그림에만 쓰이는 값이라서. 그래서 도트 렌더러에서는 안 보인다(스프라이트에 회전
   프레임이 없다). 3D 가 기본이라 그쪽에서만 돌려 보이고, 도트일 때는 그렇다고 말해 준다.
   ============================================================ */

const EDIT = { on:false, sel:null, hover:null };

/* 격자에서 움직일 수 없는 것들 */
const EDIT_FIXED = new Set([TILE.FLOOR, TILE.WALL, TILE.DOOR]);

const editSpan = t => (typeof FURN_SPAN !== 'undefined' && FURN_SPAN[t]) || 1;
/* 벽 장식은 자기가 몇 칸짜리인지 스스로 들고 다닌다(world.js 가 심어 준다).
   옛 저장에는 그 값이 없어서 화이트보드만 두 칸이던 시절 규칙으로 되돌린다. */
const decorSpan = d => d.span || (d.tile === TILE.WHITEBOARD ? 2 : 1);
/* 북쪽 벽은 가로로, 서쪽 벽은 세로로 뻗는다. */
const decorHit = (d, x, y) => d.face === 'w'
  ? (x === d.x && y >= d.y && y < d.y + decorSpan(d))
  : (y === d.y && x >= d.x && x < d.x + decorSpan(d));


/* ---------- 러그 (TODO 49) ----------
   러그는 **격자에 없다.** 목록(W.rugs)으로만 살고, 아무 칸도 안 막고, 고양이가
   밟고 지나간다. 그래서 여기서도 격자 검증을 한 줄도 안 탄다 —
   editTryMove·editGridOK 는 러그를 아예 모른다.

   고르는 순서는 **가구가 먼저**다. 책상 밑에 깔린 러그를 누르면 책상이 잡혀야 한다
   (러그는 밑에 깔린 것이고, 위에 있는 물건을 집는 게 사람이 기대하는 동작이다).
   빈 바닥에서만 러그가 잡힌다. */
const rugSizeOf = r => (typeof DECOR !== 'undefined' && DECOR.rugSize)
  ? DECOR.rugSize(r) : { w:1, h:1 };
const rugHit = (r, x, y) => {
  const s = rugSizeOf(r);
  return x >= r.x && x < r.x + s.w && y >= r.y && y < r.y + s.h;
};
/* 방 안에 들어가는가 — 이게 러그의 유일한 규칙이다. 통행도 접근로도 볼 것이 없다.
   러그끼리는 겹쳐도 둔다(겹쳐 깐 러그는 실제로 있는 물건이다). */
function rugTargetOK(unit, tx, ty){
  const s = rugSizeOf({ id:unit.tile, rot:unit.rot });
  return tx >= 1 && ty >= 1 && tx + s.w <= W.W - 1 && ty + s.h <= W.H - 1;
}

/* (x,y)에 있는 "옮길 수 있는 한 덩어리"를 찾는다 */
/* 방을 밝히는 등 (W.lights — render3d.js 의 buildCozy 머리말).
   격자에 없는 물건이라 예전에는 **아무도 못 만졌다** — 지울 수 없는 가구였다.
   이제 목록이므로 러그·얹은 소품과 같은 방식으로 고르고 옮기고 치운다. */
const lightAt = (x, y) => (W.lights || []).find(p => p.x === x && p.y === y) || null;
const asLight = p => ({ kind:'light', x:p.x, y:p.y, tile:null, span:1, ref:p });

/* 그 칸의 가구 **위에** 얹힌 소품 (W.tops — world.js 머리말) */
const topAt = (x, y) => (W.tops || []).find(p => p.x === x && p.y === y) || null;
const asTop = p => ({ kind:'top', x:p.x, y:p.y, tile:p.tile, span:1, ref:p });
/* 소품을 받칠 수 있는 칸인가 — 바닥·벽·문이 아니고, 벽에 거는 것도 아니다.
   두 칸짜리 가구의 오른쪽 절반(FILLER)은 왼쪽이 주인이라 거기로 보낸다. */
function topHostAt(x, y){
  if (!W) return null;
  const t = tileAt(W, x, y);
  if (t === TILE.FILLER) return topHostAt(x - 1, y);
  if (t === undefined || EDIT_FIXED.has(t)) return null;
  if (t === TILE.DESK_R) return tileAt(W, x-1, y) === TILE.DESK ? { x:x-1, y } : null;
  return { x, y };
}

function unitAt(x, y, prefer){
  if (!W) return null;
  const t = tileAt(W, x, y);
  /* **위에 얹힌 것이 먼저다.** 손이 닿는 순서가 그렇다 — 책상 위의 초를 집으려는데
     책상이 잡히면 초는 영영 못 옮긴다(러그가 늘 가구 밑에 깔려 있던 것과 같은 문제,
     방향만 반대다). 아래의 가구를 잡으려면 한 번 더 누른다(prefer 'under'). */
  if (prefer !== 'under'){
    const p0 = topAt(x, y) || (t === TILE.FILLER || t === TILE.DESK_R
      ? (topHostAt(x, y) && topAt(topHostAt(x, y).x, topHostAt(x, y).y)) : null);
    if (p0) return asTop(p0);
    /* 등은 빈 바닥 위에 서 있다 — 그 칸에 가구가 없을 때만 잡힌다(가구가 우선). */
    const g0 = lightAt(x, y);
    if (g0 && (t === TILE.FLOOR || t === undefined)) return asLight(g0);
  }
  /* 러그를 달라고 했으면 **다른 무엇보다 먼저** 준다. 아래의 책상·두 칸짜리 분기가
     일찍 돌려보내므로, 여기서 안 가로채면 책상 밑 러그는 영영 안 잡힌다. */
  if (prefer === 'rug'){
    const r0 = (W.rugs || []).find(r => rugHit(r, x, y));
    if (r0) return { kind:'rug', x:r0.x, y:r0.y, tile:r0.id, rot:r0.rot|0, span:rugSizeOf(r0).w, ref:r0 };
  }
  if (t === TILE.WALL){
    for (const d of (W.wallDecor || []))
      if (decorHit(d, x, y))
        return { kind:'decor', x:d.x, y:d.y, tile:d.tile, span:decorSpan(d), face:d.face || 'n', ref:d };
    return null;
  }
  if (t === TILE.DESK)   return { kind:'desk', x, y, tile:TILE.DESK, span:2 };
  if (t === TILE.DESK_R) return tileAt(W, x-1, y) === TILE.DESK
    ? { kind:'desk', x:x-1, y, tile:TILE.DESK, span:2 } : null;
  if (t === TILE.FILLER) return unitAt(x-1, y, prefer); // 가로 2칸 가구의 오른쪽 절반
  const rug = (W.rugs || []).find(r => rugHit(r, x, y));
  const asRug = r => ({ kind:'rug', x:r.x, y:r.y, tile:r.id, rot:r.rot|0, span:rugSizeOf(r).w, ref:r });
  if (!EDIT_FIXED.has(t)){
    const furn = { kind:'furn', x, y, tile:t, span:editSpan(t) };
    /* 가구와 러그가 겹친 칸 — **누를 때마다 번갈아** 잡는다. 러그는 바닥에 까는 것이라
       책상 밑에도 깔리는데, 위의 가구가 늘 먼저 잡히면 그 러그는 영영 못 옮긴다.
       지금 고른 것이 가구면 다음 차례는 러그다. */
    if (rug && prefer === 'rug') return asRug(rug);
    return furn;
  }
  /* 빈 바닥 — 러그만 있다 */
  if (rug) return asRug(rug);
  return null;
}

const sameUnit = (a, b) => a && b && a.kind === b.kind && a.x === b.x && a.y === b.y;

/* 돌릴 수 있는가 — 한 칸짜리 바닥 가구, 그리고 **러그 전부**.
   두 칸짜리 가구를 못 돌리게 한 이유(격자가 세로 발자국을 표현 못 한다)가
   러그에는 아예 해당되지 않는다 — 러그의 발자국은 격자에 없다. 2×3 이 3×2 가 되어도
   막히는 칸이 0 에서 0 으로 갈 뿐이라 검증할 것이 없다. */
const canTurn = u => !!u && ((u.kind === 'furn' && u.span === 1) || u.kind === 'rug');
const rotAt = (x, y) => (W.rot && W.rot[y * W.W + x]) | 0;
function setRot(x, y, r){
  if (!W.rot) W.rot = {};
  const i = y * W.W + x;
  if (r % 4) W.rot[i] = r % 4; else delete W.rot[i];
}
/* 가구가 이사하면 각도도 같이 간다. 목적지는 먼저 지운다 —
   전에 살던 가구의 각도가 남아 있으면 새로 온 물건이 그 각으로 서 버린다. */
function moveRot(fx, fy, tx, ty){
  if (!W.rot) return;
  const v = rotAt(fx, fy);
  delete W.rot[fy * W.W + fx];
  delete W.rot[ty * W.W + tx];
  if (v) W.rot[ty * W.W + tx] = v;
}

function unitName(u){
  /* 등은 격자에 없어서 TILE_INFO 가 답을 못 한다 — 여기서 직접 부른다. */
  if (u && u.kind === 'light')
    return (u.ref && u.ref.kind === 'lantern')
      ? L({ ko:'🏮 랜턴', en:'🏮 Lantern', ja:'🏮 ランタン' })
      : L({ ko:'💡 스탠드', en:'💡 Floor lamp', ja:'💡 スタンドライト' });
  /* 얹힌 소품도 이름은 그 물건의 이름이다. 다만 **어디에 있는지**를 붙여 준다 —
     든 것이 책상 위의 초라는 걸 알아야 다음에 어디를 눌러야 하는지도 안다. */
  if (u && u.kind === 'top'){
    const inf0 = TILE_INFO[u.tile] || {};
    return (inf0.em || '') + ' ' + (inf0.n || '')
      + L({ ko:' (얹힌 것)', en:' (on top)', ja:'（上に置いたもの）' });
  }
  if (u.kind === 'rug'){
    const it = (typeof DECOR !== 'undefined') && DECOR.byId(u.tile);
    return '🧶 ' + (it ? it.n : 'rug');
  }
  const inf = TILE_INFO[u.kind === 'desk' ? TILE.DESK : u.tile] || {};
  return (inf.em || '') + ' ' + (inf.n || '');
}

/* ---------- 검증: 이 격자로 사무실이 굴러가는가 ---------- */
/* 진입로가 **필요한** 물건. 시뮬이 실제로 걸어가서 쓰는 것뿐이다:
   결재함(서류를 물어 온다)과 TILE_INFO 에 use 가 붙은 설비(커피·화장실·해먹·CD…).
   락커·화분·초 앞이 막혀도 아무 일도 안 일어난다 — 아무도 거기 안 간다.
   world.js 의 placeFurniture 와 **같은 규칙**이다: 두 곳이 다르면 절차 생성이 놓은
   자리를 손으로는 못 만지게 된다. */
function editNeedsAccess(t){
  if (t === TILE.INBOX) return true;
  return !!(typeof TILE_INFO !== 'undefined' && TILE_INFO[t] && TILE_INFO[t].use);
}

/* ── 「길막」 판정 ──
   예전에는 방의 **모든** 가구가 접근 칸을 갖고 있어야 통과였다. 두 가지가 틀렸다.

   첫째, **이미 막혀 있던 가구가 하나라도 있으면 모든 이동이 거부된다.** 그 가구는
   내가 지금 옮기는 것과 아무 상관이 없는데도, 판정이 절대값이라 방 전체가 잠긴다 —
   「어딜 놓으려고 해도 길막한다」가 이것이었다. 지킬 것은 「막힌 것을 열어라」가 아니라
   **「열려 있던 것을 막지 마라」**다. 그래서 옮기기 **전** 격자와 비교한다.

   둘째, 아무도 안 가는 가구까지 지키고 있었다(위 editNeedsAccess).

   바닥이 끊기는 것은 그대로 막는다 — 고양이가 못 가는 구역이 생기는 건 진짜 사고다. */
function editGridOK(g2){
  const WW = W.W, HH = W.H;
  const P = { W:WW, H:HH, grid:g2 };
  const P0 = { W:WW, H:HH, grid:W.grid };            // 옮기기 전
  const entry = { x:W.door.x, y:HH - 2 };
  if (!walkable(P, entry.x, entry.y)) return false;
  const reach = floodFrom(P, entry);
  const reach0 = floodFrom(P0, entry);               // 옮기기 전에 닿던 곳
  /* 진입로 하나 — **닿을 수 있는** 이웃이어야 한다. 걸을 수 있는 것만 보면,
     그 이웃이 통째로 끊긴 구역 안에 있어도 통과한다. */
  const open = (Q, R, x, y) => [[1,0],[-1,0],[0,1],[0,-1]]
    .some(([dx,dy]) => walkable(Q, x+dx, y+dy) && R.has((y+dy)*WW + (x+dx)));
  /* 이 이동의 잘못인가 — 「지금 안 되고, 전에는 됐다」일 때만 거부한다. */
  const broke = (now, before) => !now && before;

  for (let y = 1; y < HH-1; y++){
    for (let x = 1; x < WW-1; x++){
      const i = y*WW + x, t = g2[i];
      if (WALKABLE.has(t)){
        if (reach.has(i)) continue;
        /* ── 못 닿는 빈 칸은 **그 자체로는 사고가 아니다** ──
           예전에는 끊긴 바닥이 한 칸이라도 생기면 거부했다. 그런데 아무도 못 들어가는
           칸은 그냥 못 쓰는 칸일 뿐이다 — 실측: 갓 생성한 사무실에서 한 칸 이동 23번 중
           6번이 막혔고 그중 **5번이 빈 칸 하나가 끊기는 것**이었다.
           방이 차면 이 비율이 올라가고, 그게 「어딜 놓으려고 해도 길막」이 된다.

           진짜 사고는 **갇히는 것**이다: 고양이가 그 안에 서 있거나 자리가 그 안에 들어가면
           그 고양이는 영영 못 나오고 그 자리는 영영 못 앉는다. 그때만 거부한다.
           (원래도 안 닿던 칸이면 이 이동의 잘못이 아니다.) */
        if (reach0.has(i)){
          if ((S.cats || []).some(c => c.x === x && c.y === y)) return false;
          if ((W.desks || []).some(d => d.seat.x === x && d.seat.y === y)) return false;
        }
        continue;
      }
      if (t === TILE.WALL || t === TILE.FILLER) continue;
      if (t === TILE.DESK || t === TILE.DESK_R){
        const si = (y+1)*WW + x;
        /* 자리는 **걸을 수 있고 닿을 수 있어야** 한다 — 앉으러 갈 수 있어야 자리다 */
        if (broke(WALKABLE.has(g2[si]) && reach.has(si),
                  WALKABLE.has(W.grid[si]) && reach0.has(si))) return false;
        continue;
      }
      if (!editNeedsAccess(t)) continue;
      if (broke(open(P, reach, x, y), open(P0, reach0, x, y))) return false;
    }
  }
  return true;
}

/* 이동을 적용해 본 격자를 돌려준다. 'bad' = 놓을 수 없는 칸, 'block' = 길이 막힘 */
function editTryMove(unit, tx, ty){
  const WW = W.W, HH = W.H;
  const at = (x, y) => y*WW + x;
  const inb = (x, y) => x >= 1 && y >= 1 && x < WW-1 && y < HH-1;
  const g2 = Uint8Array.from(W.grid);

  if (unit.kind === 'desk'){
    if (!inb(tx, ty) || !inb(tx+1, ty) || !inb(tx, ty+1)) return 'bad';
    g2[at(unit.x, unit.y)] = TILE.FLOOR;
    g2[at(unit.x+1, unit.y)] = TILE.FLOOR;
    for (const [cx, cy] of [[tx,ty],[tx+1,ty],[tx,ty+1],[tx+1,ty+1]])
      if (g2[at(cx, cy)] !== TILE.FLOOR) return 'bad';       // 책상 2칸 + 자리 2칸
    g2[at(tx, ty)] = TILE.DESK;
    g2[at(tx+1, ty)] = TILE.DESK_R;
  } else {
    const sp = unit.span;
    if (!inb(tx, ty) || (sp > 1 && !inb(tx+1, ty))) return 'bad';
    g2[at(unit.x, unit.y)] = TILE.FLOOR;
    if (sp > 1) g2[at(unit.x+1, unit.y)] = TILE.FLOOR;
    for (let i = 0; i < sp; i++)
      if (g2[at(tx+i, ty)] !== TILE.FLOOR) return 'bad';
    g2[at(tx, ty)] = unit.tile;
    if (sp > 1) g2[at(tx+1, ty)] = TILE.FILLER;
  }
  if (!editGridOK(g2)) return 'block';
  return g2;
}

/* 벽 장식: 방을 향한 벽면에만, 다른 장식과 안 겹치게.
   북쪽 벽은 아래가 벽이 아닌 칸, 서쪽 벽은 오른쪽이 벽이 아닌 칸이 "방을 향한 면"이다. */
function decorTargetOK(unit, tx, ty){
  const west = unit.face === 'w';
  for (let i = 0; i < unit.span; i++){
    const x = west ? tx : tx + i, y = west ? ty + i : ty;
    if (west){
      if (x !== 0 || y < 1 || y > W.H-2) return false;
      if (tileAt(W, x+1, y) === TILE.WALL) return false;
    } else {
      if (x < 1 || x > W.W-2 || y < 0 || y >= W.H-1) return false;
      if (tileAt(W, x, y+1) === TILE.WALL) return false;
    }
    if (tileAt(W, x, y) !== TILE.WALL) return false;
    for (const d of (W.wallDecor || []))
      if (d !== unit.ref && decorHit(d, x, y)) return false;
  }
  return true;
}

/* 이동 확정. true | 'bad' | 'block' */
function editApply(unit, tx, ty){
  /* 러그 — 격자를 한 칸도 안 건드린다. 방 안에 들어가기만 하면 놓인다.
     저장은 이 객체가 곧 저장 배열의 원소라서(S.decor.rugs ↔ W.rugs) save() 한 번이면 끝이다.
     snapshotWorld 는 안 부른다 — 러그는 S.layout 에 없다. */
  if (unit.kind === 'rug'){
    if (!rugTargetOK(unit, tx, ty)) return 'bad';
    unit.ref.x = tx; unit.ref.y = ty;
    save();
    bus.emit('world:rebuilt', W);
    return true;
  }
  if (unit.kind === 'decor'){
    if (!decorTargetOK(unit, tx, ty)) return 'bad';
    unit.ref.x = tx; unit.ref.y = ty;
    snapshotWorld(); save();
    bus.emit('world:rebuilt', W);
    return true;
  }
  /* 등 — 격자를 한 칸도 안 건드린다. 방 안의 **빈 바닥**이면 어디든 선다.
     길을 막을 수가 없으므로 검사할 것도 없다(러그와 같다). */
  if (unit.kind === 'light'){
    if (tileAt(W, tx, ty) !== TILE.FLOOR) return 'bad';
    if (lightAt(tx, ty)) return 'bad';                 // 한 칸에 하나
    unit.ref.x = tx; unit.ref.y = ty;
    unit.ref.ox = 0.5; unit.ref.oz = 0.5;              // 손으로 옮긴 것은 칸 가운데
    snapshotWorld(); save();
    bus.emit('world:rebuilt', W);
    return true;
  }

  /* ── 위에 얹힌 소품 ── (world.js 의 tops 머리말)
     격자를 한 칸도 안 건드린다. 그래서 **길을 막을 수가 없다** — 검사할 것이 없다.
       얹힌 것 → 다른 가구 위: 자리만 옮긴다
       얹힌 것 → 빈 바닥:      격자로 내려온다(다시 보통 가구가 된다)
     한 칸에 하나만 얹는다. 이미 뭐가 얹혀 있으면 'bad' 다 — 쌓기는 배치가 아니다. */
  if (unit.kind === 'top'){
    const host = topHostAt(tx, ty);
    if (host){
      if (topAt(host.x, host.y) && !(host.x === unit.x && host.y === unit.y)) return 'bad';
      unit.ref.x = host.x; unit.ref.y = host.y;
      snapshotWorld(); save();
      bus.emit('world:rebuilt', W);
      return true;
    }
    /* 빈 바닥이면 내려놓는다 — 그 순간부터 보통 가구다(칸을 먹고 길 검사를 받는다) */
    if (tileAt(W, tx, ty) !== TILE.FLOOR) return 'bad';
    const g2 = Uint8Array.from(W.grid);
    g2[ty * W.W + tx] = unit.tile;
    if (!editGridOK(g2)) return 'block';
    W.tops = (W.tops || []).filter(p => p !== unit.ref);
    W.grid = g2;
    snapshotWorld(); buildWorld(); save();
    return true;
  }
  /* 바닥 가구를 **다른 가구 위에** 얹는다 — 작은 소품만. 초·펜 홀더는 진짜로
     책상 위에 놓는 물건인데 격자에서는 락커와 같은 한 칸을 먹고 있었다. */
  if (unit.kind === 'furn' && unit.span === 1
      && typeof FURN_SMALL !== 'undefined' && FURN_SMALL.has(unit.tile)){
    const host = topHostAt(tx, ty);
    if (host && !(host.x === unit.x && host.y === unit.y)){
      if (topAt(host.x, host.y)) return 'bad';
      const g2 = Uint8Array.from(W.grid);
      g2[unit.y * W.W + unit.x] = TILE.FLOOR;        // 있던 칸은 비운다
      W.tops = (W.tops || []).concat([{ x:host.x, y:host.y, tile:unit.tile }]);
      W.grid = g2;
      snapshotWorld(); buildWorld(); save();
      return true;
    }
  }
  const r = editTryMove(unit, tx, ty);
  if (r === 'bad' || r === 'block') return r;
  moveRot(unit.x, unit.y, tx, ty);
  W.grid = r;
  // 가구가 깔고 앉은 잡동사니는 치운다
  W.clutter = (W.clutter || []).filter(c => r[c.y*W.W + c.x] === TILE.FLOOR);
  snapshotWorld();
  buildWorld();          // 격자에서 시설·책상·결재함 재유도 + 고양이 재배치
  save();
  return true;
}

/* 90° 돌린다. 발자국이 안 변하므로 검증할 게 없다 — 격자는 한 칸도 안 건드린다.
   dir 이 음수면 반대로. 돌아갔으면 true, 못 돌리는 물건이면 false. */
let keepSel = false;
function editRotate(dir){
  const u = EDIT.sel;
  if (!canTurn(u)) return false;
  if (u.kind === 'rug'){
    /* 러그는 각도를 제 몸에 들고 다닌다(격자 칸 번호에 매달 수가 없다 — 여러 칸을 덮고,
       그 칸들은 러그의 것이 아니다). 돌린 뒤에 방 밖으로 나가면 안으로 밀어 넣는다. */
    const r = u.ref;
    r.rot = ((r.rot | 0) + (dir < 0 ? 3 : 1)) % 4;
    u.rot = r.rot;
    const s = rugSizeOf(r);
    r.x = Math.max(1, Math.min(W.W - 1 - s.w, r.x));
    r.y = Math.max(1, Math.min(W.H - 1 - s.h, r.y));
    u.x = r.x; u.y = r.y;
    save();
    keepSel = true;
    bus.emit('world:rebuilt', W);
    return true;
  }
  setRot(u.x, u.y, (rotAt(u.x, u.y) + (dir < 0 ? 3 : 1)) % 4);
  snapshotWorld(); save();
  keepSel = true;                    // 한 번 누르고 또 누르는 조작이다. 선택을 뺏으면 안 된다
  bus.emit('world:rebuilt', W);
  return true;
}

/* ---------- 치우기 ----------
   고른 것을 방에서 뺀다. 배치 모드의 ✕ 가 이걸 부른다(js/cozy.js).

   검증이 없다: **빼는 것은 길을 막지 않는다.** 옮기기는 「거기 놓아도 사무실이
   굴러가는가」를 물어야 하지만(문에서 모든 바닥이 닿아야 하고 가구마다 접근 칸이
   있어야 한다), 치우기는 칸을 바닥으로 되돌리므로 그 조건을 어길 수가 없다.

   ── 다시 나타난다 ──
   절차 생성(world.js genOffice)이 **보유 개수만큼** 가구를 놓는다. 그래서 사무실을
   옮기면(분기 승급) 치운 가구가 다시 들어온다. 창고가 없어서 그렇다 — 진짜로 없애려면
   「보유 개수를 줄인다」는 규칙(환불이냐 폐기냐)이 필요하고, 그건 이 문이 정할 일이
   아니다. 지금 이 기능의 약속은 「이 방에서 지금 빼 준다」까지다. */
/* ── 치운 것은 **창고로** 간다 ──
   창고는 따로 저장되는 목록이 아니다: **가진 수 − 방에 있는 수**다(js/cozy.js furnList).
   그래서 격자에서 빼기만 하면 창고에 하나 늘어난다 — 산 가구는 그것으로 끝난다.

   그런데 **생성기가 놓아 준 가구는 「가진 수」가 0 이다.** 처음 사무실에 있던 소파를
   치우면 가진 수 0, 방에 있는 수 0 이 되어 그 소파는 세상에서 사라졌다 —
   되살릴 방법이 없다. 치우기는 되돌아오지 않는 조작이지만 **없애는 조작은 아니다.**

   그래서 치울 때 가진 수를 「방에 남은 수 + 1」까지 올려 준다. 산 가구에는 아무 일도
   안 일어나고(이미 그보다 크다), 생성기가 준 가구는 그때 처음으로 「내 것」이 된다.
   치웠다 놓기를 반복해도 늘지 않는다 — 올리는 것이 아니라 **맞추는** 것이라서. */
/* 이 칸의 물건이 **카탈로그에 있는가** — 있으면 창고로 돌아올 수 있다. */
function editShopId(tile){
  if (tile === undefined || typeof SHOP_TILE === 'undefined') return null;
  return Object.keys(SHOP_TILE).find(k => SHOP_TILE[k] === tile) || null;
}

function editToStorage(tile, grid){
  const id = editShopId(tile);
  if (!id || typeof shopCount !== 'function') return;
  let placed = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i] === tile) placed++;
  for (const p of (W.tops || [])) if (p.tile === tile) placed++;
  if (shopCount(id) <= placed) S.shop[id] = placed + 1;
}

/* 지금 고른 것을 치울 수 있는가. 화면 쪽(js/cozy.js)이 ✕ 를 그릴지 정할 때 쓴다 —
   **눌러도 안 되는 단추를 그리지 않는다**는 이 게임의 규칙을 여기서도 지킨다.
   판단 근거는 아래 editRemove 와 **같은 줄**이어야 하므로 한 곳에 둔다. */
function editCanRemove(u){
  const sel = u || (typeof EDIT !== 'undefined' && EDIT ? EDIT.sel : null);
  if (!sel) return false;
  if (sel.kind === 'desk') return false;
  if ((sel.kind === 'furn' || sel.kind === 'top') && !editShopId(sel.tile)) return false;
  return true;
}

function editRemove(){
  const u = EDIT.sel;
  if (!u || !W) return false;
  /* ── 되돌아올 수 없는 것은 **안 치운다** ──
     치우기는 「창고로 보내기」다. 그런데 결재함·화장실·정수기처럼 **카탈로그에 없는**
     것들은 돌아올 자리가 없다 — 치우면 그 방에서 영영 사라지고 다시 만들 길이 없다.
     그건 배치가 아니라 파괴다. 등·러그·얹은 소품은 제 목록으로 돌아가므로 예외다. */
  /* **책상도 치울 수 없다.** 카탈로그에 없어서 창고로 갈 수도 없지만, 더 큰 이유는
     그것이 **고양이가 일하는 자리**라는 것이다 — 책상 수가 곧 근무 자리 수이고
     (world.js 가 격자에서 w.desks 를 다시 유도한다), 마지막 하나를 치우면 아무도
     일을 못 하는 사무실이 된다. 되돌릴 길도 없다: 생성기는 분기를 넘길 때만 방을
     다시 세운다. 옮기는 것은 그대로 된다 — 막는 것은 치우기뿐이다. */
  if (u.kind === 'desk' || ((u.kind === 'furn' || u.kind === 'top') && !editShopId(u.tile))){
    if (typeof toast === 'function') toast(u.kind === 'desk'
      ? L({ ko: '책상은 치울 수 없습니다 — 고양이가 일하는 자리입니다.',
            en: 'Desks can’t be put away — that’s where the cats work.',
            ja: 'デスクは片づけられません — 猫が働く席です。' })
      : L({ ko: `${unitName(u)} 은(는) 치울 수 없습니다 — 창고로 돌아올 수 없는 물건입니다.`,
            en: `${unitName(u)} can’t be put away — it has no place in storage.`,
            ja: `${unitName(u)} は片づけられません — 倉庫に戻せない物です。` }));
    try { sfx.err(); } catch (e) {}
    return false;
  }

  if (u.kind === 'light'){
    W.lights = (W.lights || []).filter(p => p !== u.ref);
    /* 등도 **창고로 간다.** 카탈로그에 같은 물건이 있다(스탠드·랜턴) — 치운 등을
       그것으로 돌려주면 다시 놓을 수 있고, 그때부터는 격자 가구다.
       이게 없으면 등은 「지우면 사라지는 유일한 물건」이 된다. */
    editToStorage(u.ref && u.ref.kind === 'lantern' ? TILE.LANTERN : TILE.FLOORLAMP, W.grid);
    snapshotWorld(); save();
    bus.emit('world:rebuilt', W);
  } else if (u.kind === 'top'){
    W.tops = (W.tops || []).filter(p => p !== u.ref);
    editToStorage(u.tile, W.grid);
    snapshotWorld(); save();
    bus.emit('world:rebuilt', W);
  } else if (u.kind === 'rug'){
    W.rugs = (W.rugs || []).filter(r => r !== u.ref);
    snapshotWorld(); save();
    bus.emit('world:rebuilt', W);
  } else if (u.kind === 'decor'){
    W.wallDecor = (W.wallDecor || []).filter(d => d !== u.ref);
    snapshotWorld(); save();
    bus.emit('world:rebuilt', W);
  } else {
    const g = Uint8Array.from(W.grid);
    const span = u.span || 1;
    for (let i = 0; i < span; i++){
      const idx = u.y * W.W + (u.x + i);
      g[idx] = TILE.FLOOR;
      if (W.rot) delete W.rot[idx];
    }
    W.grid = g;
    editToStorage(u.tile, g);   // 치운 것은 **창고로** 간다 (아래)
    snapshotWorld();
    buildWorld();        // 격자에서 시설·책상·결재함 재유도 (옮기기와 같은 길)
    save();
  }
  EDIT.sel = null;
  editRefresh();
  return true;
}

/* ---------- 화면 ---------- */
/* 화면 좌표 → 월드 타일. 카메라(VIEW)가 좌우 벽을 빼고 한 칸 내려 그리므로
   그 오프셋을 되돌려야 클릭한 칸과 실제 격자가 맞는다. */
function editTileFromEvent(e){
  if (!W) return null;
  if (e.target.closest('.clockchip,.edithint,.raidbanner')) return null;
  /* 화면 좌표를 바닥 평면에 쏴서 칸을 얻는다. 격자 좌표계는 그대로이므로
     이 함수 바깥은 한 줄도 모른다. */
  if (typeof is3d !== 'function' || !is3d()) return null;
  return R3.pickTile(e.clientX, e.clientY);
}

/* 유닛의 표시 footprint — 책상은 자리 두 칸까지 같이 보여준다.
   서쪽 벽에 걸린 장식은 세로로 뻗으므로 가로세로를 바꿔 준다. */
function unitBox(u){
  if (u.kind === 'rug'){
    const s = rugSizeOf({ id:u.tile, rot:u.rot });
    return { x:u.x, y:u.y, w:s.w, h:s.h };
  }
  if (u.kind === 'decor' && u.face === 'w') return { x:u.x, y:u.y, w:1, h:u.span };
  return { x:u.x, y:u.y, w:u.span, h:u.kind === 'desk' ? 2 : 1 };
}
function placeBox(el, b){
  /* 화면 사각형은 격자와 안 맞는다(원근). 씬 안에 판을 깔아야 겹친다. */
  if (typeof is3d !== 'function' || !is3d()) return;
  R3.marker(el.id === 'editSel' ? 'sel' : 'ghost', b,
            el.id === 'editSel' ? 'sel' : (el.className || 'pick'));
}

/* 버튼이 하나 들어가므로 글자가 아니라 HTML 이다. 키보드(R)만 두면 터치에서 못 돌린다 —
   그리고 이 게임의 절반은 창을 띄워 놓고 마우스로만 보는 사람이다. */
function editHintHTML(){
  if (!EDIT.sel) return L({
    ko:'🛋️ 배치 모드 — 옮길 가구를 클릭 (벽의 액자도 됩니다)',
    en:'🛋️ Decorate — click a piece to move (wall art works too)',
    ja:'🛋️ 模様替え——動かす家具をクリック（壁の額もOK）',
  });
  const n = unitName(EDIT.sel);
  /* 가구 밑에 러그가 깔려 있으면 그걸 알려 준다 — 한 번 더 누르면 잡힌다는 것을
     모르면 그 러그는 없는 것과 같다. */
  const under = (EDIT.sel.kind === 'furn' || EDIT.sel.kind === 'desk')
    && (W.rugs || []).some(r => rugHit(r, EDIT.sel.x, EDIT.sel.y))
    ? ' · ' + L({ ko:'한 번 더 누르면 <b>밑의 러그</b>',
                  en:'click again for the <b>rug underneath</b>',
                  ja:'もう一度押すと<b>下のラグ</b>' }) : '';
  const turn = canTurn(EDIT.sel)
    ? `<button class="rotbtn" data-rot="1" title="${L({ ko:'돌리기 (R)', en:'Rotate (R)', ja:'回す (R)' })}">↻</button>`
    : '';
  return turn + L({
    ko:`${n} — 놓을 곳을 클릭${canTurn(EDIT.sel) ? ' · R 돌리기' : ''}${under} · Esc 취소`,
    en:`${n} — click a spot${canTurn(EDIT.sel) ? ' · R to rotate' : ''}${under} · Esc cancels`,
    ja:`${n}——置き場所をクリック${canTurn(EDIT.sel) ? '・Rで回す' : ''}${under}・Escで取消`,
  });
}

function editRefresh(){
  const layer = $('#editLayer'), sel = $('#editSel'), ghost = $('#editGhost'), hint = $('#editHint');
  if (!layer) return;
  layer.style.display = EDIT.on ? 'block' : 'none';
  hint.style.display = EDIT.on ? 'block' : 'none';
  if (!EDIT.on){
    EDIT.sel = null; EDIT.hover = null;
    ghost.style.display = 'none'; sel.style.display = 'none';
    if (typeof is3d === 'function' && is3d()){ R3.marker('ghost', null); R3.marker('sel', null); }
    return;
  }
  hint.innerHTML = editHintHTML();
  const hide3d = w => { if (typeof is3d === 'function' && is3d()) R3.marker(w, null); };
  if (EDIT.sel) placeBox(sel, unitBox(EDIT.sel));
  else { sel.style.display = 'none'; hide3d('sel'); }
  if (!EDIT.hover){ ghost.style.display = 'none'; hide3d('ghost'); }
}

function editHover(t){
  const ghost = $('#editGhost');
  const hideGhost = () => {
    ghost.style.display = 'none';
    if (typeof is3d === 'function' && is3d()) R3.marker('ghost', null);
  };
  EDIT.hover = t;
  if (!t){ hideGhost(); return; }
  if (!EDIT.sel){
    const u = unitAt(t.x, t.y);
    if (!u){ hideGhost(); return; }
    ghost.className = 'pick';
    placeBox(ghost, unitBox(u));
    return;
  }
  const u = EDIT.sel;
  let ok;
  if (u.kind === 'rug') ok = rugTargetOK(u, t.x, t.y);
  else if (u.kind === 'decor') ok = decorTargetOK(u, t.x, t.y);
  else {
    const r = editTryMove(u, t.x, t.y);
    ok = (r !== 'bad' && r !== 'block');
  }
  ghost.className = ok ? 'ok' : 'bad';
  placeBox(ghost, unitBox({ ...u, x:t.x, y:t.y }));
}

/* 돌리기 한 번. 못 돌리는 물건을 여기서 설명한다 —
   아무 일도 안 일어나는 키는 고장 난 키와 구분이 안 된다.
   (「도트에서는 회전이 안 보인다」 경고가 여기 있었다. 도트판을 지워서 같이 지웠다.) */
/* ── 한 칸 민다 ──
   화살표 넷이 이걸 부른다(키보드의 ←↑→↓ 와 폰의 화살표 단추). 돌리기와 다른 점:
   **밀고 나서도 손에 들고 있다.** 한 칸씩 맞춰 가는 조작이라 매번 다시 집게 하면
   그건 미는 게 아니라 옮기기를 네 번 하는 것이다. 그래서 선택을 자리와 함께 옮긴다. */
function editNudge(dx, dy){
  if (!EDIT.on || !EDIT.sel) return false;
  const u = EDIT.sel;
  const tx = u.x + dx, ty = u.y + dy;
  const res = editApply(u, tx, ty);
  if (res === true){
    try { sfx.add(); } catch (e) {}
    /* 옮긴 자리를 그대로 든다. 러그·벽 장식도 좌표가 같은 이름이라 한 줄로 끝난다. */
    EDIT.sel = { ...u, x: tx, y: ty };
    keepSel = true;
    editRefresh();
    return true;
  }
  try { sfx.err(); } catch (e) {}
  /* 벽에 대고 미는 것은 사고가 아니다 — 말없이 안 움직인다.
     길을 막는 것만 말해 준다(그건 사람이 이유를 알아야 하는 거절이다). */
  if (res === 'block' && typeof toast === 'function')
    toast(L({ ko:'거기 두면 길이 막힌다냥.', en:'That would block the way.',
              ja:'そこに置くと道がふさがるにゃ。' }));
  return false;
}

function doRotate(dir){
  if (!EDIT.on) return;
  if (!EDIT.sel){
    toast(L({ ko:'먼저 돌릴 가구를 고르세요.', en:'Pick a piece first.', ja:'先に回す家具を選んでください。' }));
    return;
  }
  if (!canTurn(EDIT.sel)){
    sfx.err();
    toast(L({
      ko:'두 칸짜리와 벽에 건 것은 못 돌립니다. 한 칸짜리 가구만 돌아갑니다.',
      en:'Two-tile pieces and wall-mounted things can’t turn. One-tile furniture only.',
      ja:'2マスのものと壁掛けは回せません。1マスの家具だけです。',
    }));
    return;
  }
  if (!editRotate(dir)) return;
  sfx.add();
}

function toggleEdit(force){
  /* 남의 사무실을 구경하는 중에는 배치 모드가 없다 (js/visit.js). 렌더러에는 저쪽 방이
     서 있는데 편집은 내 격자(W)를 만지므로, 저쪽 방을 보면서 **내 가구가 조용히 이사한다.**
     그건 배치 모드가 아니라 사고다. */
  if (typeof visiting === 'function' && visiting() && force !== false){
    if (typeof toast === 'function') toast(L({
      ko:'구경 중에는 배치를 바꿀 수 없습니다. 내 사무실로 돌아가서 하세요.',
      en:'You can’t rearrange while visiting. Head back to your own office first.',
      ja:'見学中は模様替えできません。自分のオフィスに戻ってからどうぞ。' }));
    return;
  }
  const was = EDIT.on;
  EDIT.on = force != null ? force : !EDIT.on;
  /* ── 배치 중에는 **카메라를 세운다** ──
     평소 카메라는 고양이를 한 마리씩 돌아가며 따라간다(render3d 의 FOLLOW).
     그 상태로 배치를 하면 놓을 자리를 겨누는 동안 화면이 저 혼자 움직인다 —
     화살표로 한 칸씩 미는 조작에서는 특히 못 쓴다.
     끄고, 나갈 때 원래대로 돌려놓는다. */
  if (EDIT.on !== was && typeof R3 !== 'undefined' && R3 && R3.followOn){
    if (EDIT.on){
      EDIT.follow0 = R3.following ? R3.following() : null;
      R3.followOn(false);
    } else if (EDIT.follow0){
      R3.followOn(true);
      EDIT.follow0 = null;
    }
  }
  /* 배치 모드에 들어가면 R 이 손잡이가 된다. 결재함 입력칸에 커서가 있으면
     그 R 이 서류 제목에 박히므로 여기서 손을 떼게 한다. */
  if (EDIT.on){
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) el.blur();
    /* 폰에서는 결재함이 사무실을 통째로 덮고 있을 수 있다. 가구를 옮기라고
       해 놓고 가구를 안 보여주면 배치 모드가 아니다 — 무대 탭으로 데려간다. */
    if (typeof setCol === 'function' && $('#app').classList.contains('tabbar')) setCol('stage');
  }
  EDIT.sel = null;
  if (EDIT.on) bus.emit('edit:on');   // 켜졌다는 신호. 첫 출근 안내가 쓰던 것 — 지금은 안 듣는다
  $('#viewport').classList.toggle('editmode', EDIT.on);
  $('#btnEdit').classList.toggle('on', EDIT.on);
  editRefresh();
}

function editInit(){
  $('#btnEdit').onclick = () => { toggleEdit(); if (EDIT.on) sfx.add(); };

  $('#viewport').addEventListener('click', e => {
    if (!EDIT.on) return;
    // 시점을 돌리다 손을 뗀 것이지 놓으라고 한 게 아니다
    if (typeof R3 !== 'undefined' && R3 && R3.justDragged && R3.justDragged()) return;
    const t = editTileFromEvent(e);
    if (!t) return;
    /* 지금 고른 것이 이 칸의 가구면 다음 차례는 그 밑의 러그다 — 한 번 더 누르면
       러그가 잡히고, 또 누르면 해제된다. 러그는 바닥에 까는 것이라 책상 밑에도
       깔리는데, 위의 가구가 늘 먼저 잡히면 그 러그는 영영 못 옮긴다. */
    const onSel = EDIT.sel && EDIT.sel.x === t.x && EDIT.sel.y === t.y;
    /* 같은 칸을 다시 누르면 **한 겹 아래로** 내려간다: 얹힌 소품 → 그 밑의 가구 → 러그.
       위에서 아래로 한 겹씩 가는 것이 손이 닿는 순서다. */
    const deeper = !onSel ? null
      : EDIT.sel.kind === 'top' ? 'under'
      : (EDIT.sel.kind === 'furn' || EDIT.sel.kind === 'desk') ? 'rug' : null;
    const u = unitAt(t.x, t.y, deeper);

    if (u && sameUnit(u, EDIT.sel)){ EDIT.sel = null; editRefresh(); return; }   // 다시 클릭 = 해제
    /* **고른 것이 있으면 초점이 안 넘어간다.** 예전에는 가구가 있는 칸을 누르면 그리로
       선택이 옮겨 갔다 — 옮길 자리를 고르다가 그 자리에 뭐가 있으면, 옮기려던 물건을
       놓친 채 엉뚱한 물건을 든 채로 서 있게 된다. 손에 든 것을 내려놓는(✓ 또는 Esc)
       것은 사람이 정한다.
       예외 하나: **같은 칸**을 다시 누르면 그 밑의 러그로 내려간다(위 주석). */
    if (u && onSel){ EDIT.sel = u; sfx.add(); editRefresh(); return; }
    if (u && !EDIT.sel){ EDIT.sel = u; sfx.add(); editRefresh(); return; }       // 빈손일 때만 집는다
    if (!EDIT.sel) return;                                                       // 빈 칸 클릭 = 이동 시도

    const wasRug = EDIT.sel.kind === 'rug';
    const res = editApply(EDIT.sel, t.x, t.y);
    if (res === true){
      sfx.buy();
      /* 러그는 이사가 아니다 — 길이 한 칸도 안 바뀌었으므로 고양이가 새로 익힐 것이 없다.
         「이사 완료」라고 하면 안 일어난 일을 알리는 것이 된다. */
      toast(wasRug
        ? L({ ko:'러그를 폈습니다. 고양이가 곧 그 위에 앉습니다.',
              en:'Rug laid out. A cat will be sitting on it shortly.',
              ja:'ラグを敷きました。じきに猫が座ります。' })
        : L({ ko:'이사 완료. 고양이들이 새 배치를 익히는 중이다냥.',
              en:'Moved. The cats are learning the new layout.',
              ja:'引っ越し完了。猫たちが新しい配置を覚え中にゃ。' }));
      EDIT.sel = null;
    } else if (res === 'block'){
      sfx.err();
      toast(L({ ko:'거기 두면 길이 막힌다냥. 고양이가 못 지나간다.',
                en:'That would block the way — cats couldn’t get through.',
                ja:'そこに置くと道がふさがるにゃ。猫が通れない。' }));
    } else {
      sfx.err();
      /* 「놓을 수 없다」보다 **왜**가 낫다. 대개는 그 칸에 이미 뭐가 있는 것이다 —
         선택이 안 넘어가게 바꾼 뒤로는 이 말이 더 자주 나온다. */
      const taken = !!unitAt(t.x, t.y);
      toast(taken
        ? L({ ko:'거기엔 이미 다른 가구가 있다.', en:'Something is already there.',
              ja:'そこにはもう別の家具がある。' })
        : L({ ko:'거기엔 놓을 수 없다.', en:'Can’t place it there.', ja:'そこには置けない。' }));
    }
    editRefresh();
  });

  $('#viewport').addEventListener('pointermove', e => {
    if (!EDIT.on) return;
    editHover(editTileFromEvent(e));
  });
  $('#viewport').addEventListener('pointerleave', () => { if (EDIT.on) editHover(null); });
  /* 힌트 막대의 ↻. editTileFromEvent 가 .edithint 를 이미 걸러 내므로
     위의 클릭 처리와 부딪히지 않는다 — 그래서 여기서 따로 받아도 된다. */
  $('#editHint').addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-rot]');
    if (!b) return;
    e.stopPropagation();
    doRotate(+b.dataset.rot);
  });

  $('#viewport').addEventListener('contextmenu', e => {
    if (!EDIT.on) return;
    e.preventDefault();
    /* 오른쪽 드래그는 이제 카메라 회전이다. 회전을 끝낸 손을 뗀 것이지 선택을 풀라는 게 아니다. */
    if (typeof R3 !== 'undefined' && R3 && R3.justDragged && R3.justDragged()) return;
    EDIT.sel = null;
    editRefresh();
  });
  document.addEventListener('keydown', e => {
    if (!EDIT.on || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    if (e.key === 'Escape'){
      if (EDIT.sel){ EDIT.sel = null; editRefresh(); }
      else toggleEdit(false);
      return;
    }
    if (e.key === 'r' || e.key === 'R'){ doRotate(e.shiftKey ? -1 : 1); e.preventDefault(); return; }
    /* 화살표 넷 — 고른 것을 한 칸 민다. 폰의 화살표 단추도 이 키를 보낸다(js/cozy.js). */
    const NUD = { ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1] };
    if (NUD[e.key] && EDIT.sel){ editNudge(NUD[e.key][0], NUD[e.key][1]); e.preventDefault(); }
  });

  // 사무실 이전 등으로 월드가 다시 만들어지면 선택 좌표가 낡는다.
  // 돌리기는 격자를 안 건드리므로 그때만 선택을 지킨다.
  bus.on('world:rebuilt', () => {
    if (keepSel){ keepSel = false; editRefresh(); return; }
    EDIT.sel = null;
    editRefresh();
  });
}
