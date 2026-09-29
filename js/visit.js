/* ============================================================
   visit.js — 남의 사무실에 들어가서 돌려 본다.

   앞서 이 화면은 **평면도 한 장**이었다. 도면은 "저 사람 사무실이 이렇게 생겼다"까지는
   말해 주지만, 구경은 아니다 — 이 게임에서 사무실은 도면이 아니라 방이다.

   ── 어떻게 안전하게 남의 방을 그리나 ──

   `R3.build(world)` 는 **렌더러의 기하만** 갈아 끼운다. 게임의 `W`(시뮬레이션이 길을 찾는
   격자)는 손대지 않는다. 그래서 구경하는 동안에도 내 사무실은 그대로 돌아간다 —
   고양이들은 내 방에서 계속 일하고, 벌이도 케어 방송도 멈추지 않는다.
   **화면만 잠깐 남의 방을 보고 있는 것이다.** 저장은 한 글자도 안 바뀐다.

   그 대가로 세 곳에 문지기가 필요하다(전부 `visiting()` 하나를 본다):
     · ui.js  syncActors  — 내 고양이 대신 **저쪽 고양이**를 그린다
     · story.js           — 남의 가구를 눌러 내 조사를 열면 안 된다
     · edit.js / main.js  — 남의 방에서 배치 모드·쓰다듬기는 없다

   ── 썸네일도 같은 길로 찍는다 ──

   게시판의 사진은 그림이 아니라 **진짜 렌더**다. 그 방을 한 번 세우고, 위에서 내려다보는
   각으로 한 프레임 그리고, 캔버스를 축소해서 data URI 로 떠 둔다. 그림을 따로 그리면
   실제 사무실과 다른 것이 걸리게 되고, 그러면 사진이 거짓말을 한다.
   ============================================================ */

let VISIT = null;                 // { id, snap, world, cats, photo }
const visiting = () => !!VISIT && !VISIT.photo;
const visitBusy = () => !!VISIT;  // 사진 찍는 중까지 포함 — 프레임 루프가 이걸 본다

/* 저쪽 고양이를 배우로 세운다. `S.cats` 는 건드리지 않는다 — 이건 렌더러에 넘기는
   목록일 뿐이고, 시뮬레이션은 이 객체를 한 번도 읽지 않는다.
   자리에 앉혀 두는 이유: 남의 사무실을 여는 순간 보고 싶은 건 "저기 누가 앉아 있나"다. */
function visitCats(snap, world){
  const seats = (world.desks || []).map(d => d.seat);
  return (snap.cats || []).map((c, i) => {
    const s = seats[i % Math.max(1, seats.length)] || { x: world.door.x, y: world.H - 2 };
    return {
      id: 'v-' + snap.id + '-' + i, name: c.name,
      fur: c.fur | 0, hue: c.hue | 0, equip: null,
      x: s.x, y: s.y, act: { s:'work', t:0 },
    };
  });
}

/* ---------- 사진 ----------
   한 번 찍어 두면 그 세션 동안 다시 안 찍는다. seed 가 같으면 방도 같으므로 캐시 열쇠는
   지점 id + 등급 + seed 다 (사무실을 옮기면 사진도 바뀐다). */
const PHOTOS = new Map();
function branchPhoto(snap, w, h){
  if (!snap) return null;
  const key = snap.id + '|' + snap.tier + '|' + snap.seed;
  if (PHOTOS.has(key)) return PHOTOS.get(key);
  if (typeof is3d !== 'function' || !is3d() || !R3 || !R3.ready) return null;
  const gl = $('#gl');
  if (!gl || !gl.width) return null;

  const world = genOffice(snap.tier, snap.shop || {}, snap.seed);
  const keep = VISIT;
  VISIT = { photo:true };                 // 프레임 루프가 이 사이에 끼어들지 않게
  let url = null;
  try {
    R3.clearTags();                       // 이름표는 사진에 안 넣는다 — 방을 보는 사진이다
    R3.build(world, TILE);
    R3.sync(visitCats(snap, world), [], 0.016);
    /* 빛을 먼저 칠한다. build 가 하늘 자물쇠를 풀어 두므로(lastSky) 이걸 안 부르면
       **머티리얼이 칠해지기 전의 방**을 찍는다 — 색이 빠진 회색 사진이 나온다. */
    if (typeof renderNight === 'function') renderNight();
    /* 위에서 내려다보는 각. 정확히 수직으로 놓으면 가구가 납작한 색판이 되고
       방이 도면으로 돌아간다 — 살짝 기울여 두면 책상 높이와 그림자가 남는다.
       zoom 은 작을수록 가깝다(fit 의 R) — 방이 사진을 꽉 채워야 사무실로 보인다. */
    R3.camSet({ az: 0.72, el: 0.92, zoom: 0.60, center:true, follow:false });
    R3.draw();
    /* WebGL 은 합성 뒤에 버퍼를 비운다. 그래서 **같은 틱 안에서** 옮겨 담아야 한다. */
    const sw = Math.min(gl.width, Math.round(gl.height * (w / h)));
    const sx = Math.round((gl.width - sw) / 2), sy = 0;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(gl, sx, sy, sw, gl.height, 0, 0, w, h);
    /* webp 로 뜬다 — 같은 사진이 PNG 의 십분의 일이다(260×168 에서 131KB → 15KB).
       못 만드는 브라우저는 알아서 PNG 를 돌려주므로 폴백을 따로 안 쓴다. */
    url = cv.toDataURL('image/webp', 0.82);
  } catch(e){ url = null; }
  VISIT = keep;
  PHOTOS.set(key, url);
  return url;
}
/* 사진 여러 장을 찍고 **내 사무실로 되돌린다.** 되돌리는 걸 부르는 쪽에 맡기면
   언젠가 한 곳에서 빼먹고, 그날부터 게시판을 열면 남의 방이 남는다.

   **무대를 실제로 건드렸을 때만 되돌린다.** 게시판은 다시 그릴 때마다 이 함수를
   지나는데(인사를 보낼 때 · 요청을 수락할 때 · 서버를 기다리며 몇 번 두드릴 때 —
   js/board.js), 사진이 전부 캐시에서 나오는 그 판까지 되돌리면 **방을 통째로 다시
   세우는 일**(restoreOffice 는 R3.build 다)이 1초에 한 번씩 일어난다. 아무것도 안
   바뀐 화면에서 폰이 그 값을 치를 이유가 없다.
   `PHOTOS.size` 로 보는 이유: 위 branchPhoto 는 무대를 건드리는 길에서만 표에 한 줄을
   더한다 — 캐시로 돌아가는 길도, 3D 가 없어 못 찍는 길도 표를 안 건드린다. */
