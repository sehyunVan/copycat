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
   ============================================================ */

const EDIT = { on:false, sel:null, hover:null };

/* 격자에서 움직일 수 없는 것들 */
const EDIT_FIXED = new Set([TILE.FLOOR, TILE.WALL, TILE.DOOR]);

const editSpan = t => (typeof FURN_SPAN !== 'undefined' && FURN_SPAN[t]) || 1;
const decorSpan = t => t === TILE.WHITEBOARD ? 2 : 1;

/* (x,y)에 있는 "옮길 수 있는 한 덩어리"를 찾는다 */
function unitAt(x, y){
  if (!W) return null;
  const t = tileAt(W, x, y);
  if (t === TILE.WALL){
    for (const d of (W.wallDecor || [])){
      const sp = decorSpan(d.tile);
      if (y === d.y && x >= d.x && x < d.x + sp)
        return { kind:'decor', x:d.x, y:d.y, tile:d.tile, span:sp, ref:d };
    }
    return null;
  }
  if (t === TILE.DESK)   return { kind:'desk', x, y, tile:TILE.DESK, span:2 };
  if (t === TILE.DESK_R) return tileAt(W, x-1, y) === TILE.DESK
    ? { kind:'desk', x:x-1, y, tile:TILE.DESK, span:2 } : null;
  if (t === TILE.FILLER) return unitAt(x-1, y);        // 가로 2칸 가구의 오른쪽 절반
  if (!EDIT_FIXED.has(t)) return { kind:'furn', x, y, tile:t, span:editSpan(t) };
  return null;
}

const sameUnit = (a, b) => a && b && a.kind === b.kind && a.x === b.x && a.y === b.y;

