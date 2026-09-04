/* ============================================================
   outro.js — 마지막 장면. **줌아웃하면 지점들이 깔리고, 경찰의 뒷모습이 보이며 끝난다.**
   대본은 ../../STORY.md 의 「줌아웃 (Q28 · 엔딩 둘의 공통 장면)」.

   ── 프롤로그와 정반대로 만든다 ──
   opening.js 는 **자기 렌더러와 자기 씬**을 갖는다. 골목과 텅 빈 방은 게임 격자와 아무
   상관이 없으니 그게 맞았다. 아웃트로는 반대다: 이 장면의 내용이 곧 **당신의 사무실**이고,
   그 방은 이미 render3d 가 세워 놓았다(벽지·바닥·가구 톤·산 가구·놓은 자리·앉아 있는
   고양이·고른 간판까지). 렌더러를 따로 두면 그 방을 처음부터 다시 만들어야 하고,
   그 순간부터 두 방은 서로 달라지기 시작한다.

   그래서 이 파일은 **씬을 안 만든다.** render3d 의 씬을 받아서
     · 우리 방 **주위에** 복제 판을 깔고
     · 그 격자의 한가운데에 냥찰청을 세우고
     · 그 옥상에 둘을 세워 두고
     · 카메라 세 장을 돌려준다
   방은 손대지 않는다. 첫 컷에 나오는 것은 진짜 그 방이다.

   ── 복제 판은 왜 진짜 방이 아닌가 ──
   그게 이 장면의 뜻이다. 우리 방만 진짜고 나머지는 **같은 평면도에 간판만 갈아 끼운 것**이다.
   그리고 실제로도 그래야 한다 — 스물넷을 진짜로 세우면 가구가 방마다 스물다섯 종이다.

   ── 판 간격은 방 크기에서 끌어온다 ──
   사무실은 등급마다 커진다(12×10 → 17×15). 간격을 상수로 박아 두면 등급에 따라 판이
   겹치거나 벌어진다. 그래서 전부 W·D 로 잰다.
   ============================================================ */
import * as THREE from './vendor/three.module.min.js';
import * as LP from './lowpoly.js';
import * as CS from './catsculpt.js';

const GRID = 5;                 // 5×5 — 가운데가 냥찰청이므로 지점은 24개
/* 우리 방은 가운데 열의 **맨 뒷줄**이다(북쪽). 처음엔 맨 앞줄(r:4)에 뒀는데,
   그러면 냥찰청이 우리 방의 북쪽에 서고 카메라도 거기서 남쪽을 본다 — 즉 **우리 방을
   뒤에서** 보게 된다. 이 게임의 방은 남쪽(+z)이 트여 있고 북쪽에 벽이 있어서
   (render3d 가 옆벽과 아래 벽줄을 안 그린다), 북에서 보면 벽 등짝만 보이고 안이 안 보인다.
   방을 맨 뒤에 두면 청사가 남쪽에 서고, 거기서 북쪽을 보게 되어 **방 안이 보인다.** */
const OUR = { c: 2, r: 0 };
const GAP = 5;                  // 방과 방 사이

/* 옥상 높이. **낮아야 아래가 보인다** — 높이면 카메라가 아무리 숙여도 격자가 프레임
   밖으로 밀리고, 더 숙이면 이번엔 고양이를 위에서 내려다보게 된다(뒷모습이 아니라 정수리).
   9.5 는 그 사이에서 잡은 값이다: 카메라를 옥상 바닥보다 3.45 위에 두면 시선이 바닥 끝을
   33° 로 넘어가고, 앞줄 지점이 그보다 얕은 각에 들어온다. 이 값을 올릴 때는 3장의
   카메라 높이(CH 의 watch)도 같이 올려야 한다 — 둘은 한 쌍이다. */
const ROOF = 9.5;

let ctx = null;                 // { scene, W, D }
let root = null;                // 이 파일이 만든 것 전부. 끝나면 통째로 버린다
let cops = [];
let CH = [], DUR = 0, VISTA = null;