function branchPhotos(snaps, w, h){
  const before = PHOTOS.size;
  const out = snaps.map(s => branchPhoto(s, w, h));
  if (PHOTOS.size !== before && !visiting()) restoreOffice();
  return out;
}

function restoreOffice(){
  if (!R3 || !R3.ready) return;
  R3.clearTags();
  R3.build(W, TILE);
  R3.sync(S.cats.concat(NPCS), DOCS, 0.016);
  R3.camReset(true);
  R3.draw();
}

/* ---------- 들어가기 · 나오기 ---------- */
function visitBar(){
  let el = DOC.querySelector('#visitBar');
  if (el) return el;
  el = DOC.createElement('div');
  el.id = 'visitBar';
  el.className = 'visitbar';
  const vp = $('#viewport');
  if (vp) vp.appendChild(el);
  return el;
}

function visitStart(id){
  const snap = FRIENDS.snapshot(id);
  if (!snap) return false;
  /* 3D 가 없는 환경(file:// 소스 트리 · WebGL 없는 기계)에서는 방을 못 세운다.
     그때는 도면이 그 자리를 지킨다 — 없는 기능을 눌리게 두는 것보다 낫다. */
  if (typeof is3d !== 'function' || !is3d() || !R3 || !R3.ready){
    toast(L({ ko:'이 화면에서는 사무실을 세울 수 없어 도면으로만 봅니다.',
              en:'This screen can’t build the office — the floor plan is all there is.',
              ja:'この画面ではオフィスを建てられないため図面だけになります。' }));
    return false;
  }
  const world = genOffice(snap.tier, snap.shop || {}, snap.seed);
  VISIT = { id, snap, world, cats: visitCats(snap, world) };
  FRIENDS.seen(id);

  R3.clearTags();
  R3.build(world, TILE);
  R3.sync(VISIT.cats, [], 0.016);
  if (typeof renderNight === 'function') renderNight();   // 저쪽 방에도 지금 시간의 빛을
  R3.camReset(false);            // 방 전체가 들어오는 각. 여기서부터는 손이 돌린다
  R3.draw();

  DOC.body.classList.add('visiting');
  const bar = visitBar();
  bar.innerHTML = `<span class="who">🏢 ${esc(snap.name)}</span>
    <span class="tiny">${esc(snap.room)} · ${L({ ko:'구경 중 — 끌어서 돌려 보세요',
      en:'Visiting — drag to look around', ja:'見学中——ドラッグで見回せます' })}</span>
    <button class="buy" id="visitOut">${L({ ko:'내 사무실로', en:'Back to mine', ja:'自分のオフィスへ' })}</button>`;
  bar.querySelector('#visitOut').onclick = () => { sfx.add(); visitEnd(true); };
  return true;
}

function visitEnd(back){
  if (!VISIT) return;
  VISIT = null;
  DOC.body.classList.remove('visiting');
  const bar = DOC.querySelector('#visitBar');
  if (bar) bar.remove();
  restoreOffice();
  renderAll();
  if (back && typeof showBoard === 'function') showBoard();
}

/* 구경 중에 창을 옮기거나(🪟) 새로 그리면 내 방으로 돌아가는 게 맞다 —
   저쪽 방을 들고 창을 옮기면 그 창에서 무엇을 보고 있는지 아무도 모른다. */
bus.on('world:rebuilt', () => { if (visiting()) visitEnd(); });