function unitName(u){
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

/* 벽 장식: 정면 벽(아래가 벽이 아닌 벽 칸)에만, 다른 장식과 안 겹치게 */
function decorTargetOK(unit, tx, ty){
  for (let i = 0; i < unit.span; i++){
    const x = tx + i;
    if (x < 1 || x > W.W-2 || ty < 0 || ty >= W.H-1) return false;
    if (tileAt(W, x, ty) !== TILE.WALL) return false;
    if (tileAt(W, x, ty+1) === TILE.WALL) return false;
    for (const d of (W.wallDecor || []))
      if (d !== unit.ref && ty === d.y && x >= d.x && x < d.x + decorSpan(d.tile)) return false;
  }
  return true;
}

/* 이동 확정. true | 'bad' | 'block' */
function editApply(unit, tx, ty){
  if (unit.kind === 'decor'){
    if (!decorTargetOK(unit, tx, ty)) return 'bad';
    unit.ref.x = tx; unit.ref.y = ty;
    snapshotWorld(); save();
    bus.emit('world:rebuilt', W);
    return true;
  }
  const r = editTryMove(unit, tx, ty);
  if (r === 'bad' || r === 'block') return r;
  W.grid = r;
  // 가구가 깔고 앉은 잡동사니는 치운다
  W.clutter = (W.clutter || []).filter(c => r[c.y*W.W + c.x] === TILE.FLOOR);
  snapshotWorld();
  buildWorld();          // 격자에서 시설·책상·결재함 재유도 + 고양이 재배치
  save();
  return true;
}

/* ---------- 화면 ---------- */
/* 화면 좌표 → 월드 타일. 카메라(VIEW)가 좌우 벽을 빼고 한 칸 내려 그리므로
   그 오프셋을 되돌려야 클릭한 칸과 실제 격자가 맞는다. */
function editTileFromEvent(e){
  if (!W) return null;
  if (e.target.closest('.clockchip,.edithint,.raidbanner')) return null;
  const r = $('#world').getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const sx = Math.floor((e.clientX - r.left) / r.width * viewW());
  const sy = Math.floor((e.clientY - r.top) / r.height * viewH());
  const x = sx - VIEW.ox, y = sy - VIEW.oy;
  if (x < 0 || y < 0 || x >= W.W || y >= W.H) return null;
  return { x, y };
}

/* 유닛의 표시 footprint — 책상은 자리 두 칸까지 같이 보여준다 */
function unitBox(u){
  return { x:u.x, y:u.y, w:u.span, h:u.kind === 'desk' ? 2 : 1 };
}
function placeBox(el, b){
  el.style.display = 'block';
  el.style.left = vpx(b.x) + 'px';
  el.style.top = vpy(b.y) + 'px';
  el.style.width = (b.w * TS) + 'px';
  el.style.height = (b.h * TS) + 'px';
}

function editHintText(){
  if (!EDIT.sel) return L({
    ko:'🛋️ 배치 모드 — 옮길 가구를 클릭 (벽의 액자도 됩니다)',
    en:'🛋️ Decorate — click a piece to move (wall art works too)',
    ja:'🛋️ 模様替え——動かす家具をクリック（壁の額もOK）',
  });
  const n = unitName(EDIT.sel);
  return L({
    ko:`${n} — 놓을 곳을 클릭 · 다시 클릭하면 선택 해제 · Esc 취소`,
    en:`${n} — click a spot · click it again to deselect · Esc cancels`,
    ja:`${n}——置き場所をクリック・もう一度クリックで解除・Escで取消`,
  });
}

function editRefresh(){
  const layer = $('#editLayer'), sel = $('#editSel'), ghost = $('#editGhost'), hint = $('#editHint');
  if (!layer) return;
  layer.style.display = EDIT.on ? 'block' : 'none';
  hint.style.display = EDIT.on ? 'block' : 'none';
  if (!EDIT.on){ EDIT.sel = null; EDIT.hover = null; ghost.style.display = 'none'; sel.style.display = 'none'; return; }
  hint.textContent = editHintText();
  if (EDIT.sel) placeBox(sel, unitBox(EDIT.sel));
  else sel.style.display = 'none';
  if (!EDIT.hover) ghost.style.display = 'none';
}

function editHover(t){
  const ghost = $('#editGhost');
  EDIT.hover = t;
  if (!t){ ghost.style.display = 'none'; return; }
  if (!EDIT.sel){
    const u = unitAt(t.x, t.y);
    if (!u){ ghost.style.display = 'none'; return; }
    ghost.className = 'pick';
    placeBox(ghost, unitBox(u));
    return;
  }
  const u = EDIT.sel;
  let ok;
  if (u.kind === 'decor') ok = decorTargetOK(u, t.x, t.y);
  else {
    const r = editTryMove(u, t.x, t.y);
    ok = (r !== 'bad' && r !== 'block');
  }
  ghost.className = ok ? 'ok' : 'bad';
  placeBox(ghost, unitBox({ ...u, x:t.x, y:t.y }));
}

function toggleEdit(force){
  EDIT.on = force != null ? force : !EDIT.on;
  EDIT.sel = null;
  $('#viewport').classList.toggle('editmode', EDIT.on);
  $('#btnEdit').classList.toggle('on', EDIT.on);
  editRefresh();
}

function editInit(){
  $('#btnEdit').onclick = () => { toggleEdit(); if (EDIT.on) sfx.add(); };

  $('#viewport').addEventListener('click', e => {
    if (!EDIT.on) return;
    const t = editTileFromEvent(e);
    if (!t) return;
    const u = unitAt(t.x, t.y);

    if (u && sameUnit(u, EDIT.sel)){ EDIT.sel = null; editRefresh(); return; }   // 다시 클릭 = 해제
    if (u){ EDIT.sel = u; sfx.add(); editRefresh(); return; }                    // 유닛 클릭 = 선택
    if (!EDIT.sel) return;                                                       // 빈 칸 클릭 = 이동 시도

    const res = editApply(EDIT.sel, t.x, t.y);
    if (res === true){
      sfx.buy();
      toast(L({ ko:'이사 완료. 고양이들이 새 배치를 익히는 중이다냥.',
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
  $('#viewport').addEventListener('contextmenu', e => {
    if (!EDIT.on) return;
    e.preventDefault();
    EDIT.sel = null;
    editRefresh();
  });
  document.addEventListener('keydown', e => {
    if (!EDIT.on || e.key !== 'Escape') return;
    if (EDIT.sel){ EDIT.sel = null; editRefresh(); }
    else toggleEdit(false);
  });

  // 사무실 이전 등으로 월드가 다시 만들어지면 선택 좌표가 낡는다
  bus.on('world:rebuilt', () => { EDIT.sel = null; editRefresh(); });
}