const smooth = k => k * k * (3 - 2 * k);
const lerp = (a, b, k) => a + (b - a) * k;

/* ---------- 복제 판 하나 ----------
   멀리서 보이는 것은 **덩어리와 등불**뿐이다. 그 이상 채우면 프레임만 잡아먹는다.
   자리를 씨앗으로 조금씩 흩는 이유: 스물넷이 완전히 같으면 「복제된 지점」이 아니라
   「덜 만든 장면」으로 보인다. */
function plate(seed, W, D){
  const g = new THREE.Group();
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);

  g.add(LP.box(W, 0.18, D, 0x1B1A19, W / 2, -0.09, D / 2));
  /* 안에서 켜진 등불 — 점광원 대신 발광 바닥 한 장. 지점이 스물넷이라 방마다 등을 켜면
     광원이 스물넷이다(52번에서 이미 겪었다: 만질수록 느려지는 사무실). */
  /* 등불은 **한참 눕혀 둔다**(0.6 → 0.34 → 0.16 → 0.055).
     복제 판은 **잘 안 보여야 한다.** 진짜로 만든 방이 아니라 같은 평면도를 복제한 것이라,
     밝히면 밝힐수록 「대충 만든 사무실」이 또렷해진다 — 화면에 필요한 것은 방의 내용이
     아니라 **저기에도 하나, 저기에도 하나**라는 사실뿐이다.
     그래서 켜진 흔적만 남긴다: 어둠 속의 흐린 호박색 자국. 색도 크림에서 호박으로
     데운다 — 창이 켜진 사무실은 흰빛이 아니라 노란빛이고, 그래야 청사의 찬 창빛과 갈린다. */
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(W - 2.2, D - 2.2), LP.matGlow(0xC4894A, 0.055));
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(W / 2, 0.012, D / 2);
  g.add(glow);
  /* 벽은 두 면만. 네 면으로 두르면 위에서 볼 때 상자가 되고, 상자는 사무실로 안 읽힌다.
     (게임의 방도 같은 이유로 옆벽을 안 그린다 — render3d 의 카메라 주석) */
  g.add(LP.box(W, 1.1, 0.22, 0x232019, W / 2, 0.55, 0));
  g.add(LP.box(0.22, 1.1, D, 0x232019, 0, 0.55, D / 2));

  /* 판 하나가 방 하나만큼 크다(17×15). 5칸 간격으로 놓았더니 **빈 창고**로 보였다 —
     진짜 방은 가구가 스물다섯 종 들어차 있으니 옆에 놓고 보면 그 차이가 그대로 보인다.
     3.6칸 간격이면 「사무실인데 우리 방은 아닌 곳」으로 읽힌다. */
  const cols = Math.max(3, Math.round(W / 3.6)), rows = Math.max(2, Math.round(D / 3.6));
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++){
      const x = 1.8 + i * (W - 3.4) / Math.max(1, cols - 1) + rnd() * 0.4;
      const z = 2.2 + j * (D - 4.4) / Math.max(1, rows - 1) + rnd() * 0.4;
      const d = LP.desk(); d.position.set(x, 0, z); g.add(d);
      const c = LP.chair(Math.PI); c.position.set(x, 0, z + 0.85); g.add(c);
      g.add(LP.monitor(x, z - 0.1, 0));
    }

  /* 간판. 지점을 가르는 유일한 표시다 — 여기가 59번에서 고른 그 간판이 들어갈 자리고,
     지금은 밝기만 조금씩 다른 판이다. */
  const sign = LP.box(2.4, 0.52, 0.14, 0x8A7A64, W / 2, 1.3, D + 0.12);
  sign.material = LP.matGlow(0xC79A5E, 0.13 + rnd() * 0.08);
  g.add(sign);
  g.add(LP.box(0.14, 1.3, 0.14, 0x232019, W / 2 - 1.05, 0.65, D + 0.12));
  g.add(LP.box(0.14, 1.3, 0.14, 0x232019, W / 2 + 1.05, 0.65, D + 0.12));
  return g;
}

