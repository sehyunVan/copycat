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
function unitAt(x, y){
  if (!W) return null;
  const t = tileAt(W, x, y);
  if (t === TILE.WALL){
    for (const d of (W.wallDecor || []))
      if (decorHit(d, x, y))
        return { kind:'decor', x:d.x, y:d.y, tile:d.tile, span:decorSpan(d), face:d.face || 'n', ref:d };
    return null;
  }
  if (t === TILE.DESK)   return { kind:'desk', x, y, tile:TILE.DESK, span:2 };
  if (t === TILE.DESK_R) return tileAt(W, x-1, y) === TILE.DESK
    ? { kind:'desk', x:x-1, y, tile:TILE.DESK, span:2 } : null;
  if (t === TILE.FILLER) return unitAt(x-1, y);        // 가로 2칸 가구의 오른쪽 절반
  if (!EDIT_FIXED.has(t)) return { kind:'furn', x, y, tile:t, span:editSpan(t) };
  /* 빈 바닥 — 여기서만 러그가 잡힌다. 가구 밑에 깔린 러그는 위의 가구가 먼저 잡는다. */
  for (const r of (W.rugs || []))
    if (rugHit(r, x, y))
      return { kind:'rug', x:r.x, y:r.y, tile:r.id, rot:r.rot|0, span:rugSizeOf(r).w, ref:r };
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
  if (u.kind === 'rug'){
    const it = (typeof DECOR !== 'undefined') && DECOR.byId(u.tile);
    return '🧶 ' + (it ? it.n : 'rug');
  }
  const inf = TILE_INFO[u.kind === 'desk' ? TILE.DESK : u.tile] || {};
  return (inf.em || '') + ' ' + (inf.n || '');
}

/* ---------- 검증: 이 격자로 사무실이 굴러가는가 ---------- */
function editGridOK(g2){
  const WW = W.W, HH = W.H;
  const P = { W:WW, H:HH, grid:g2 };
  const entry = { x:W.door.x, y:HH - 2 };
  if (!walkable(P, entry.x, entry.y)) return false;
  const reach = floodFrom(P, entry);
  for (let y = 1; y < HH-1; y++){
    for (let x = 1; x < WW-1; x++){
      const i = y*WW + x, t = g2[i];
      if (WALKABLE.has(t)){ if (!reach.has(i)) return false; continue; }   // 끊긴 바닥
      if (t === TILE.WALL || t === TILE.FILLER) continue;
      if (t === TILE.DESK || t === TILE.DESK_R){
        if (!WALKABLE.has(g2[(y+1)*WW + x])) return false;                 // 자리가 막혔다
        continue;
      }
      // 그 밖의 가구·결재함: 접근 칸이 하나는 있어야 한다
      if (![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => walkable(P, x+dx, y+dy)))
        return false;
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
  const turn = canTurn(EDIT.sel)
    ? `<button class="rotbtn" data-rot="1" title="${L({ ko:'돌리기 (R)', en:'Rotate (R)', ja:'回す (R)' })}">↻</button>`
    : '';
  return turn + L({
    ko:`${n} — 놓을 곳을 클릭${canTurn(EDIT.sel) ? ' · R 돌리기' : ''} · 다시 클릭하면 선택 해제 · Esc 취소`,
    en:`${n} — click a spot${canTurn(EDIT.sel) ? ' · R to rotate' : ''} · click it again to deselect · Esc cancels`,
    ja:`${n}——置き場所をクリック${canTurn(EDIT.sel) ? '・Rで回す' : ''}・もう一度クリックで解除・Escで取消`,
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
  EDIT.on = force != null ? force : !EDIT.on;
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
  if (EDIT.on) bus.emit('edit:on');   // 첫 출근 안내가 이 걸음을 기다린다 (js/tutor.js)
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
    const u = unitAt(t.x, t.y);

    if (u && sameUnit(u, EDIT.sel)){ EDIT.sel = null; editRefresh(); return; }   // 다시 클릭 = 해제
    if (u){ EDIT.sel = u; sfx.add(); editRefresh(); return; }                    // 유닛 클릭 = 선택
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
      toast(L({ ko:'거기엔 놓을 수 없다.', en:'Can’t place it there.', ja:'そこには置けない。' }));
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
    if (e.key === 'r' || e.key === 'R'){ doRotate(e.shiftKey ? -1 : 1); e.preventDefault(); }
  });

  // 사무실 이전 등으로 월드가 다시 만들어지면 선택 좌표가 낡는다.
  // 돌리기는 격자를 안 건드리므로 그때만 선택을 지킨다.
  bus.on('world:rebuilt', () => {
    if (keepSel){ keepSel = false; editRefresh(); return; }
    EDIT.sel = null;
    editRefresh();
  });
}
