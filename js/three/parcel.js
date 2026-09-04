/* ============================================================
   parcel.js — 택배를 뜯는 컷신. **CSS 그림이 아니라 진짜 방에서 찍는다.**

   ── 왜 다시 만들었나 ──
   처음에는 div 와 CSS 로 상자를 그리고 고양이 사진 한 장을 얹었다. 그건 「게임 위에
   붙인 그림」이지 이 게임의 장면이 아니었다 — 상자는 평면이고, 고양이는 사진이고,
   방은 뒤에서 흐려져 있었다. 이 저장소는 프롤로그도 아웃트로도 **실시간 폴리곤**으로
   찍는다(opening.js · outro.js). 택배도 그래야 한다.

   ── 아웃트로와 같은 방식 ──
   씬을 안 만든다. render3d 의 씬을 받아서
     · 그 고양이의 **책상 위에** 상자를 하나 놓고
     · 그 위에 따뜻한 등을 하나 켜고
     · 카메라 두 장을 돌려준다
   방도 가구도 고양이도 이미 거기 있다. 첫 프레임에 보이는 것은 **진짜 그 사무실**이다.

   ── 앞발은 어떻게 움직이나 ──
   이 조형에는 관절이 없다(catsculpt.js — 자세마다 통째로 깎는다). 그래서 걸음과 같은
   길로 간다: `legStep` 으로 **앞발 끝만** 옮긴 앉은 자세 세 장을 깎아 두고 돌려 쓴다
   (catsculpt.js 의 warmTap · setTap). 두 앞발이 번갈아 올라갔다 내려오면 그게 「까딱」이다.

   ── 상자를 왜 가구(f_box)로 안 쓰나 ──
   가구 상자는 **닫혀 있다.** 이 장면의 요점은 뚜껑이 열리는 것이라 여기서 따로 짠다:
   몸통 · 뚜껑 넷(각자 경첩에서 돈다) · 테이프 · 발바닥 도장. 전부 LP 의 박스다.
   ============================================================ */
import * as THREE from './vendor/three.module.min.js';
import * as LP from './lowpoly.js';

/* 상자 크기. 두 가지가 이 값을 정했다.
     · **고양이를 가리면 안 된다** — 0.46×0.30 으로 짰다가 앉은 고양이(키 0.74)의 얼굴을
       통째로 덮었다. 책상 위에 있어서 이미 0.65 만큼 올라와 있다는 걸 잊은 값이었다.
     · **키보드보다 넓어야 한다** — 상자를 키보드 자리에 얹어서 키보드를 덮는다(아래).
       키보드가 0.46 이라 그보다 좁으면 양옆으로 삐져나온다. */
/* 높이 0.25 는 뚜껑 위가 0.95 라 **앞발보다 높았다** — 앞발이 상자 뒤로 숨었다.
   0.22 면 뚜껑 위가 0.87 이고, 들어 올린 앞발(0.87)이 딱 그 턱에 얹힌다. */
const BW = 0.52, BH = 0.22, BD = 0.36;
const CARD = 0xB98A5A, CARD_DK = 0x8A6238, CARD_IN = 0x5E4022, TAPE = 0xE8DCC2;

let ctx = null;        // { scene, deskTop, at:{x,y,z}, yaw }
let root = null;       // 이 파일이 만든 것 전부
let flaps = [];        // [{ mesh, axis, open }]
let glow = null, tape = null;
let CH = [], DUR = 0;

const smooth = k => k * k * (3 - 2 * k);
const lerp = (a, b, k) => a + (b - a) * k;

/* ---------- 상자 ----------
   뚜껑은 **경첩에서 돈다.** 판을 그냥 돌리면 판 한가운데를 축으로 돌아서 상자 안으로
   반쯤 들어간다. 그래서 판마다 빈 Group 을 경첩 자리에 두고 그 안에 판을 밀어 넣는다 —
   이 저장소에서 문짝과 같은 방식이다. */
function flap(w, d, x, z, axis, sign){
  const hinge = new THREE.Group();
  hinge.position.set(x, BH / 2, z);
  const p = LP.box(w, 0.022, d, CARD_DK, 0, 0, 0);
  /* 판을 경첩 **바깥쪽으로** 반 장 밀어 둔다. 그래야 돌 때 바깥으로 젖혀진다. */
  if (axis === 'x') p.position.z = sign * d / 2;
  else              p.position.x = sign * w / 2;
  hinge.add(p);
  hinge.userData = { axis, sign };
  return hinge;
}