/* ---------- 냥찰청 ----------
   격자 한가운데. 지점은 등을 켜고 이쪽은 **창 몇 짝만** 켜져 있어야
   「보는 쪽」과 「보이는 쪽」이 갈린다.

   ── 관공서로 읽히게 ──
   처음엔 창 몇 개 뚫은 검은 상자였다. 판들 사이에 놓으니 「큰 지점」으로 보였다 —
   중심에 있는 것이 그냥 더 큰 사무실이면 이 장면의 뜻이 없어진다. 그래서 관공서가
   가진 것들을 붙였다. 전부 상자와 원기둥이지만 넷이 모이면 청사로 읽힌다:

     · **기단(基壇)** — 본체보다 넓은 받침. 관공서는 땅에서 한 단 올라가 있다
     · **줄 맞은 창** — 층이 보이는 격자. 지점의 창은 제멋대로고 이쪽은 줄이 맞는다
     · **현관 차양과 등 둘** — 사람이 드나드는 정문. 지점에는 없는 것이다
     · **간판 띠와 문장(紋章)** — 위쪽에 발광 띠 한 줄, 그 가운데 귀 둘 달린 원반.
       글자를 못 쓰므로(3D 에 글꼴이 없다) 이 게임의 고양이 귀로 대신한다
     · **안테나** — 옥상 위로 솟은 기둥과 붉은 표시등. 높이를 옥상에 안 얹고 **위로** 준다
       (옥상 높이 ROOF 는 3장 카메라와 한 쌍이라 못 건드린다 — 그 주석 참고)

   위층은 **열린 옥상**이다. 한 번 실내(사방 벽 + 창틀)로 만들었다가 걷었다 — 실내는
   등을 켜면 실루엣이 죽고 안 켜면 아무것도 안 보이며, 무엇보다 창턱이 시야를 잘라서
   **아래의 격자가 프레임에 안 들어왔다.** 이 장면의 요점이 「내려다보고 있다」인데. */
function precinct(W, D){
  /* 지점 판이 방 크기(17×15)만큼 크므로 청사도 그만큼이어야 한다 — 처음엔 W*0.5 로
     뒀더니 판들 사이에 놓인 **작은 검은 상자**였다. 「중심」으로 읽히려면 덩치가 있어야 한다. */
  const bw = Math.max(9, W * 0.62), bd = Math.max(7, D * 0.52);
  const g = new THREE.Group();
  const STONE = 0x2B3038, STONE_D = 0x22262E, TRIM = 0x3A4150;

  /* 기단 — 본체보다 한 단 넓고 낮다 */
  g.add(LP.box(bw + 2.6, 0.7, bd + 2.2, STONE_D, 0, 0.35, 0));
  g.add(LP.box(bw + 1.4, 0.28, bd + 1.2, TRIM, 0, 0.84, 0));
  /* 본체 */
  g.add(LP.box(bw, ROOF - 1, bd, STONE, 0, (ROOF - 1) / 2 + 1, 0));
  /* 모서리 기둥 넷 — 밋밋한 상자에 세로선이 생긴다 */
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      g.add(LP.box(0.5, ROOF - 1, 0.5, TRIM, sx * (bw / 2 - 0.2), (ROOF - 1) / 2 + 1, sz * (bd / 2 - 0.2)));

  /* 줄 맞은 창. 앞면(+z)과 옆면 둘. 켜진 칸은 셋에 하나 —
     전부 켜면 이쪽도 사무실이고, 다 끄면 폐건물이다. */
  const COLS = 5, ROWS = 3;
  const lit = (i) => i % 3 === 0;
  let n = 0;
  for (let r = 0; r < ROWS; r++)
    for (let i = 0; i < COLS; i++){
      const y = 2.2 + r * ((ROOF - 3.4) / Math.max(1, ROWS - 1));
      const x = -bw * 0.34 + i * (bw * 0.68 / (COLS - 1));
      const on = lit(n++);
      const w = LP.box(0.86, 1.0, 0.12, on ? 0xCFE0F2 : 0x171A20, x, y, bd / 2 + 0.02);
      if (on) w.material = LP.matGlow(0xBFD4EA, 0.5);
      g.add(w);
    }
  for (const sx of [-1, 1])
    for (let r = 0; r < ROWS; r++)
      for (let i = 0; i < 3; i++){
        const y = 2.2 + r * ((ROOF - 3.4) / Math.max(1, ROWS - 1));
        const z = -bd * 0.26 + i * (bd * 0.26);
        const on = lit(n++);
        const w = LP.box(0.12, 1.0, 0.8, on ? 0xCFE0F2 : 0x171A20, sx * (bw / 2 + 0.02), y, z);
        if (on) w.material = LP.matGlow(0xBFD4EA, 0.42);
        g.add(w);
      }

  /* 현관 — 차양과 등 둘. 지점에는 없는 것이라 이것 하나로 「드나드는 곳」이 생긴다. */
  g.add(LP.box(bw * 0.42, 0.26, 1.9, TRIM, 0, 2.5, bd / 2 + 0.95));
  g.add(LP.box(0.28, 2.3, 0.28, TRIM, -bw * 0.19, 1.35, bd / 2 + 1.75));
  g.add(LP.box(0.28, 2.3, 0.28, TRIM,  bw * 0.19, 1.35, bd / 2 + 1.75));
  for (const sx of [-1, 1]){
    const b = LP.box(0.34, 0.34, 0.34, 0xFFE6B4, sx * bw * 0.19, 2.28, bd / 2 + 1.75);
    b.material = LP.matGlow(0xFFE0A8, 0.9);
    g.add(b);
  }
  const door = new THREE.PointLight(0xFFD9A0, 1.1, 9, 2);
  door.position.set(0, 2.1, bd / 2 + 1.6);
  g.add(door);

  /* 간판 띠와 문장. 글자를 못 쓰므로 **귀 둘 달린 원반** 하나로 대신한다 —
     이 게임에서 고양이 귀는 이미 표지다(로고·아이콘·이름표). */
  const band = LP.box(bw * 0.86, 0.5, 0.1, 0x1A1E26, 0, ROOF - 0.9, bd / 2 + 0.03);
  band.material = LP.mat(0x1A1E26);
  g.add(band);
  const emb = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), LP.matGlow(0xE7D6A8, 0.95));
  emb.position.set(0, ROOF - 0.9, bd / 2 + 0.1);
  g.add(emb);
  for (const sx of [-1, 1]){
    const ear = LP.cone(0.19, 0.3, 0xE7D6A8, 3);
    ear.material = LP.matGlow(0xE7D6A8, 0.95);
    ear.position.set(sx * 0.26, ROOF - 0.56, bd / 2 + 0.1);
    g.add(ear);
  }

  /* 옥상 — 바닥과 낮은 난간뿐이다.
     **테라스는 -z 쪽에 낸다**(정면의 반대). 격자가 그쪽에 있고 둘은 격자를 보아야 하는데,
     정면까지 그쪽으로 돌리면 화면에는 건물 뒤통수만 남는다(위 build 의 주석).
     한 번 옥상에 방을 한 채 얹어 봤다가 걷었다 — 카메라와 둘 사이에 서면 프레임을
     막고, 둘 너머에 서면 격자를 가린다. 옥상은 비어 있는 편이 낫다. */
  g.add(LP.box(bw + 1.6, 0.3, bd + 2.0, 0x2E333C, 0, ROOF + 0.15, -0.6));
  /* 안테나 — 높이를 옥상에 안 얹고 위로 준다. 붉은 표시등은 관공서의 표지다. */
  g.add(LP.box(0.22, 5.4, 0.22, TRIM, -bw * 0.3, ROOF + 3.0, -bd * 0.3));
  const beacon = LP.box(0.3, 0.3, 0.3, 0xFF6B5A, -bw * 0.3, ROOF + 5.8, -bd * 0.3);
  beacon.material = LP.matGlow(0xFF6B5A, 1.0);
  g.add(beacon);

  const ez = -(bd / 2 + 1.55);                    // 옥상에서 격자를 보는 끝 (-z)
  const rail = (w, d, x, z) => {
    g.add(LP.box(w, 0.09, d, 0x4A5060, x, ROOF + 0.80, z));
    g.add(LP.box(w, 0.07, d, 0x434958, x, ROOF + 0.50, z));
  };
  rail(bw + 1.6, 0.16, 0, ez);
  rail(0.16, bd + 2.0, -(bw + 1.6) / 2, -0.6);
  rail(0.16, bd + 2.0,  (bw + 1.6) / 2, -0.6);
  for (let i = 0; i <= 5; i++)
    g.add(LP.box(0.13, 0.84, 0.13, 0x434958, -(bw + 1.6) / 2 + i * (bw + 1.6) / 5, ROOF + 0.44, ez));

  g.userData.edgeZ = ez;
  return g;
}