function makeBox(){
  const g = new THREE.Group();
  const t = 0.026;
  /* 안쪽 어둠 — 바닥 한 장. 뚜껑이 열리면 이게 보인다. */
  g.add(LP.box(BW, t, BD, CARD_IN, 0, -BH / 2 + t / 2, 0));
  /* 벽 넷 */
  g.add(LP.box(BW, BH, t, CARD, 0, 0,  BD / 2 - t / 2));
  g.add(LP.box(BW, BH, t, CARD, 0, 0, -BD / 2 + t / 2));
  g.add(LP.box(t, BH, BD, CARD_DK,  BW / 2 - t / 2, 0, 0));
  g.add(LP.box(t, BH, BD, CARD_DK, -BW / 2 + t / 2, 0, 0));
  /* 발바닥 도장 — 앞면에 얇게. 이게 있어야 **이 회사가 보낸** 상자다.
     복셀 그림체라 발가락은 네모 넷이면 읽힌다(둥글게 깎으면 오히려 안 보인다). */
  const st = new THREE.Group();
  st.add(LP.box(0.10, 0.075, 0.006, CARD_DK, 0, -0.02, 0));
  [[-0.045, 0.045], [-0.016, 0.062], [0.016, 0.062], [0.045, 0.045]].forEach(([x, y]) =>
    st.add(LP.box(0.026, 0.030, 0.006, CARD_DK, x, y, 0)));
  st.position.set(0, -0.02, BD / 2 + 0.001);
  g.add(st);
  /* 뚜껑 넷 — 긴 쪽 둘이 크고 짧은 쪽 둘이 작다(진짜 택배 상자가 그렇다) */
  flaps = [
    flap(BW, BD / 2 - 0.01, 0,  BD / 4,  'x', +1),
    flap(BW, BD / 2 - 0.01, 0, -BD / 4,  'x', -1),
    flap(BW / 2 - 0.01, BD,  BW / 4, 0, 'z', +1),
    flap(BW / 2 - 0.01, BD, -BW / 4, 0, 'z', -1),
  ];
  flaps.forEach(f => g.add(f));
  /* 테이프 한 줄 — 뚜껑 위를 가로지른다. 뜯기면 사라진다(길이를 0 으로 줄인다). */
  tape = LP.box(0.055, 0.006, BD + 0.01, TAPE, 0, BH / 2 + 0.014, 0);
  g.add(tape);
  return g;
}

/* ---------- 세운다 ----------
   c = { scene, box:{x,y,z} 책상 위 상자 자리, cat:{x,y,z} 앉은 고양이, yaw, roomW } */
export function build(c){
  stop();
  ctx = c;
  root = new THREE.Group();

  const box = makeBox();
  box.position.set(c.box.x, c.box.y + BH / 2, c.box.z);
  box.rotation.y = c.yaw;
  root.add(box);

  /* 등 하나. 방의 조명은 그대로 두고 **이 책상만** 밝힌다 — 컷신이라고 방을 어둡게
     만들면 사람이 꾸민 사무실이 안 보인다(아웃트로에서 배운 것과 같다). */
  glow = new THREE.PointLight(0xFFD9A0, 0, 2.6, 2);
  glow.position.set(c.box.x, c.box.y + 0.75, c.box.z);
  root.add(glow);

  c.scene.add(root);

  /* ---------- 장 ----------
     **옆에서 본다.** 앞에서 보면 고양이의 등짝이고(책상을 보고 앉아 있다), 책상 쪽에서
     보면 벽이나 옆 책상이 등을 막는다. 옆얼굴이라야 앞발이 상자에 닿는 것이 읽힌다.

     좌표는 고양이와 상자 **두 점에서** 만든다. 책상은 사람이 옮길 수 있어서 방 좌표를
     박으면 한 배치에서만 맞는다(아웃트로에서 배운 것과 같은 규칙).
       mid  둘의 한가운데, 조금 위 — 카메라가 늘 여기를 본다
       dir  상자 → 고양이 (앉은 축)
       side 그 축의 직각. 방 안쪽으로 가는 쪽을 고른다 — 벽에 코를 박지 않게 */
  /* ── 카메라 자리는 **재서 고른다** ──
     한 바퀴 돌려 보고(spike/dist/shots/sw-grid.png) 알게 된 것:
       · 뒤(0°)      등짝뿐이다
       · 옆(90°)     쓸 만하지만 상자가 프레임 끝으로 밀린다
       · 정면(180°)  **모니터가 막는다** — 고양이는 책상을 보고 앉아 있다
       · 정면 45°    얼굴도 상자도 뚜껑도 다 들어온다
     그런데 **어느 각이 막히는지는 방마다 다르다.** 책상 배치도, 옆자리 모니터도,
     벽도 사람이 옮긴다. 그래서 각을 박아 두면 어떤 사무실에서는 모니터 등짝만 찍힌다
     (실제로 그렇게 찍혔다). 후보 각을 놓고 **광선을 쏴서 막히지 않은 것**을 고른다. */
  const cat = c.cat, bx = c.box;
  /* 과녁은 **둘 사이**다. 고양이에 맞추면 상자가 프레임 끝으로 밀려 잘린다(실측). */
  const look = { x: (cat.x + bx.x) / 2, y: bx.y + 0.30, z: (cat.z + bx.z) / 2 };
  const RW = c.roomW || 12, RD = c.roomD || 10, M = 0.75;
  const clamp = (v, hi) => Math.max(M, Math.min(hi - M, v));
  const posAt = (ang, R, y) => new THREE.Vector3(
    clamp(cat.x + Math.sin(ang) * R, RW), y, clamp(cat.z + Math.cos(ang) * R, RD));

  /* 후보 — 정면 45° 를 먼저 보고, 막히면 옆으로, 그다음 조금 뒤로. 뒤통수는 마지막이다. */
  const CAND = [Math.PI - 0.80, Math.PI + 0.80, Math.PI - 1.30, Math.PI + 1.30,
                Math.PI - 0.35, Math.PI + 0.35, Math.PI - 2.10, Math.PI + 2.10];
  /* **둘 다** 보여야 한다: 고양이 얼굴과 상자. 과녁 하나만 재면 「얼굴은 보이는데
     상자가 모니터 뒤에 있는」 각이 뽑힌다(실제로 그렇게 뽑혔다). 그래서 광선 셋을 쏜다. */
  const AIMS = [new THREE.Vector3(cat.x, cat.y + 0.62, cat.z),      // 얼굴
                new THREE.Vector3(bx.x, bx.y + 0.14, bx.z),        // 상자
                new THREE.Vector3(look.x, look.y, look.z)];
  let ANG = CAND[0];
  if (c.occluder){
    const ray = new THREE.Raycaster();
    const clear = (from, to) => {
      const dir = to.clone().sub(from);
      const dist = dir.length();
      ray.set(from, dir.normalize());
      ray.far = dist - 0.30;                 // 과녁 바로 앞의 상자·책상은 막는 것이 아니다
      return !ray.intersectObject(c.occluder, true).length;
    };
    for (const a of CAND){
      const from = posAt(a, 2.62, 1.68);
      if (AIMS.every(v => clear(from, v))){ ANG = a; break; }
    }
  }
  const at = (R, y) => { const p = posAt(ANG, R, y);
                         return [p.x, p.y, p.z, look.x, look.y, look.z]; };
  CH = [
    /* 1. 사무실에서 **들어온다.** 방이 먼저 보이고 카메라가 책상으로 내려앉는다 —
          이 컷의 요점은 「내 사무실에 택배가 왔다」이지 상자 그림이 아니다. */
    { id:'in',   dur:1.25, from: at(4.30, 2.70), to: at(2.80, 1.74) },
    /* 2. **두드린다.** 카메라는 거의 멈춘다 — 여기서 움직이면 앞발이 안 읽힌다. */
    { id:'tap',  dur:1.35, from: at(2.80, 1.74), to: at(2.62, 1.68) },
    /* 3. **열린다.** 뚜껑이 젖혀지고 안에서 빛이 샌다. 살짝 올라가 안을 들여다본다. */
    { id:'open', dur:1.05, from: at(2.62, 1.68), to: at(2.38, 1.86) },
  ];
  DUR = CH.reduce((a, x) => a + x.dur, 0);
  return { dur: DUR, box };
}