/* ---------- 취조등 ----------
   옥상의 둘 위에 **등 하나.** 이 컷의 문제는 「둘이 안 보인다」였다 — 검은 고양이를
   밤 옥상에 세워 두면 난간과 구별이 안 된다. 그렇다고 앞에서 비추면 실루엣이 죽는다.

   그래서 **위에서 하나**다. 취조실의 그 등이다: 갓이 좁아서 빛이 원뿔로 떨어지고,
   바닥에 동그란 웅덩이가 생기고, 그 안에 둘만 서 있다. 밝히는 것과 동시에
   **여기가 어떤 곳인지**를 말한다 — 냥찰청 옥상에서 내려다보는 둘이다.

   빛 웅덩이는 광원 하나로 안 된다(바닥이 어두우면 감쇠만으로는 원이 안 생긴다).
   발광 원반을 바닥에 깔아 원을 그리고, 그 위에 짧은 점광원을 얹어 고양이를 세운다. */
function interrogationLamp(x, y, z, sgn){
  const g = new THREE.Group();
  /* 등에 **기구가 없다.** 기둥·팔·갓·전구를 다 만들었다가 지웠다 —
     이 컷에서 그 물건들이 한 일은 전부 방해였다:
       · 전구를 낮게 달면 크레인 카메라의 눈높이에 와서 **렌즈 앞을 막는다**
       · 높이 달면 화면 위쪽에 걸리는데, 그 자리가 하필 **저 아래 우리 사무실 위**라
         「사무실 천장에 등이 하나 떠 있다」로 읽힌다(실제로 그렇게 보였다)
       · 기둥은 화면을 대각선으로 가른다
     빛의 출처를 안 보여도 **빛이 무엇을 하는지는 그대로 보인다** — 위에서 떨어지는
     좁은 빛과 그 안의 둘. 취조실의 그 느낌은 기구가 아니라 그 빛이 만든다.

     sgn 은 카메라가 어느 쪽에 있나(+1 이면 z 가 큰 쪽). 보조광이 그쪽에 서야 한다. */
  const l = new THREE.PointLight(0xFFEBC2, 2.6, 8, 2);
  l.position.set(x, y + 3.8, z);
  g.add(l);
  /* ── 카메라 쪽에서 하나 더 ──
     위에서만 비추면 빛이 닿는 곳은 둘의 **정수리와 반대편**이다. 카메라가 보는 면(등과
     뒷머리)은 그늘에 남고, 그래서 아무리 세게 비춰도 검은 덩어리 둘이다.
     등을 단 이유가 「냥찰인지 알아보게」였으므로 그건 실패다.
     그래서 카메라 쪽에 하나 더 둔다 — 등과 뒷머리와 **모자**에 걸릴 만큼. */
  const back = new THREE.PointLight(0xC6D6EC, 26, 22, 2);
  back.position.set(x, y + 2.4, z + 3.0 * (sgn || 1));
  g.add(back);
  return g;
}

/* ============================================================
   세우기
   ============================================================ */