/* 이번 시각의 카메라와 장면 상태. 반환값의 tap 은 앞발 위상(없으면 null)이다. */
export function seek(t){
  if (!root) return null;
  t = Math.max(0, Math.min(DUR, t));
  let acc = 0, ch = CH[0], local = 0;
  for (const c of CH){
    if (t < acc + c.dur || c === CH[CH.length - 1]){ ch = c; local = t - acc; break; }
    acc += c.dur;
  }
  local = Math.max(0, Math.min(ch.dur, local));
  const k = smooth(local / ch.dur);
  const p = ch.from.map((v, i) => lerp(v, ch.to[i], k));

  /* 뚜껑 — 3장에서 젖혀진다. 긴 쪽 둘이 먼저, 짧은 쪽 둘이 조금 늦게 (진짜로 그렇게 열린다) */
  const op = ch.id === 'open' ? local / ch.dur : (ch.id === 'in' || ch.id === 'tap' ? 0 : 1);
  flaps.forEach((f, i) => {
    const d = i < 2 ? 0 : 0.22;                       // 짧은 쪽은 늦게
    const a = smooth(Math.max(0, Math.min(1, (op - d) / 0.55))) * 2.15 * f.userData.sign;
    if (f.userData.axis === 'x') f.rotation.x = -a;
    else                         f.rotation.z =  a;
  });
  /* 테이프는 뜯기는 순간 없어진다 — 반쯤 열린 뚜껑에 테이프가 걸려 있으면 그게 더 이상하다 */
  if (tape) tape.visible = op < 0.06;
  /* 빛은 열리면서 샌다 */
  if (glow) glow.intensity = op <= 0 ? 0 : smooth(Math.min(1, op / 0.5)) * 2.4;

  /* 앞발은 1·2장에서 까딱거린다. 3장에서는 멈춘다 — 열린 상자를 계속 두드리면 이상하다. */
  const tap = (ch.id === 'open') ? null : (t * 3.4);
  return { pos:[p[0], p[1], p[2]], look:[p[3], p[4], p[5]], chapter: ch.id, tap, dur: DUR };
}

export function stop(){
  if (root && ctx && ctx.scene) ctx.scene.remove(root);
  root = null; ctx = null; flaps = []; glow = null; tape = null; CH = []; DUR = 0;
}
export function playing(){ return !!root; }
export function duration(){ return DUR; }