export function build(c){
  clear();
  ctx = c;
  const { scene, W, D } = ctx;
  const px = W + GAP, pz = D + GAP;              // 판 간격
  root = new THREE.Group();
  scene.add(root);

  let seed = 1;
  for (let r = 0; r < GRID; r++)
    for (let cc = 0; cc < GRID; cc++){
      if (cc === 2 && r === 2) continue;          // 가운데는 냥찰청
      if (cc === OUR.c && r === OUR.r) continue;  // 여기는 **진짜 방**이 이미 서 있다
      const g = plate(seed++, W, D);
      g.position.set((cc - OUR.c) * px, 0, (r - OUR.r) * pz);
      /* 링(체비셰프 거리)으로 솟아오른다 — 가까운 것부터 한 겹씩 */
      g.userData.ring = Math.max(Math.abs(cc - OUR.c), Math.abs(r - OUR.r));
      root.add(g);
    }

  const cen = { x: W / 2 + (2 - OUR.c) * px, z: D / 2 + (2 - OUR.r) * pz };
  const twr = precinct(W, D);
  twr.position.set(cen.x, 0, cen.z);
  /* 청사는 **안 돌린다.** 한 번 반 바퀴 돌려 봤다 — 테라스를 격자 쪽으로 보내려고 한
     건데, 그러면 정면(창 격자·현관·문장)이 통째로 카메라 반대편으로 가서 화면에는
     **건물 뒤통수**만 남는다. 정면은 카메라를 보고, 테라스만 반대쪽에 낸다(precinct). */
  root.add(twr);

  /* ── 창가의 둘 ──
     도 경찰과 김 경찰. **뒷모습이다** — 3장의 카메라가 이 둘의 뒤에 선다.
     조형은 실제 고양이 크기인데 이 컷은 카메라가 크레인에 올라가 있어서, 그대로 두면
     **모자 두 개**로만 읽힌다. 반 배쯤 키운다 — 아무도 재지 않는다. */
  /* 테라스 끝은 -z 쪽이다(edgeZ 가 음수). 둘은 그 끝에서 한 걸음 안쪽에 선다. */
  const cz = cen.z + twr.userData.edgeZ + 1.45;
  /* 취조등은 **둘 바로 위**다. 기구는 없고 빛만 있다(위 함수의 머리말).
     보조광은 카메라 쪽(+z)에 선다. */
  root.add(interrogationLamp(cen.x, ROOF + 0.15, cz - 0.15, +1));
  cops = [-1.3, 1.3].map(dx => {
    const a = CS.sculptActor({ fur: 0 });
    if (a.setGear) a.setGear({ head:'police', neck:'tie' });
    a.setState('idle');
    a.baseY = ROOF + 0.3;
    a.root.scale.setScalar(1.5);
    a.root.position.set(cen.x + dx, a.baseY, cz);
    a.setHeading(Math.PI);              // -z 를 본다 = 격자 쪽 = 카메라 반대쪽
    a.root.rotation.y = Math.PI;
    root.add(a.root);
    return a;
  });

  /* ---------- 장 ----------
     from/to 는 [카메라 x,y,z, 과녁 x,y,z]. opening.js 의 CH 표와 같은 형식이다.
     좌표는 전부 방 크기로 잰다 — 등급마다 방이 커지므로 상수를 박으면 한 등급에서만 맞는다. */
  const R = { x: W / 2, z: D / 2 };               // 우리 방 가운데
  CH = [
    /* 1. **진짜 우리 방 안.** 낮은 카메라 — 이 게임의 평소 시선이다.
       사람이 산 가구와 바른 벽지가 여기 그대로 있고, 고양이도 앉아 있다. */
    { id:'room', dur:5.0, fadeIn:1.6,
      from:[R.x + W * 0.30, 1.35, R.z + D * 0.34,  R.x - W * 0.06, 0.75, R.z - D * 0.16],
      to:  [R.x + W * 0.40, 3.20, R.z + D * 0.52,  R.x - W * 0.04, 0.62, R.z - D * 0.14],
      sub: null },
    /* 2. 위로 빠진다. 링이 하나씩 솟아오르고, 끝에서 냥찰청이 화면 가운데에 온다.
       **높이보다 거리를 먼저 준다** — 곧바로 위로 뜨면 도면을 보는 것이 되고,
       도면에는 「내 방이 저기 있다」가 없다. */
    { id:'grid', dur:11.0,
      from:[R.x + W * 0.40, 3.20, R.z + D * 0.52,  R.x - W * 0.04, 0.62, R.z - D * 0.14],
      to:  [cen.x + px * 0.10, (W + D) * 1.42, cen.z + pz * 2.15,  cen.x, 4.0, cen.z - pz * 0.55],
      sub: { at:6.4, text:{ ko:'…우리 지점은 서른두 번째였다.',
                            en:'…ours was the thirty-second branch.',
                            ja:'…うちの支店は三十二番目だった。' } } },
    /* 3. 냥찰청 옥상. 카메라는 둘의 **뒤**, 옥상 바닥보다 3.4m 위다.
       ── 이 컷을 세 번 고쳤다. 기하가 걸려 있다 ──
       ① 과녁을 옥상 높이에 두니 화면의 5분의 4가 빈 밤하늘이었다 — 둘은 보이는데
          무엇을 보고 있는지가 안 보인다.
       ② 과녁을 지면으로 내리니 **옥상 바닥이 화면 아래 절반을 먹었다.** 난간 뒤에 서서
          바로 아래를 볼 수는 없다 — 눈높이가 바닥에서 1m 뿐이면 아래를 향한 시선이
          전부 자기가 선 바닥에 막힌다.
       ③ 그래서 카메라를 바닥보다 높이 올렸다. 크레인 숏이다. 둘은 여전히 뒷모습이고,
          그 어깨 위로 난간이 지나가고, 난간 위로 격자가 깔린다.
       화면을 위에서 아래로 읽으면 **밤 → 격자 → 난간 → 둘의 등**이다.
       ④ 그런데 둘에 너무 붙어 있었다(3.3m). 그 거리에서는 **발치의 것이 화면에서 제일 크다** —
          빛 웅덩이든 난간이든 아래 절반을 덮는다.
       ⑤ 6.2m 로 물러섰더니 이번엔 둘이 화면 아래 끝에 **점 두 개**로 남았다.
          4.75m 가 그 사이다: 둘은 아래 삼분의 일에 서고, 등이 그 위에 걸리고,
          그 너머로 격자가 세 줄 들어온다.
       카메라는 거의 안 움직인다 — 여기서 움직이면 「보고 있다」가 「지나간다」가 된다. */
    { id:'watch', dur:8.6, cut:true, fadeOut:2.6, fov:54, expo:2.0,
      from:[cen.x - 0.20, ROOF + 4.75, cz + 4.75,  cen.x + 0.2, 0.9, cen.z - pz * 1.45],
      to:  [cen.x - 0.12, ROOF + 4.50, cz + 4.05,  cen.x + 0.2, 0.6, cen.z - pz * 1.52],
      sub: { at:3.0, text:{ ko:'우리는 모두 한낱 카피캣에 불과했다.',
                            en:'We were all only copycats.',
                            ja:'私たちは皆、ただのコピーキャットだった。' } } },
  ];
  DUR = CH.reduce((a, x) => a + x.dur, 0);

  /* ── 시작화면의 정경 (컷신에 안 들어간다) ──
     엔딩을 본 사람의 첫 화면이다(js/title.js). **엔딩의 마지막 장면 그대로**다:
     둘의 뒷모습이 제일 가까이 있고, 그 너머로 무수한 사무실이 깔린다.

     한 번은 높이 떠서 격자만 내려다보는 그림으로 잡아 봤다. 격자는 잘 보이는데
     **그 컷에는 보는 사람이 없다** — 이 게임의 마지막 화면은 「사무실이 많다」가 아니라
     「누군가 그걸 보고 있다」이므로, 둘이 프레임 안에 있어야 한다.

     3장의 카메라를 그대로 쓰지는 않는다: 그건 컷신의 마지막 호흡이라 둘에 붙어 있고
     격자가 두 줄뿐이다. 여기서는 **더 높이·더 뒤로** 물러서 둘을 아래 삼분의 일에 두고
     그 너머로 세 줄이 들어오게 한다. 로고는 그 사이의 어두운 하늘에 앉는다. */
  VISTA = {
    pos: [cen.x - 0.10, ROOF + 6.0, cz + 5.6],
    target: [cen.x + 0.20, 0.6, cen.z - pz * 1.6],
    fov: 58, expo: 2.0,
  };
  seek(0);
  return { dur: DUR, plates: root.children.length, cell:[px, pz] };
}

/* 링이 솟아오르는 시각(2장 기준 초). 1장에서 옆방이 올라오면
   「내 방 하나뿐」이라는 시작이 깨진다. */
const RISE_AT = [0, 1.1, 2.8, 4.6, 6.4];
const RISE_DUR = 2.2;

/* 시각 하나를 주면 그 순간의 카메라·자막·암전을 돌려준다.
   **그리지는 않는다** — 그리는 것은 render3d 의 draw() 다(그 방을 그리는 그 손). */
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

  const gridT = ch.id === 'room' ? 0 : (ch.id === 'grid' ? local : 99);
  for (const g of root.children){
    if (g.userData.ring === undefined) continue;
    const p = Math.max(0, Math.min(1, (gridT - RISE_AT[g.userData.ring]) / RISE_DUR));
    g.visible = p > 0;
    g.position.y = lerp(-4.0, 0, smooth(p));
  }
  /* 냥찰청은 링 둘이 올라온 다음에 선다 — 마지막에 남는 것이라 마지막에 온다 */
  const twr = root.children.find(o => o.userData.edgeZ !== undefined);
  if (twr){
    const tp = Math.max(0, Math.min(1, (gridT - 3.8) / 3.0));
    twr.visible = tp > 0 || ch.id === 'watch';
    twr.position.y = ch.id === 'watch' ? 0 : lerp(-ROOF - 1, 0, smooth(tp));
  }
  for (const a of cops) a.root.visible = ch.id === 'watch';

  let fade = 0;
  if (ch.fadeIn && local < ch.fadeIn) fade = 1 - local / ch.fadeIn;
  if (ch.cut && local < 0.9) fade = Math.max(fade, 1 - local / 0.9);
  if (ch.fadeOut && local > ch.dur - ch.fadeOut) fade = Math.max(fade, (local - (ch.dur - ch.fadeOut)) / ch.fadeOut);

  return {
    id: ch.id,
    pos: [lerp(ch.from[0], ch.to[0], k), lerp(ch.from[1], ch.to[1], k), lerp(ch.from[2], ch.to[2], k)],
    target: [lerp(ch.from[3], ch.to[3], k), lerp(ch.from[4], ch.to[4], k), lerp(ch.from[5], ch.to[5], k)],
    fov: ch.fov || null, expo: ch.expo || null, fade,
    sub: (ch.sub && local >= ch.sub.at) ? ch.sub.text : null,
    done: t >= DUR - 0.001,
  };
}

/* 고양이 숨쉬기·꼬리. 옥상의 둘만 움직인다 — 방 안의 고양이는 게임이 돌린다. */
export function tick(dt, camera){
  for (const a of cops) if (a.root.visible) a.update(dt, camera);
}

/* 정지 정경 한 컷. 격자와 청사를 다 올려 두고 카메라만 돌려준다. */
export function vista(){
  if (!root || !VISTA) return null;
  for (const g of root.children){
    if (g.userData.ring === undefined) continue;
    g.visible = true; g.position.y = 0;
  }
  const twr = root.children.find(o => o.userData.edgeZ !== undefined);
  if (twr){ twr.visible = true; twr.position.y = 0; }
  for (const a of cops) a.root.visible = true;
  return { id:'vista', pos:VISTA.pos, target:VISTA.target, fov:VISTA.fov, expo:VISTA.expo,
           fade:0, sub:null, done:false };
}

export function dur(){ return DUR; }
export function chapters(){ return CH.map(c => ({ id:c.id, dur:c.dur })); }
export function playing(){ return !!root; }

export function clear(){
  if (root && ctx) ctx.scene.remove(root);
  root = null; cops = []; CH = []; DUR = 0; VISTA = null; ctx = null;
}
